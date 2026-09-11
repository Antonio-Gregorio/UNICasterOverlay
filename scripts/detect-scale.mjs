// Escala de cada personagem: o que faz o elenco sair do mesmo tamanho.
//
//   npm run data:scale
//   npm run data:scale -- --contact   # folhas de conferência (arte e chibi)
//
// O problema: as artes oficiais e os chibis vêm em enquadramentos e resoluções
// diferentes. Encaixando cada imagem na moldura ("contain"), o tamanho aparente
// vira sorteio — a cabeça variava 2,2x entre o maior e o menor, e o Akatsuki,
// de pose ereta, saía gigante ao lado de quem posa agachado.
//
// A régua é diferente para cada imagem, porque o que é constante em cada uma é
// diferente:
//
// - **Arte oficial**: a caixa de rosto marcada à mão (`face`). Ela é quadrada em
//   pixels em todos os 28, então serve de unidade: a moldura de referência tem
//   tamanho fixo em "cabeças", e todo mundo sai com a mesma cabeça. Poses variam
//   demais (agachado, voando, chutando) para medir o corpo.
//
// - **Chibi**: não dá para medir rosto — tentei pele na linha dos olhos e o
//   detector pegava braço e perna (11x de variação, e 5 personagens sem pele
//   nenhuma). Mas a pose do chibi é padronizada, em pé e de frente, então
//   **dos olhos até os pés** é uma régua estável. Aqui ela não vira número no
//   JSON: o script **redimensiona o próprio sprite** para todos ficarem na
//   mesma escala, e o desenho passa a ser regra de três com o tamanho do
//   arquivo. Dois chibis lado a lado já saem proporcionais em qualquer lugar
//   que os use.
//
// Por que não a altura do sprite: ela inclui o que estiver acima da cabeça —
// chapéu da Uzuki, auréola da Vatista, arma erguida. Normalizando por altura,
// quem levanta a espada encolhe.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HERE = dirname(fileURLToPath(import.meta.url))
const IMG_DIR = join(ROOT, 'public/characters/images')
const SD_DIR = join(ROOT, 'public/characters/sd')
const DATA_DIR = join(ROOT, 'public/characters/data')

/** Multiplicadores à mão: { slug: { art?: 1.1, sd?: 0.9 } }. */
const overrides = JSON.parse(await readFile(join(HERE, 'scale-overrides.json'), 'utf8'))

/** Estes precisam bater com src/portrait.ts. */
const ART = { width: 5.3, height: 8.6 } // moldura de referência, em cabeças
const ANCHOR_AT = { x: 0.5, y: 0.25 }

/**
 * Olhos até os pés, em pixels, que todo chibi passa a ter depois da
 * normalização. É a escala gravada no próprio arquivo: com todos na mesma
 * régua, o desenho vira uma regra de três com o tamanho do sprite, e o JSON não
 * precisa mais carregar número nenhum por personagem.
 *
 * 210 mantém os chibis do tamanho em que já estavam.
 */
const SD_FEET_PX = 210

/**
 * Altura de sprite equivalente à altura da moldura. Sai de SD_FEET_PX e do
 * enquadramento (1,45 "olhos→pés" abaixo da linha dos olhos, que fica a 25%):
 * 210 × 1,45 ÷ 0,75. Precisa bater com SD_UNIT em src/portrait.ts.
 */
const SD_UNIT = Math.round((SD_FEET_PX * 1.45) / (1 - ANCHOR_AT.y))

const MIN_ALPHA = 128

/**
 * Distância dos olhos até os pés, em fração da altura do sprite.
 *
 * O pé é a última linha com corpo de verdade: linhas com um punhado de pixels
 * são ponta de arma ou fio de cabelo, e deixá-las contar esticava a régua.
 */
async function feetOf(source, anchor) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels
  const minRun = Math.max(2, info.width * 0.02)
  let bottom = 0
  let top = -1
  for (let y = 0; y < info.height; y++) {
    let n = 0
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * ch + 3] >= MIN_ALPHA) n++
    if (n >= minRun) {
      bottom = y
      if (top < 0) top = y
    }
  }
  if (top < 0) top = 0
  return {
    // Do ponto dos olhos até o topo e até os pés, em fração da altura da imagem.
    body: {
      above: +(anchor.y - top / info.height).toFixed(4),
      below: +(bottom / info.height - anchor.y).toFixed(4),
    },
    px: bottom - anchor.y * info.height,
    info,
  }
}

/**
 * Redimensiona o sprite para todos ficarem na mesma escala.
 *
 * A alternativa seria guardar um número por personagem e corrigir na hora de
 * desenhar — foi assim antes. Gravando no arquivo, quem consome o sprite não
 * precisa saber de nada: dois chibis lado a lado já saem proporcionais, aqui, na
 * topbar ou em qualquer coisa que venha depois.
 *
 * Não preenche a moldura até uma tela comum de propósito: a maior precisaria de
 * 366x399, por causa das foices do Byakuya e da lança da Orie, e encaixar essa
 * tela numa moldura encolheria o chibi típico em 30%. Cada um continua no seu
 * recorte justo — o que sobra dos extremos é cortado pela moldura, não pelo
 * arquivo.
 *
 * Idempotente: na segunda passada o fator dá 1 e o arquivo não é reescrito, o
 * que também evita reamostrar a imagem várias vezes.
 */
