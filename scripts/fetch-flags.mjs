// Monta os sprites de bandeiras das Américas usados no cadastro de player.
//
//   npm run data:flags
//   npm run data:flags -- --force   # refaz também o que já está em cache
//
// Saída:
//   public/flags/countries.webp     todas as bandeiras nacionais (1 arquivo)
//   public/flags/regions/<cc>.webp  as subdivisões daquele país (1 arquivo por país)
//   public/flags/index.json         manifesto com nome, código e célula de cada bandeira
//
// Por que sprite: são ~300 bandeiras. Servidas soltas, abrir o seletor dispara
// centenas de requisições e o navegador engasga. Em sprite, o seletor de país
// custa 1 arquivo, e o de estado custa mais 1 — só do país escolhido. Cada
// bandeira é exibida por recorte (background-position); ver src/Flag.tsx.
//
// Fontes: flagcdn.com para as nacionais, Wikidata (P300 + P41) + Wikimedia
// Commons para as subdivisões. O resultado do SPARQL fica em .cache/ porque a
// consulta chega a levar 30s por país.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public/flags')
const REGION_DIR = join(OUT_DIR, 'regions')
const CACHE_DIR = join(ROOT, '.cache/flags')

// Célula 4:3 com a bandeira encaixada por "contain": as proporções reais variam
// (2:3, 1:2, 10:19...) e distorcer bandeira é falta de respeito com o país.
// 128x96 aguenta exibição até ~96px de altura em tela retina.
const CELL_W = 128
const CELL_H = 96
const COLUMNS = 8

const UA = 'UNICompSlide/0.1 (tournament tooling; https://github.com/)'

/**
 * Países e territórios das Américas, em ordem de sub-região. Lista fixa de
 * propósito: não muda na prática, e a API que serviria isso (restcountries v3)
 * foi descontinuada no meio do caminho.
 */
const COUNTRIES = [
  ['CA', 'Canadá', 'América do Norte'],
  ['US', 'Estados Unidos', 'América do Norte'],
  ['MX', 'México', 'América do Norte'],
  ['GL', 'Groenlândia', 'América do Norte'],
  ['PM', 'Saint-Pierre e Miquelon', 'América do Norte'],

  ['BZ', 'Belize', 'América Central'],
  ['CR', 'Costa Rica', 'América Central'],
  ['SV', 'El Salvador', 'América Central'],
  ['GT', 'Guatemala', 'América Central'],
  ['HN', 'Honduras', 'América Central'],
  ['NI', 'Nicarágua', 'América Central'],
  ['PA', 'Panamá', 'América Central'],

  ['AG', 'Antígua e Barbuda', 'Caribe'],
  ['AI', 'Anguilla', 'Caribe'],
  ['AW', 'Aruba', 'Caribe'],
  ['BB', 'Barbados', 'Caribe'],
  ['BL', 'São Bartolomeu', 'Caribe'],
  ['BM', 'Bermudas', 'Caribe'],
  ['BQ', 'Países Baixos Caribenhos', 'Caribe'],
  ['BS', 'Bahamas', 'Caribe'],
  ['CU', 'Cuba', 'Caribe'],
  ['CW', 'Curaçao', 'Caribe'],
  ['DM', 'Dominica', 'Caribe'],
  ['DO', 'República Dominicana', 'Caribe'],
  ['GD', 'Granada', 'Caribe'],
  ['GP', 'Guadalupe', 'Caribe'],
  ['HT', 'Haiti', 'Caribe'],
  ['JM', 'Jamaica', 'Caribe'],
  ['KN', 'São Cristóvão e Névis', 'Caribe'],
  ['KY', 'Ilhas Cayman', 'Caribe'],
  ['LC', 'Santa Lúcia', 'Caribe'],
  ['MF', 'São Martinho', 'Caribe'],
  ['MQ', 'Martinica', 'Caribe'],
  ['MS', 'Montserrat', 'Caribe'],
  ['PR', 'Porto Rico', 'Caribe'],
  ['SX', 'Sint Maarten', 'Caribe'],
  ['TC', 'Turcas e Caicos', 'Caribe'],
  ['TT', 'Trinidad e Tobago', 'Caribe'],
  ['VC', 'São Vicente e Granadinas', 'Caribe'],
  ['VG', 'Ilhas Virgens Britânicas', 'Caribe'],
  ['VI', 'Ilhas Virgens Americanas', 'Caribe'],

  ['AR', 'Argentina', 'América do Sul'],
  ['BO', 'Bolívia', 'América do Sul'],
  ['BR', 'Brasil', 'América do Sul'],
  ['CL', 'Chile', 'América do Sul'],
  ['CO', 'Colômbia', 'América do Sul'],
  ['EC', 'Equador', 'América do Sul'],
  ['FK', 'Ilhas Malvinas', 'América do Sul'],
  ['GF', 'Guiana Francesa', 'América do Sul'],
  ['GY', 'Guiana', 'América do Sul'],
  ['PE', 'Peru', 'América do Sul'],
  ['PY', 'Paraguai', 'América do Sul'],
  ['SR', 'Suriname', 'América do Sul'],
  ['UY', 'Uruguai', 'América do Sul'],
  ['VE', 'Venezuela', 'América do Sul'],
]

const exists = (p) => access(p).then(() => true, () => false)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchBuffer(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    if (res.status === 404) return null
    await sleep(700 * attempt)
  }
  return null
}

