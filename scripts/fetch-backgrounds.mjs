// Baixa os fundos de tela do UNI2 usados como preset nos gráficos de vencedores.
//
//   npm run data:backgrounds
//   npm run data:backgrounds -- --force
//
// Saída:
//   public/backgrounds/bg01.webp        fundo em tamanho de uso
//   public/backgrounds/bg01_thumb.webp  miniatura para o seletor
//   public/backgrounds/index.json       manifesto
//
// Fonte: inbirth.wiki.gg, via API do MediaWiki. As duas resoluções existem
// porque o seletor mostra os 18 de uma vez — puxar os arquivos grandes só para
// desenhar miniaturas de 140px seria desperdício de alguns MB.

import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public/backgrounds')
const CACHE_DIR = join(ROOT, '.cache/backgrounds')

const API = 'https://inbirth.wiki.gg/api.php'
const COUNT = 18
const FULL_WIDTH = 1408 // resolução nativa dos arquivos do wiki
const THUMB_WIDTH = 280

const exists = (p) => access(p).then(() => true, () => false)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function imageUrl(title) {
  const url = `${API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': 'UNICompSlide/0.1' } })
  if (!res.ok) return null
  const json = await res.json()
  const pages = Object.values(json.query?.pages ?? {})
  return pages[0]?.imageinfo?.[0]?.url ?? null
}

async function download(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'UNICompSlide/0.1' } })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    await sleep(600 * attempt)
  }
  return null
}

async function main() {
  const force = process.argv.includes('--force')
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(CACHE_DIR, { recursive: true })

  const items = []
  for (let i = 1; i <= COUNT; i++) {
    const id = String(i).padStart(2, '0')
    const title = `File:Screen_bg${id}.jpg`
    const cache = join(CACHE_DIR, `bg${id}.jpg`)
    const full = join(OUT_DIR, `bg${id}.webp`)
    const thumb = join(OUT_DIR, `bg${id}_thumb.webp`)

    if (!force && (await exists(full)) && (await exists(thumb))) {
      items.push(entry(id))
      console.log(`  bg${id} (cache)`)
      continue
    }

    let raw
    if (!force && (await exists(cache))) {
      raw = await sharp(cache).toBuffer()
    } else {
      const url = await imageUrl(title)
      if (!url) {
        console.warn(`  ! ${title}: não encontrado`)
        continue
      }
      raw = await download(url)
      if (!raw) {
        console.warn(`  ! ${title}: download falhou`)
        continue
      }
      await writeFile(cache, raw)
    }

    await sharp(raw).resize({ width: FULL_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toFile(full)
    await sharp(raw).resize({ width: THUMB_WIDTH }).webp({ quality: 74 }).toFile(thumb)
    items.push(entry(id))
    console.log(`  bg${id} ok`)
  }

  await writeFile(join(OUT_DIR, 'index.json'), JSON.stringify({ backgrounds: items }, null, 2) + '\n')
  console.log(`\n${items.length} fundos em public/backgrounds/`)
}

const entry = (id) => ({
  id: `bg${id}`,
  label: `Fundo ${Number(id)}`,
  url: `/backgrounds/bg${id}.webp`,
  thumb: `/backgrounds/bg${id}_thumb.webp`,
})

main()
