// Extrai as 3 cores principais de cada personagem, da mais chamativa à menos,
// e grava em public/characters/data/<slug>.json.
//
//   npm run data:colors            # todos que ainda não têm cores
//   npm run data:colors -- --force # recalcula todos
//   npm run data:colors -- phonon  # só um personagem
//
// Método: k-means determinístico sobre os pixels opacos da arte oficial, em
// OKLab (espaço perceptualmente uniforme, então "distância" bate com o que o
// olho vê). Os clusters são ordenados por um score que mistura área e croma —
// é o que faz o rosa da roupa da Phonon vir antes do preto, mesmo o
// preto ocupando mais pixels.
//
// Personagens com "colorsLocked": true no JSON são pulados: é o escape hatch
// para ajustar uma paleta à mão sem que o script a sobrescreva.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMG_DIR = join(ROOT, 'public/characters/images')
const DATA_DIR = join(ROOT, 'public/characters/data')

const K = 14 // clusters brutos, antes do merge
const ITERATIONS = 24
const SAMPLE_WIDTH = 320 // reamostra a arte; detalhe fino não muda a paleta
const MIN_ALPHA = 220 // ignora a borda antialiasada, que mistura fundo e personagem
const MERGE_DIST = 0.1 // clusters mais próximos que isto em OKLab viram um só
const SPREAD_DIST = 0.16 // separação mínima em OKLab entre as 3 cores escolhidas
const SPREAD_HUE = 25 // graus; evita devolver dois tons do mesmo vermelho
const SPREAD_LIGHTNESS = 0.18 // ...a não ser que a luminosidade as separe bem
const CHROMATIC_MIN = 0.045 // abaixo disto a cor é neutra e não disputa matiz

// Pesos do score de "chamatividade", calibrados contra o roster inteiro.
const AREA_EXP = 0.45 // < 1: massa conta, mas não atropela cor
const NEUTRAL_FLOOR = 0.18 // um preto/cinza de muita área ainda entra na paleta
const CHROMA_WEIGHT = 1.4
const CHROMA_FULL = 0.14 // croma OKLab tratado como "saturação máxima"

// ---------------------------------------------------------------- cor

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

/** sRGB 0-255 -> OKLab. */
function rgbToOklab(r, g, b) {
  const lr = toLinear(r / 255)
  const lg = toLinear(g / 255)
  const lb = toLinear(b / 255)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToRgb(L, a, bb) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(toSrgb(v) * 255)))
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const chromaOf = ([, a, b]) => Math.hypot(a, b)
const hueOf = ([, a, b]) => (Math.atan2(b, a) * 180) / Math.PI

// ---------------------------------------------------------------- k-means

/** PRNG com seed fixa: a mesma arte sempre gera a mesma paleta. */
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** k-means++ para as sementes: espalha os centros em vez de sortear vizinhos. */
function seedCentroids(points, k, rand) {
  const centroids = [points[Math.floor(rand() * points.length)]]
  const closest = new Float64Array(points.length).fill(Infinity)
  while (centroids.length < k) {
    const last = centroids[centroids.length - 1]
    let total = 0
    for (let i = 0; i < points.length; i++) {
      const d = dist(points[i], last) ** 2
      if (d < closest[i]) closest[i] = d
      total += closest[i]
    }
    if (total === 0) break
    let target = rand() * total
    let pick = points.length - 1
    for (let i = 0; i < points.length; i++) {
      target -= closest[i]
      if (target <= 0) {
        pick = i
        break
      }
    }
    centroids.push(points[pick])
  }
  return centroids
}

function kmeans(points, k, rand) {
  let centroids = seedCentroids(points, k, rand)
  const assign = new Int32Array(points.length)

  for (let iter = 0; iter < ITERATIONS; iter++) {
    let moved = false
    for (let i = 0; i < points.length; i++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < centroids.length; c++) {
        const d = dist(points[i], centroids[c])
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      if (assign[i] !== best) {
        assign[i] = best
        moved = true
      }
    }

    const sums = centroids.map(() => [0, 0, 0, 0])
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]]
      s[0] += points[i][0]
      s[1] += points[i][1]
      s[2] += points[i][2]
      s[3]++
    }
    centroids = sums.map((s, c) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centroids[c]))
    if (!moved) break
  }

  const counts = new Array(centroids.length).fill(0)
  for (let i = 0; i < points.length; i++) counts[assign[i]]++
  return centroids.map((lab, i) => ({ lab, count: counts[i] })).filter((c) => c.count > 0)
}

/** Funde clusters perceptualmente idênticos, somando suas áreas. */
function mergeClusters(clusters) {
  const merged = []
  for (const c of [...clusters].sort((a, b) => b.count - a.count)) {
    const near = merged.find((m) => dist(m.lab, c.lab) < MERGE_DIST)
    if (!near) {
      merged.push({ ...c })
      continue
    }
    const total = near.count + c.count
    near.lab = near.lab.map((v, i) => (v * near.count + c.lab[i] * c.count) / total)
    near.count = total
  }
  return merged
}

/**
 * "Chamatividade": área e croma pesam juntos. O expoente < 1 na área impede que
 * uma massa grande e sem cor (preto de roupa, sombra) domine, e o piso de 0.28
 * impede que ela seja descartada — no caso da Phonon, rosa > preto.
 * L extremos levam desconto: são highlight e contorno, não cor de identidade.
 */
function score(cluster, totalPixels) {
  const share = cluster.count / totalPixels
  const [L] = cluster.lab
  const chroma = Math.min(chromaOf(cluster.lab) / CHROMA_FULL, 1)
  const extreme = L > 0.93 ? 0.45 : L < 0.14 ? 0.7 : 1
  return share ** AREA_EXP * (NEUTRAL_FLOOR + chroma * CHROMA_WEIGHT) * extreme
}

