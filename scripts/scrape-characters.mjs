// Baixa a arte oficial + os metadados de todos os personagens de
// UNDER NIGHT IN-BIRTH II Sys:Celes a partir do site da Arc System Works.
//
//   npm run data:scrape
//
// Saída:
//   public/characters/images/<slug>.png        arte principal (transparente)
//   public/characters/images/<slug>_sp.png     arte vertical (quando existe)
//   public/characters/images/<slug>_catch.svg  tagline oficial (quando existe)
//   public/characters/data/<slug>.json         metadados (cores: ver extract-colors)
//
// Idempotente: imagens já baixadas não são rebaixadas e as cores gravadas no
// JSON sobrevivem a um re-scrape.
//
// O HTML do site é malformado em vários pontos (<dd> fechado com </dt>, <dd/>
// solto, classe extra em .txt, "kuon" em caixa baixa). Os parsers abaixo são
// tolerantes de propósito — não "conserte" as regex para o HTML ideal.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const IMG_DIR = join(ROOT, 'public/characters/images')
const DATA_DIR = join(ROOT, 'public/characters/data')

const SITE = 'https://www.arcsystemworks.jp/uni2celes'
const INDEX = `${SITE}/en/character/`

const exists = (p) => access(p).then(() => true, () => false)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res
    if (res.status === 404) return null
    await sleep(500 * attempt)
  }
  throw new Error(`falha ao buscar ${url}`)
}

/** Slugs na ordem em que o site os apresenta (roster order). */
async function fetchRoster() {
  const html = await (await get(INDEX)).text()
  // A grid vem quebrada em vários <ul class="character_list"> (um por linha).
  const list = [...html.matchAll(/<ul class="character_list">([\s\S]*?)<\/ul>/g)]
    .map((m) => m[1])
    .join('')
  return [...new Set([...list.matchAll(/href="([a-z0-9_]+)\.php"/g)].map((m) => m[1]))]
}

const strip = (s) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()

/** Aceita </dd> ou </dt> como fechamento, e o <dd/> solto da página do Seth. */
function parseProfile(html) {
  const block = html.match(/<dl class="profile">([\s\S]*?)<\/dl>/)?.[1] ?? ''
  const out = {}
  for (const m of block.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd\s*\/?>([\s\S]*?)<\/(?:dd|dt)>/g)) {
    out[strip(m[1]).toLowerCase()] = strip(m[2])
  }
  return out
}

/**
 * Resolve as URLs de arte a partir do markup: .pc é a arte larga e .sp a
 * vertical, mas nem todo personagem tem as duas e alguns fogem do padrão
 * <slug>_sp.png — por isso lemos do HTML em vez de montar o nome.
 */
function artUrls(html) {
  const abs = (rel) => new URL(rel.replace(/^(\.\.\/)+/, ''), `${SITE}/`).href
  const fig = html.match(/<figure class="chara_[^"]*">([\s\S]*?)<\/figure>/)?.[1] ?? ''
  const imgs = [...fig.matchAll(/<img\s+src="([^"]+)"[^>]*>/g)].map((m) => ({
    src: m[1],
    cls: /class="sp"/.test(m[0]) ? 'sp' : /class="pc"/.test(m[0]) ? 'pc' : null,
  }))
  const landscape = imgs.find((i) => i.cls === 'pc')?.src ?? imgs[0]?.src ?? null
  const portrait = imgs.find((i) => i.cls === 'sp')?.src ?? null
  const catchphrase = html.match(/<p class="copy_txt"><img src="([^"]+)"/)?.[1] ?? null
  return {
    landscape: landscape && abs(landscape),
    portrait: portrait && abs(portrait),
    catchphrase: catchphrase && abs(catchphrase),
  }
}

function parseCharacter(slug, html) {
  const nameBlock = html.match(/<div class="name">([\s\S]*?)<\/div>/)?.[1] ?? ''
  // O site escreve "kuon" em caixa baixa; o resto do roster vem capitalizado.
  const raw = strip(nameBlock.split('<p class="voice">')[0])
  const name = raw ? raw[0].toUpperCase() + raw.slice(1) : slug
  const voice = strip(nameBlock.match(/<p class="voice">([\s\S]*?)<\/p>/)?.[1] ?? '').replace(/^CV\s*/, '')
  const p = parseProfile(html)

  return {
    slug,
    name,
    voiceActor: voice || null,
    profile: {
      height: p.height ?? null,
      weight: p.weight ?? null,
      birthday: p.birth ?? null,
      bloodType: p.blood ?? null,
      ability: p.ability ?? null, // EXS
      weapon: p.weapon ?? null,
    },
    // A bio às vezes vem como class="txt en_long".
    bio: strip(html.match(/<p class="txt[^"]*">([\s\S]*?)<\/p>/)?.[1] ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    assets: { art: null, artPortrait: null, catchphrase: null },
    colors: null, // preenchido por scripts/extract-colors.mjs
    source: `${SITE}/en/character/${slug}.php`,
    scrapedAt: new Date().toISOString().slice(0, 10),
  }
}

async function download(url, dest) {
  if (!url) return 'missing'
  if (await exists(dest)) return 'cache'
  const res = await get(url)
  if (!res) return 'missing'
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
  return 'ok'
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true })
  await mkdir(DATA_DIR, { recursive: true })

  const roster = await fetchRoster()
  console.log(`roster: ${roster.length} personagens\n`)

  const index = []
  for (const [i, slug] of roster.entries()) {
    const res = await get(`${SITE}/en/character/${slug}.php`)
    if (!res) {
      console.warn(`  ! ${slug}: página não encontrada`)
      continue
    }
    const html = await res.text()

    const char = parseCharacter(slug, html)
    char.rosterOrder = i + 1

    const urls = artUrls(html)
    const art = await download(urls.landscape, join(IMG_DIR, `${slug}.png`))
    const sp = await download(urls.portrait, join(IMG_DIR, `${slug}_sp.png`))
    const cat = await download(urls.catchphrase, join(IMG_DIR, `${slug}_catch.svg`))

    if (art !== 'missing') char.assets.art = `/characters/images/${slug}.png`
    if (sp !== 'missing') char.assets.artPortrait = `/characters/images/${slug}_sp.png`
    if (cat !== 'missing') char.assets.catchphrase = `/characters/images/${slug}_catch.svg`

    // Preserva cores já ajustadas à mão em execuções anteriores.
    const dest = join(DATA_DIR, `${slug}.json`)
    if (await exists(dest)) {
      const prev = JSON.parse(await readFile(dest, 'utf8'))
      if (prev.colors) char.colors = prev.colors
      if (prev.colorsLocked) char.colorsLocked = prev.colorsLocked
    }

    await writeFile(dest, JSON.stringify(char, null, 2) + '\n')
    index.push({ slug, name: char.name, rosterOrder: char.rosterOrder })
    console.log(
      `  ${String(i + 1).padStart(2)}. ${char.name.padEnd(11)} art:${art.padEnd(7)} sp:${sp.padEnd(7)} catch:${cat}`
    )
  }

  await writeFile(join(DATA_DIR, '_index.json'), JSON.stringify(index, null, 2) + '\n')
  console.log(`\n${index.length} personagens gravados em public/characters/`)
}

main()