/** Baixa uma vez e reaproveita: rodar o script de novo não repete a rede. */
async function cached(key, fetcher) {
  const path = join(CACHE_DIR, key)
  await mkdir(dirname(path), { recursive: true })
  if (await exists(path)) return readFile(path)
  const buf = await fetcher()
  if (!buf) return null
  await writeFile(path, buf)
  return buf
}

// ------------------------------------------------------------ subdivisões

const SPARQL = (cc) => `
SELECT ?code ?label ?flag WHERE {
  ?country wdt:P297 "${cc}" .
  ?item wdt:P17 ?country ; wdt:P300 ?code ; wdt:P41 ?flag .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pt-br,pt,en". ?item rdfs:label ?label }
}`

/**
 * Subdivisões do país com bandeira própria, via Wikidata. Só interessam códigos
 * no formato ISO 3166-2 do próprio país ("BR-SP"): a consulta também traz
 * territórios associados, que são países na nossa lista e não estados.
 */
async function fetchSubdivisions(cc) {
  const raw = await cached(`sparql/${cc}.json`, async () => {
    const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(SPARQL(cc))
    return fetchBuffer(url + '&format=json')
  })
  if (!raw) return []

  let rows
  try {
    rows = JSON.parse(raw.toString()).results.bindings
  } catch {
    return []
  }

  const byCode = new Map()
  for (const r of rows) {
    const code = r.code.value
    if (!code.startsWith(`${cc}-`)) continue
    // Wikidata às vezes tem mais de uma bandeira por entidade (histórica,
    // variante). A primeira em ordem alfabética de arquivo é estável entre runs.
    const prev = byCode.get(code)
    if (!prev || r.flag.value < prev.flag) {
      byCode.set(code, { code, name: r.label.value, flag: r.flag.value })
    }
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

// ------------------------------------------------------------ sprite

/** Encaixa a bandeira na célula preservando proporção, sobre fundo transparente. */
async function toCell(buffer) {
  return sharp(buffer)
    .resize(CELL_W, CELL_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
}

async function buildSheet(cells, destPath) {
  const rows = Math.ceil(cells.length / COLUMNS)
  const composite = await Promise.all(
    cells.map(async (buf, i) => ({
      input: await toCell(buf),
      left: (i % COLUMNS) * CELL_W,
      top: Math.floor(i / COLUMNS) * CELL_H,
    }))
  )
  await sharp({
    create: {
      width: COLUMNS * CELL_W,
      height: rows * CELL_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .webp({ lossless: true, effort: 6 }) // bandeira é área chapada + borda nítida: lossy sujaria
    .toFile(destPath)
  return rows
}

// ------------------------------------------------------------ pipeline

async function main() {
  const force = process.argv.includes('--force')
  if (force) console.log('(--force: ignorando cache de imagens)\n')

  await mkdir(REGION_DIR, { recursive: true })
  await mkdir(CACHE_DIR, { recursive: true })

  // 1. Bandeiras nacionais -> um único sprite.
  const countryCells = []
  const countryItems = []
  for (const [code, name, subregion] of COUNTRIES) {
    const cc = code.toLowerCase()
    const key = `country/${cc}.png`
    if (force) await rmCache(key)
    const buf = await cached(key, () => fetchBuffer(`https://flagcdn.com/w320/${cc}.png`))
    if (!buf) {
      console.warn(`  ! ${code}: sem bandeira nacional`)
      continue
    }
    countryItems.push({ code, name, subregion, index: countryCells.length, regions: 0 })
    countryCells.push(buf)
  }
  const countryRows = await buildSheet(countryCells, join(OUT_DIR, 'countries.webp'))
  console.log(`countries.webp: ${countryItems.length} bandeiras (${COLUMNS}x${countryRows})\n`)

  // 2. Subdivisões -> um sprite por país.
  const regions = {}
  for (const item of countryItems) {
    const cc = item.code
    const subs = await fetchSubdivisions(cc)
    if (!subs.length) continue

    const cells = []
    const items = []
    for (const sub of subs) {
      const key = `region/${cc}/${sub.code}.png`
      if (force) await rmCache(key)
      // Special:FilePath rasteriza o SVG do Commons no tamanho pedido.
      const url = `${sub.flag.replace(/^http:/, 'https:')}?width=${CELL_W * 2}`
      const buf = await cached(key, () => fetchBuffer(url))
      if (!buf) {
        console.warn(`  ! ${sub.code}: bandeira indisponível`)
        continue
      }
      items.push({ code: sub.code, name: sub.name, index: cells.length })
      cells.push(buf)
    }
    if (!items.length) continue

    const rows = await buildSheet(cells, join(REGION_DIR, `${cc.toLowerCase()}.webp`))
    regions[cc] = { sheet: `/flags/regions/${cc.toLowerCase()}.webp`, rows, items }
    item.regions = items.length
    console.log(`  ${cc}: ${items.length} subdivisões`)
  }

  // 3. Manifesto.
  const manifest = {
    cell: { width: CELL_W, height: CELL_H },
    columns: COLUMNS,
    countries: { sheet: '/flags/countries.webp', rows: countryRows, items: countryItems },
    regions,
  }
  await writeFile(join(OUT_DIR, 'index.json'), JSON.stringify(manifest) + '\n')

  const totalRegions = Object.values(regions).reduce((n, r) => n + r.items.length, 0)
  console.log(
    `\n${countryItems.length} países, ${totalRegions} subdivisões em ${Object.keys(regions).length} sprites`
  )
}

async function rmCache(key) {
  const { rm } = await import('node:fs/promises')
  await rm(join(CACHE_DIR, key), { force: true })
}

main()
