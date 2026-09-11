// Baixa os sprites SD (chibi) dos personagens e grava em
// public/characters/sd/<slug>.png, registrando o caminho no JSON de cada um.
//
//   npm run data:sd
//   npm run data:sd -- --force
//
// Fonte: in-birth.fandom.com. Os nomes de arquivo lá não seguem regra — o
// elenco clássico usa "Sd-<abreviação>" com abreviações inventadas caso a caso
// ("Sd-wald", "Sd-gord", "Sd-lnd"), e os personagens novos usam outro padrão,
// "Mini <número> <Nome>". Daí o mapa explícito abaixo em vez de montar o nome.
//
// A Zohar, a mais recente, ainda não tem sprite SD na wiki: fica sem, e a
// interface cai para a arte normal.

import { mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public/characters/sd')

/**
 * Altura do maior sprite depois de aparado. Os arquivos do wiki chegam com até
 * 2000px, e o chibi é exibido em caixas de 100 a 400px — guardar o original
 * seria dezenas de MB para pixels que ninguém vê.
 *
 * Importante: o limite é do **maior**, não de cada um. Levar todo mundo para a
 * mesma altura era o que estragava a escala: um chibi agachado virava do tamanho
 * de um em pé, e o que ergue arma ficava menor que os dois. Todos são reduzidos
 * pelo mesmo fator, então a proporção entre eles é a do jogo.
 */
const SD_HEIGHT = 512
const DATA_DIR = join(ROOT, 'public/characters/data')
const API = 'https://in-birth.fandom.com/api.php'

const FILES = {
  hyde: 'Sd-hyde.png',
  linne: 'Sd-linne.png',
  waldstein: 'Sd-wald.png',
  carmine: 'Sd-car.png',
  orie: 'Sd-orie.png',
  gordeau: 'Sd-gord.png',
  merkava: 'Sd-mer.png',
  vatista: 'Sd-vat.png',
  seth: 'Sd-seth.png',
  yuzuriha: 'Sd-yuzu.png',
  hilda: 'Sd-hilda.png',
  chaos: 'Sd-cha.png',
  nanase: 'Sd-nan.png',
  byakuya: 'Sd-bya.png',
  phonon: 'Sd-pho.png',
  mika: 'Sd-mika.png',
  wagner: 'Sd-wag.png',
  enkidu: 'Sd-enk.png',
  londrekia: 'Sd-lnd.png',
  eltnum: 'Sd-elt.png',
  akatsuki: 'Sd-aka.png',
  tsurugi: 'Mini_019_Tsurugi.png',
  uzuki: 'Mini_20_uzuki.png',
  kaguya: 'Mini_022_Kaguya.png',
  kuon: 'Mini_023_Kuon.png',
  ogre: 'Mini_025_Ogre.png',
  izumi: 'Mini_026_Izumi.png',
}

const exists = (p) => access(p).then(() => true, () => false)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Resolve o endereço real do arquivo pela API do MediaWiki. */
async function fileUrl(name) {
  const url = `${API}?action=query&titles=${encodeURIComponent(`File:${name}`)}&prop=imageinfo&iiprop=url&format=json`
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

  const sizes = {}
  // Primeira passada: baixa e apara, guardando o tamanho em pixels do original.
  // A redução só pode vir depois, quando se sabe qual é o maior de todos.
  const aparados = []
  for (const [slug, name] of Object.entries(FILES)) {
    const dest = join(OUT_DIR, `${slug}.webp`)
    if (!force && (await exists(dest))) {
      sizes[slug] = await sharp(dest).metadata()
      console.log(`  ${slug.padEnd(11)} (cache)`)
      continue
    }
    const url = await fileUrl(name)
    if (!url) {
      console.warn(`  ! ${slug}: ${name} não encontrado`)
      continue
    }
    const raw = await download(url)
    if (!raw) {
      console.warn(`  ! ${slug}: download falhou`)
      continue
    }
    // Recorta a moldura transparente: os arquivos vêm com sobra em volta, e a
    // sobra é diferente em cada arquivo, então ela mesma já bagunçaria a escala.
    const trimmed = await sharp(raw).trim({ threshold: 1 }).png().toBuffer()
    const meta = await sharp(trimmed).metadata()
    aparados.push({ slug, dest, buffer: trimmed, height: meta.height })
    console.log(`  ${slug.padEnd(11)} aparado ${meta.width}x${meta.height}`)
  }

  if (aparados.length) {
    // Um fator só para todos: é o que preserva a proporção entre os chibis.
    const maior = Math.max(...aparados.map((a) => a.height))
    const fator = Math.min(1, SD_HEIGHT / maior)
    console.log(`\n  maior original: ${maior}px → fator ${fator.toFixed(3)}`)
    for (const a of aparados) {
      const out = await sharp(a.buffer)
        .resize({ height: Math.max(1, Math.round(a.height * fator)) })
        .webp({ lossless: true, effort: 6 })
        .toBuffer()
      await writeFile(a.dest, out)
      sizes[a.slug] = await sharp(out).metadata()
      console.log(`  ${a.slug.padEnd(11)} ${sizes[a.slug].width}x${sizes[a.slug].height}`)
    }
  }

  // Registra o caminho no JSON de cada personagem.
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  const rows = []
  for (const file of files) {
    const path = join(DATA_DIR, file)
    const char = JSON.parse(await readFile(path, 'utf8'))
    const meta = sizes[char.slug]
    char.assets.sd = meta ? `/characters/sd/${char.slug}.webp` : null
    char.sdSize = meta ? { width: meta.width, height: meta.height } : null
    await writeFile(path, JSON.stringify(char, null, 2) + '\n')
    rows.push(char)
  }

  rows.sort((a, b) => a.rosterOrder - b.rosterOrder)
  await writeFile(join(ROOT, 'public/characters/all.json'), JSON.stringify(rows) + '\n')

  const withSd = rows.filter((c) => c.assets.sd).length
  console.log(`\n${withSd}/${rows.length} personagens com sprite SD`)
  const missing = rows.filter((c) => !c.assets.sd).map((c) => c.slug)
  if (missing.length) console.log(`sem SD na wiki: ${missing.join(', ')}`)
}

main()