async function normalize(file, anchor, manual) {
  // Lê tudo para memória antes: no Windows, o sharp segura o arquivo aberto e
  // gravar por cima do mesmo caminho falha.
  const original = await readFile(file)
  const medida = await feetOf(original, anchor)
  if (medida.px <= 0) return { size: medida.info, body: medida.body, factor: 1, changed: false }

  const target = SD_FEET_PX * manual
  const factor = target / medida.px
  // 1,5% é ruído de arredondamento: a linha do pé é um inteiro, e reamostrar de
  // novo por 3px só degradaria a imagem a cada rodada.
  if (Math.abs(factor - 1) < 0.015) {
    return { size: medida.info, body: medida.body, factor: 1, changed: false }
  }

  const out = await sharp(original)
    .resize({ height: Math.max(1, Math.round(medida.info.height * factor)) })
    .webp({ lossless: true, effort: 6 })
    .toBuffer()
  await writeFile(file, out)
  // Remede no arquivo novo: as frações mudam com o arredondamento da altura.
  const depois = await feetOf(out, anchor)
  return { size: depois.info, body: depois.body, factor, changed: true }
}

// --- folhas de contato -------------------------------------------------------

const CELL = { width: 219, height: 339 }

/** Onde a arte é desenhada, com a mesma conta de src/portrait.ts. */
function place(char, kind, box) {
  if (kind === 'art') {
    const aspect = char.imageSize.width / char.imageSize.height
    const width = Math.min(
      box.width / (ART.width * char.face.width),
      (box.height * aspect) / (ART.height * char.face.height)
    ) * (char.artScale ?? 1)
    // De corpo inteiro vale o centro próprio de quem tem um — igual ao app.
    return {
      width,
      height: width / aspect,
      anchor: char.bodyAnchor ?? char.anchor ?? { x: 0.5, y: 0.35 },
    }
  }
  // Depois de normalizado, o desenho é regra de três com o tamanho do sprite.
  const aspect = char.sdSize.width / char.sdSize.height
  const height = (box.height * char.sdSize.height) / SD_UNIT
  return { width: height * aspect, height, anchor: char.sdAnchor }
}

async function tile(char, kind, box) {
  const file = kind === 'art' ? join(IMG_DIR, `${char.slug}.png`) : join(SD_DIR, `${char.slug}.webp`)
  const p = place(char, kind, box)
  const x = ANCHOR_AT.x * box.width - p.anchor.x * p.width
  const y = ANCHOR_AT.y * box.height - p.anchor.y * p.height

  const rw = Math.max(1, Math.round(p.width))
  const rh = Math.max(1, Math.round(p.height))
  const sx = Math.max(0, Math.round(-x))
  const sy = Math.max(0, Math.round(-y))
  const dx = Math.max(0, Math.round(x))
  const dy = Math.max(0, Math.round(y))
  const sw = Math.min(rw - sx, box.width - dx)
  const sh = Math.min(rh - sy, box.height - dy)

  const layers = []
  if (sw > 0 && sh > 0) {
    layers.push({
      input: await sharp(file)
        .resize({ width: rw, height: rh })
        .extract({ left: sx, top: sy, width: sw, height: sh })
        .png()
        .toBuffer(),
      top: dy,
      left: dx,
    })
  }
  layers.push({
    input: Buffer.from(`<svg width="${box.width}" height="${box.height}">
      <rect x="1.5" y="1.5" width="${box.width - 3}" height="${box.height - 3}" rx="10" fill="none" stroke="#e66d9f" stroke-width="3"/>
      <line x1="0" y1="${box.height * ANCHOR_AT.y}" x2="${box.width}" y2="${box.height * ANCHOR_AT.y}" stroke="#4ade80" stroke-width="1" opacity="0.7"/>
      <text x="7" y="17" font-family="monospace" font-size="13" fill="#ffffff">${char.slug}</text>
    </svg>`),
    top: 0,
    left: 0,
  })

  return sharp({
    create: { width: box.width, height: box.height, channels: 4, background: { r: 24, g: 22, b: 34, alpha: 1 } },
  })
    .composite(layers)
    .png()
    .toBuffer()
}

