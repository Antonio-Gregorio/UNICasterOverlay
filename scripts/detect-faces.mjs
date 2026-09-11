// Detecta a região do rosto de cada personagem e grava em
// public/characters/data/<slug>.json (campo "face", normalizado 0-1).
//
//   npm run data:faces
//   npm run data:faces -- --force    # recalcula todos
//   npm run data:faces -- phonon     # recalcula um
//   npm run data:faces -- --contact  # gera a folha de contato para conferência
//
// O recorte é usado no modo lista, onde só cabe a cabeça em vez da arte inteira.
//
// Como funciona: a arte é um desenho, então detector de face humana (Haar,
// face-api) erra feio. O que funciona aqui é procurar manchas de tom de pele e
// então perguntar de cada uma: "isto tem olhos?". Um rosto é uma área de pele
// com buracos dentro dela — olhos, sobrancelhas, boca. Um braço, uma perna ou um
// decote são pele lisa. Esse é o discriminador que separa os dois.
//
// A heurística não acerta todos. Personagens sem rosto humano visível caem no
// fallback e são ajustados à mão: quem tem "faceLocked": true é preservado.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMG_DIR = join(ROOT, 'public/characters/images')
const DATA_DIR = join(ROOT, 'public/characters/data')

const overrides = JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)), 'face-overrides.json'), 'utf8'))

const SAMPLE_WIDTH = 460 // resolução de análise; o resultado é normalizado
const MIN_ALPHA = 200
const HEAD_ZONE = 0.45 // fração superior da silhueta onde o rosto pode estar
const ZOOM_OUT = 1.85 // "um pouco de zoom out": enquadra cabeça + ombros

// Um rosto tem tamanho e forma característicos dentro da silhueta.
const MIN_AREA = 0.002 // fração da silhueta
const MAX_AREA = 0.09
const MAX_WIDTH = 0.34 // fração da largura da silhueta; acima disso é torso
const MIN_ASPECT = 0.45 // largura/altura do blob de pele
const MAX_ASPECT = 2.2
const MIN_EYES = 2 // buracos na metade superior da mancha

/** Tom de pele em arte anime: alaranjado, claro, pouco saturado. */
function isSkin(r, g, b) {
  if (r < 95 || r <= g || g < b) return false
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max / 255
  const s = max === 0 ? 0 : (max - min) / max
  return s >= 0.07 && s <= 0.72 && v >= 0.5 && r - b >= 14
}

/** Componentes conexos (4-vizinhos) de uma máscara, com bbox e área. */
function blobs(mask, w, h, minArea = 1) {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  const out = []

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let minX = w
    let maxX = -1
    let minY = h
    let maxY = -1
    let area = 0

    while (top > 0) {
      const p = stack[--top]
      const x = p % w
      const y = (p / w) | 0
      area++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      if (x > 0 && mask[p - 1] && !seen[p - 1]) (seen[p - 1] = 1), (stack[top++] = p - 1)
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) (seen[p + 1] = 1), (stack[top++] = p + 1)
      if (y > 0 && mask[p - w] && !seen[p - w]) (seen[p - w] = 1), (stack[top++] = p - w)
      if (y < h - 1 && mask[p + w] && !seen[p + w]) (seen[p + w] = 1), (stack[top++] = p + w)
    }
    if (area >= minArea) out.push({ minX, maxX, minY, maxY, area })
  }
  return out
}

/**
 * Conta os "olhos" de um candidato: ilhas de não-pele cercadas por pele, na
 * metade superior da mancha. É o que distingue um rosto de um antebraço.
 */
function countEyes(box, skin, opaqueMask, w) {
  const bw = box.maxX - box.minX + 1
  const bh = box.maxY - box.minY + 1
  const half = Math.ceil(bh / 2)
  if (bw < 6 || bh < 6) return 0

  // Recorta a metade superior da bbox e marca o que é opaco mas não é pele.
  const sub = new Uint8Array(bw * half)
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < bw; x++) {
      const p = (box.minY + y) * w + (box.minX + x)
      sub[y * bw + x] = opaqueMask[p] && !skin[p] ? 1 : 0
    }
  }

  const minEye = Math.max(3, Math.round(bw * bh * 0.004))
  const maxEye = bw * half * 0.42 // acima disso é cabelo cobrindo, não olho
  return blobs(sub, bw, half, minEye).filter((b) => {
    if (b.area > maxEye) return false
    // Um olho não encosta nas duas laterais: isso seria uma faixa de cabelo.
    return !(b.minX === 0 && b.maxX === bw - 1)
  }).length
}