/**
 * Duas cores são "distintas o bastante" se estão longe em OKLab e — quando as
 * duas têm cor de verdade — também em matiz. Sem a regra de matiz a paleta da
 * Vatista virava vermelho claro + vermelho escuro, inútil para compor arte.
 */
function distinct(a, b) {
  if (dist(a.lab, b.lab) < SPREAD_DIST) return false
  if (chromaOf(a.lab) < CHROMATIC_MIN || chromaOf(b.lab) < CHROMATIC_MIN) return true
  const delta = Math.abs(hueOf(a.lab) - hueOf(b.lab))
  if (Math.min(delta, 360 - delta) >= SPREAD_HUE) return true
  // Mesmo matiz ainda vale como duas cores se a luminosidade as separa bem:
  // é o caso do rosa claro da roupa da Phonon contra o magenta dela.
  return Math.abs(a.lab[0] - b.lab[0]) >= SPREAD_LIGHTNESS
}

/** Top 3 exigindo separação perceptual, para não devolver 3 tons do mesmo roxo. */
function pickThree(ranked) {
  const chosen = []
  for (const c of ranked) {
    if (chosen.every((p) => distinct(p, c))) chosen.push(c)
    if (chosen.length === 3) return chosen
  }
  // Arte de paleta muito fechada: completa relaxando a exigência de separação.
  for (const c of ranked) {
    if (chosen.length === 3) break
    if (!chosen.includes(c)) chosen.push(c)
  }
  return chosen
}

// ---------------------------------------------------------------- pipeline

async function paletteFor(imagePath) {
  const { data, info } = await sharp(imagePath)
    .resize({ width: SAMPLE_WIDTH, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const points = []
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < MIN_ALPHA) continue
    points.push(rgbToOklab(data[i], data[i + 1], data[i + 2]))
  }
  if (points.length < K * 4) throw new Error(`poucos pixels opacos (${points.length})`)

  const clusters = mergeClusters(kmeans(points, K, mulberry32(0x5eed)))
  const ranked = clusters
    .map((c) => ({ ...c, score: score(c, points.length) }))
    .sort((a, b) => b.score - a.score)

  const roles = ['primary', 'secondary', 'tertiary']
  return pickThree(ranked).map((c, i) => {
    const rgb = oklabToRgb(...c.lab)
    return {
      role: roles[i],
      hex: hex(rgb),
      rgb,
      oklab: c.lab.map((v) => +v.toFixed(4)),
      coverage: +(c.count / points.length).toFixed(4),
    }
  })
}

/** Página estática só para conferir as paletas no olho e ajustar o que destoar. */
async function writePreview(rows) {
  const cards = rows
    .filter((c) => c.colors)
    .sort((a, b) => a.rosterOrder - b.rosterOrder)
    .map(
      (c) => `  <figure>
    <img src="images/${c.slug}.png" alt="${c.name}">
    <figcaption>${c.name}</figcaption>
    <div class="sw">${c.colors
      .map(
        (s) =>
          `<span style="background:${s.hex}" title="${s.role} ${s.hex} ${(s.coverage * 100).toFixed(1)}%"></span>`
      )
      .join('')}</div>
    <code>${c.colors.map((s) => s.hex).join(' ')}</code>
  </figure>`
    )
    .join('\n')

  await writeFile(
    join(ROOT, 'public/characters/palette-preview.html'),
    `<!doctype html><meta charset="utf-8"><title>UNI2 palettes</title>
<style>
  body{margin:0;padding:24px;background:#12121a;color:#e8e8f0;font:14px/1.4 system-ui,sans-serif}
  h1{font-size:18px;font-weight:600;margin:0 0 20px}
  main{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
  figure{margin:0;background:#1c1c26;border-radius:10px;padding:12px;text-align:center}
  img{width:100%;height:150px;object-fit:contain;object-position:top}
  figcaption{margin:8px 0 6px;font-weight:600}
  .sw{display:flex;height:34px;border-radius:6px;overflow:hidden}
  .sw span{flex:1}
  code{display:block;margin-top:6px;font-size:11px;color:#9b9bb0}
</style>
<h1>UNI2 Sys:Celes &mdash; paletas extra&iacute;das (prim&aacute;ria &rarr; terci&aacute;ria)</h1>
<main>
${cards}
</main>
`
  )
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const only = args.filter((a) => !a.startsWith('--'))

  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  const rows = []

  for (const file of files) {
    const path = join(DATA_DIR, file)
    const char = JSON.parse(await readFile(path, 'utf8'))
    if (only.length && !only.includes(char.slug)) {
      rows.push(char)
      continue
    }
    if (char.colorsLocked) {
      console.log(`  ${char.slug.padEnd(11)} (locked, mantido)`)
      rows.push(char)
      continue
    }
    if (char.colors && !force) {
      rows.push(char)
      continue
    }
    if (!char.assets?.art) {
      console.warn(`  ! ${char.slug}: sem arte`)
      continue
    }

    char.colors = await paletteFor(join(IMG_DIR, `${char.slug}.png`))
    await writeFile(path, JSON.stringify(char, null, 2) + '\n')
    rows.push(char)
    console.log(`  ${char.slug.padEnd(11)} ${char.colors.map((c) => c.hex).join('  ')}`)
  }

  // Agregado que o app consome: um fetch em vez de 28.
  const all = rows.sort((a, b) => a.rosterOrder - b.rosterOrder)
  await writeFile(join(ROOT, 'public/characters/all.json'), JSON.stringify(all) + '\n')

  await writePreview(rows)
  console.log(`\n${all.length} personagens -> public/characters/all.json`)
  console.log('preview: public/characters/palette-preview.html')
}

main()