async function contactSheet(rows, kind, dest) {
  const box = { x: 0, y: 0, ...CELL }
  const cols = 7
  const pad = 8
  const usable = rows.filter((c) =>
    kind === 'art' ? c.face && c.anchor && c.imageSize : c.assets?.sd && c.sdAnchor && c.sdSize
  )
  const tiles = []
  for (let i = 0; i < usable.length; i++) {
    tiles.push({
      input: await tile(usable[i], kind, box),
      top: Math.floor(i / cols) * (box.height + pad),
      left: (i % cols) * (box.width + pad),
    })
  }
  await sharp({
    create: {
      width: cols * (box.width + pad),
      height: Math.ceil(usable.length / cols) * (box.height + pad),
      channels: 3,
      background: { r: 12, g: 12, b: 18 },
    },
  })
    .composite(tiles)
    .png()
    .toFile(dest)
}

/**
 * Fração da arte que é **corpo sólido**, de 0 a 1.
 *
 * É a régua da apresentação, ao lado da cabeça: área não muda quando a pose
 * inclina, e altura muda. A arte do Hyde é um plano afastado com espada e rastro
 * longos — mede quase 800px de altura e ele mesmo é pequeno ali dentro; a da
 * Linne é um plano fechado onde quase tudo é ela. Medindo altura, a Linne saía
 * "gigante" ao lado dele estando mais baixa.
 *
 * Alfa >= 200 de propósito: brilho e rastro são semitransparentes e não são
 * corpo. A imagem entra reduzida a 400px — a fração não depende da resolução, e
 * contar pixel a pixel na arte inteira custaria caro por nada.
 */
async function solidFraction(file) {
  const { data, info } = await sharp(file)
    .resize({ width: 400 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let solidos = 0
  for (let i = 3; i < data.length; i += info.channels) if (data[i] >= 200) solidos++
  return +(solidos / (info.width * info.height)).toFixed(4)
}

async function main() {
  const args = process.argv.slice(2)
  const wantContact = args.includes('--contact')
  const only = args.filter((a) => !a.startsWith('--'))

  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  const rows = []

  for (const file of files) {
    const path = join(DATA_DIR, file)
    const char = JSON.parse(await readFile(path, 'utf8'))
    const selected = !only.length || only.includes(char.slug)
    const o = overrides[char.slug] ?? {}

    if (selected) {
      // A caixa do corpo não é mais usada no desenho: a régua é a cabeça.
      delete char.fit
      delete char.fitLocked

      char.artScale = o.art ?? 1
      char.artSolid = char.assets.art ? await solidFraction(join(IMG_DIR, `${char.slug}.png`)) : null
      char.sdSolid = char.assets.sd ? await solidFraction(join(SD_DIR, `${char.slug}.webp`)) : null
      /**
       * **Exceção** à régua da apresentação, não a régua.
       *
       * A régua vive em src/anim/AnimStage.tsx e é a média geométrica de cabeça
       * e área. Isto aqui é só para o caso que ela erra — hoje, a Wagner, cujo
       * manto conta como corpo na área e a encolhe.
       *
       * Separada de `art` porque `art` também vale para os retratos do gráfico
       * de vencedores, e corrigir uma tela não pode mexer na outra.
       */
      char.animScale = o.anim ?? 1
      delete char.sdScale

      // Corpo medido a partir do ponto dos olhos, nas duas imagens. Não é
      // escala: é o que permite desenhar dois personagens com a **mesma altura
      // de corpo**, que é o que a faixa do líder precisa.
      if (char.anchor) {
        const { body } = await feetOf(join(IMG_DIR, `${char.slug}.png`), char.bodyAnchor ?? char.anchor)
        char.artBody = body
      }

      // A escala do chibi não fica no JSON: vai gravada no próprio arquivo.
      let nota = '  (sem chibi)'
      if (char.assets?.sd && char.sdAnchor) {
        const { size, body, factor, changed } = await normalize(
          join(SD_DIR, `${char.slug}.webp`),
          char.sdAnchor,
          o.sd ?? 1
        )
        char.sdSize = { width: size.width, height: size.height }
        char.sdBody = body
        nota = changed
          ? `  chibi x${factor.toFixed(3)} → ${size.width}x${size.height}`
          : `  chibi já normalizado (${size.width}x${size.height})`
      } else {
        char.sdBody = null
      }
      await writeFile(path, JSON.stringify(char, null, 2) + '\n')
      console.log(
        `  ${char.slug.padEnd(11)} cabeça ${(char.face?.width ?? 0).toFixed(2)}` +
          nota +
          (o.art || o.sd || o.anim ? `  manual ${JSON.stringify(o)}` : '')
      )
    }
    rows.push(char)
  }

  rows.sort((a, b) => a.rosterOrder - b.rosterOrder)
  await writeFile(join(ROOT, 'public/characters/all.json'), JSON.stringify(rows) + '\n')

  if (wantContact) {
    await mkdir(join(ROOT, '.cache'), { recursive: true })
    await contactSheet(rows, 'art', join(ROOT, '.cache/scale-art.png'))
    await contactSheet(rows, 'sd', join(ROOT, '.cache/scale-sd.png'))
    console.log('\n.cache/scale-art.png e .cache/scale-sd.png')
  }

  console.log(`
${rows.filter((c) => c.assets?.sd).length} chibis na mesma escala`)
}

main()