async function detect(imagePath) {
  const { data, info } = await sharp(imagePath)
    .resize({ width: SAMPLE_WIDTH, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = info.width
  const h = info.height
  const ch = info.channels

  // 1. Silhueta e máscaras.
  const opaqueMask = new Uint8Array(w * h)
  const skin = new Uint8Array(w * h)
  let sMinX = w
  let sMaxX = -1
  let sMinY = h
  let sMaxY = -1
  let opaque = 0

  for (let i = 0, p = 0; i < data.length; i += ch, p++) {
    if (data[i + 3] < MIN_ALPHA) continue
    opaqueMask[p] = 1
    opaque++
    const x = p % w
    const y = (p / w) | 0
    if (x < sMinX) sMinX = x
    if (x > sMaxX) sMaxX = x
    if (y < sMinY) sMinY = y
    if (y > sMaxY) sMaxY = y
    if (isSkin(data[i], data[i + 1], data[i + 2])) skin[p] = 1
  }
  if (opaque === 0) throw new Error('imagem sem pixels opacos')

  const silW = sMaxX - sMinX + 1
  const silH = sMaxY - sMinY + 1
  const limitY = sMinY + silH * HEAD_ZONE

  // 2. Candidatos: manchas de pele no topo, com tamanho e forma de rosto.
  const topSkin = new Uint8Array(w * h)
  for (let y = sMinY; y <= Math.floor(limitY); y++) {
    for (let x = sMinX; x <= sMaxX; x++) {
      const p = y * w + x
      if (skin[p]) topSkin[p] = 1
    }
  }

  const candidates = blobs(topSkin, w, h, Math.max(8, opaque * MIN_AREA))
    .filter((b) => {
      const bw = b.maxX - b.minX + 1
      const bh = b.maxY - b.minY + 1
      if (b.area > opaque * MAX_AREA) return false
      if (bw > silW * MAX_WIDTH) return false
      const aspect = bw / bh
      return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT
    })
    .map((b) => ({ ...b, eyes: countEyes(b, skin, opaqueMask, w) }))
    .filter((b) => b.eyes >= MIN_EYES)

  let box
  let method
  if (candidates.length) {
    // Entre os rostos plausíveis, o mais alto é o da cabeça — os outros costumam
    // ser reflexo, um segundo personagem pequeno ou detalhe de arte.
    candidates.sort((a, b) => a.minY - b.minY || b.area - a.area)
    const f = candidates[0]
    box = { x: f.minX, y: f.minY, w: f.maxX - f.minX + 1, h: f.maxY - f.minY + 1 }
    method = `skin/${candidates.length}`
  } else {
    // Fallback: quadrado no topo-centro da silhueta, ponto de partida para o
    // ajuste manual.
    const side = Math.min(silW, silH) * 0.22
    box = { x: sMinX + silW / 2 - side / 2, y: sMinY + silH * 0.04, w: side, h: side }
    method = 'fallback'
  }

  // 3. Zoom out em torno do centro, mantendo o recorte quadrado.
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const side = Math.max(box.w, box.h) * ZOOM_OUT

  return {
    face: {
      x: +((cx - side / 2) / w).toFixed(4),
      y: +((cy - side / 2) / h).toFixed(4),
      width: +(side / w).toFixed(4),
      height: +(side / h).toFixed(4),
    },
    method,
  }
}

/** Folha de contato: os recortes lado a lado, para conferir tudo de uma vez. */
async function contactSheet(rows, dest) {
  const CELL = 150
  const COLS = 7
  const cells = []
  for (const c of rows) {
    if (!c.face) continue
    const src = join(IMG_DIR, `${c.slug}.png`)
    const meta = await sharp(src).metadata()
    // O recorte pode estourar a borda depois do zoom out; sharp não aceita isso.
    const left = Math.max(0, Math.min(Math.round(c.face.x * meta.width), meta.width - 1))
    const top = Math.max(0, Math.min(Math.round(c.face.y * meta.height), meta.height - 1))
    const width = Math.max(1, Math.min(Math.round(c.face.width * meta.width), meta.width - left))
    const height = Math.max(1, Math.min(Math.round(c.face.height * meta.height), meta.height - top))
    cells.push(
      await sharp(src)
        .extract({ left, top, width, height })
        .resize(CELL, CELL, { fit: 'contain', background: '#202028' })
        .flatten({ background: '#202028' })
        .toBuffer()
    )
  }
  await sharp({
    create: {
      width: COLS * CELL,
      height: Math.ceil(cells.length / COLS) * CELL,
      channels: 3,
      background: '#101018',
    },
  })
    .composite(cells.map((input, i) => ({ input, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL })))
    .png()
    .toFile(dest)
}

/**
 * Folha com a arte inteira, uma grade percentual e o recorte atual em destaque.
 * É a ferramenta para ajustar um rosto à mão: dá para ler as coordenadas do
 * enquadramento desejado direto da grade e escrever no JSON.
 */
async function gridSheet(rows, dest, cols = 2, cellW = 400) {
  const cells = []
  for (const c of rows) {
    const src = join(IMG_DIR, `${c.slug}.png`)
    const meta = await sharp(src).metadata()
    const cellH = Math.round((cellW * meta.height) / meta.width)

    const lines = []
    for (let i = 1; i < 10; i++) {
      const x = (cellW * i) / 10
      const y = (cellH * i) / 10
      lines.push(
        `<line x1="${x}" y1="0" x2="${x}" y2="${cellH}" stroke="#00ffcc" stroke-width="0.5" opacity="0.5"/>`,
        `<line x1="0" y1="${y}" x2="${cellW}" y2="${y}" stroke="#00ffcc" stroke-width="0.5" opacity="0.5"/>`,
        `<text x="${x + 2}" y="10" fill="#00ffcc" font-size="9" font-family="monospace">${i * 10}</text>`,
        `<text x="2" y="${y - 2}" fill="#00ffcc" font-size="9" font-family="monospace">${i * 10}</text>`
      )
    }
    if (c.face) {
      const { x, y, width, height } = c.face
      lines.push(
        `<rect x="${x * cellW}" y="${y * cellH}" width="${width * cellW}" height="${height * cellH}" fill="none" stroke="#ff3366" stroke-width="2"/>`
      )
    }
    const overlay = Buffer.from(
      `<svg width="${cellW}" height="${cellH}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}
        <text x="4" y="${cellH - 6}" fill="#ffffff" font-size="14" font-family="monospace">${c.slug}</text>
      </svg>`
    )
    cells.push({
      buf: await sharp(src)
        .resize(cellW, cellH)
        .flatten({ background: '#181820' })
        .composite([{ input: overlay }])
        .toBuffer(),
      w: cellW,
      h: cellH,
    })
  }

  const rowsN = Math.ceil(cells.length / cols)
  const cellH = Math.max(...cells.map((c) => c.h))
  await sharp({
    create: { width: cols * cellW, height: rowsN * cellH, channels: 3, background: '#101018' },
  })
    .composite(
      cells.map((c, i) => ({
        input: c.buf,
        left: (i % cols) * cellW,
        top: Math.floor(i / cols) * cellH,
      }))
    )
    .png()
    .toFile(dest)
}

/**
 * Converte um override (centro + lado em % da largura) para a caixa normalizada
 * que vai no JSON. O recorte é quadrado em pixels, então a altura normalizada
 * precisa da proporção da imagem — é isso que mantém o enquadramento igual
 * entre artes de formatos diferentes.
 */
function fromOverride({ cx, cy, size }, meta) {
  const width = size / 100
  const height = width * (meta.width / meta.height)
  return {
    x: +(cx / 100 - width / 2).toFixed(4),
    y: +(cy / 100 - height / 2).toFixed(4),
    width: +width.toFixed(4),
    height: +height.toFixed(4),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const wantContact = args.includes('--contact')
  const gridArg = args.find((a) => a.startsWith('--grid'))
  const only = args.filter((a) => !a.startsWith('--'))

  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  const rows = []

  for (const file of files) {
    const path = join(DATA_DIR, file)
    const char = JSON.parse(await readFile(path, 'utf8'))
    const selected = !only.length || only.includes(char.slug)

    const override = overrides[char.slug]
    if (selected && override) {
      const src = join(IMG_DIR, `${char.slug}.png`)
      const meta = await sharp(src).metadata()
      char.imageSize = { width: meta.width, height: meta.height }
      char.face = fromOverride(override, meta)
      char.faceLocked = true
      await writeFile(path, JSON.stringify(char, null, 2) + '\n')
      console.log(`  ${char.slug.padEnd(11)} manual`)
    } else if (selected && char.faceLocked) {
      console.log(`  ${char.slug.padEnd(11)} (locked, mantido)`)
    } else if (selected && (force || !char.face)) {
      if (!char.assets?.art) {
        console.warn(`  ! ${char.slug}: sem arte`)
      } else {
        const src = join(IMG_DIR, `${char.slug}.png`)
        const meta = await sharp(src).metadata()
        const { face, method } = await detect(src)
        char.imageSize = { width: meta.width, height: meta.height }
        char.face = face
        await writeFile(path, JSON.stringify(char, null, 2) + '\n')
        console.log(`  ${char.slug.padEnd(11)} ${method}`)
      }
    }
    rows.push(char)
  }

  rows.sort((a, b) => a.rosterOrder - b.rosterOrder)
  await writeFile(join(ROOT, 'public/characters/all.json'), JSON.stringify(rows) + '\n')

  if (wantContact) {
    const dest = join(ROOT, '.cache/face-contact.png')
    await mkdir(dirname(dest), { recursive: true })
    await contactSheet(rows, dest)
    console.log(`\nfolha de contato: ${dest}`)
  }

  if (gridArg) {
    await mkdir(join(ROOT, '.cache'), { recursive: true })
    const slugs = gridArg.includes('=') ? gridArg.split('=')[1].split(',') : null
    const picked = slugs ? rows.filter((c) => slugs.includes(c.slug)) : rows
    const cols = Number(args.find((a) => a.startsWith('--cols='))?.split('=')[1] ?? 2)
    const cell = Number(args.find((a) => a.startsWith('--cell='))?.split('=')[1] ?? 400)
    const per = cols * 2
    for (let i = 0; i < picked.length; i += per) {
      const dest = join(ROOT, `.cache/face-grid-${i / per + 1}.png`)
      await gridSheet(picked.slice(i, i + per), dest, cols, cell)
      console.log(`grade: ${dest}`)
    }
  }
  console.log(`\n${rows.filter((c) => c.face).length} rostos gravados`)
}

main()
