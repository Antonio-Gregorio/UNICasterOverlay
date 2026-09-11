// Grava o ponto de centralização de cada personagem nos JSONs.
//
//   npm run data:anchors
//   npm run data:anchors -- --contact   # folhas de conferência com a cruz
//
// O ponto fica logo abaixo dos olhos — é o que o olho humano usa como centro de
// um rosto. Ao montar topbar ou gráfico, esse ponto é levado a 50% da largura e
// 25% da altura do bloco, e com isso todos os personagens ficam alinhados entre
// si, apesar de cada arte ter o personagem numa pose e posição diferentes.
//
// Dois pontos por personagem: um na arte oficial e outro no sprite SD, que tem
// enquadramento completamente diferente (cabeça enorme, corpo pequeno).
//
// Os valores ficam em scripts/anchor-overrides.json, em % da largura e da
// altura da respectiva imagem.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(ROOT, 'public/characters/data')
const IMG_DIR = join(ROOT, 'public/characters/images')
const SD_DIR = join(ROOT, 'public/characters/sd')

const overrides = JSON.parse(await readFile(join(HERE, 'anchor-overrides.json'), 'utf8'))

/** Cruz vermelha sobre o ponto, para conferir no olho. */
function crossOverlay(w, h, x, y) {
  const cx = (x / 100) * w
  const cy = (y / 100) * h
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="#ff2d6f" stroke-width="1.5" opacity="0.65"/>
      <line x1="0" y1="${cy}" x2="${w}" y2="${cy}" stroke="#ff2d6f" stroke-width="1.5" opacity="0.65"/>
      <circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="#ff2d6f" stroke-width="2"/>
     </svg>`
  )
}

/** Folha com os pontos marcados, lado a lado. */
async function contactSheet(entries, dest, cell = 190, cols = 7) {
  const cells = []
  for (const { file, point, crop } of entries) {
    const meta = await sharp(file).metadata()
    let pipeline = sharp(file)
    let w = meta.width
    let h = meta.height
    let px = point.x
    let py = point.y

    if (crop) {
      // Recorta em volta do ponto para conferir a mira de perto.
      const side = Math.round(Math.min(meta.width, meta.height) * crop)
      const left = Math.max(0, Math.min(Math.round((point.x / 100) * meta.width - side / 2), meta.width - side))
      const top = Math.max(0, Math.min(Math.round((point.y / 100) * meta.height - side / 2), meta.height - side))
      pipeline = sharp(file).extract({ left, top, width: side, height: side })
      w = side
      h = side
      px = (((point.x / 100) * meta.width - left) / side) * 100
      py = (((point.y / 100) * meta.height - top) / side) * 100
    }

    const base = await pipeline
      .resize(cell, cell, { fit: 'contain', background: '#202028' })
      .flatten({ background: '#202028' })
      .toBuffer()
    const scaled = { w: cell, h: cell }
    // O `contain` centraliza a imagem na célula, então a cruz precisa seguir.
    const imgAspect = w / h
    const drawW = imgAspect >= 1 ? cell : cell * imgAspect
    const drawH = imgAspect >= 1 ? cell / imgAspect : cell
    const offX = (scaled.w - drawW) / 2
    const offY = (scaled.h - drawH) / 2
    const cross = crossOverlay(cell, cell, ((offX + (px / 100) * drawW) / cell) * 100, ((offY + (py / 100) * drawH) / cell) * 100)
    cells.push(await sharp(base).composite([{ input: cross }]).toBuffer())
  }

  await sharp({
    create: {
      width: cols * cell,
      height: Math.ceil(cells.length / cols) * cell,
      channels: 3,
      background: '#101018',
    },
  })
    .composite(cells.map((input, i) => ({ input, left: (i % cols) * cell, top: Math.floor(i / cols) * cell })))
    .png()
    .toFile(dest)
}

async function main() {
  const wantContact = process.argv.includes('--contact')
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  const rows = []
  const fullEntries = []
  const sdEntries = []

  for (const file of files) {
    const path = join(DATA_DIR, file)
    const char = JSON.parse(await readFile(path, 'utf8'))
    const o = overrides[char.slug]
    if (!o) {
      console.warn(`  ! ${char.slug}: sem override`)
      rows.push(char)
      continue
    }

    char.anchor = { x: +(o.full.x / 100).toFixed(4), y: +(o.full.y / 100).toFixed(4) }
    // Alguns personagens precisam de outro centro quando aparecem de corpo
    // inteiro: a mira que enquadra bem o rosto numa topbar deixa a figura torta
    // no quadro do gráfico. Quem não tem "body" usa o mesmo ponto do rosto.
    char.bodyAnchor = o.body
      ? { x: +(o.body.x / 100).toFixed(4), y: +(o.body.y / 100).toFixed(4) }
      : null
    char.sdAnchor = char.assets.sd ? { x: +(o.sd.x / 100).toFixed(4), y: +(o.sd.y / 100).toFixed(4) } : null
    await writeFile(path, JSON.stringify(char, null, 2) + '\n')
    rows.push(char)

    fullEntries.push({ file: join(IMG_DIR, `${char.slug}.png`), point: o.full, crop: 0.3 })
    if (char.assets.sd) sdEntries.push({ file: join(SD_DIR, `${char.slug}.webp`), point: o.sd })
  }

  rows.sort((a, b) => a.rosterOrder - b.rosterOrder)
  await writeFile(join(ROOT, 'public/characters/all.json'), JSON.stringify(rows) + '\n')

  if (wantContact) {
    await mkdir(join(ROOT, '.cache'), { recursive: true })
    await contactSheet(fullEntries, join(ROOT, '.cache/anchor-full.png'))
    await contactSheet(sdEntries, join(ROOT, '.cache/anchor-sd.png'))
    console.log('\n.cache/anchor-full.png e .cache/anchor-sd.png')
  }

  console.log(`\n${rows.filter((c) => c.anchor).length} pontos gravados`)
}

main()
