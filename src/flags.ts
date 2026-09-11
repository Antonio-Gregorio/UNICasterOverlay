import type { FlagManifest, FlagSpec } from './types'

let cache: Promise<FlagManifest> | null = null

export function loadFlags(): Promise<FlagManifest> {
  cache ??= fetch('/flags/index.json').then((res) => {
    if (!res.ok) throw new Error(`flags/index.json: HTTP ${res.status}`)
    return res.json() as Promise<FlagManifest>
  })
  return cache
}

export function countryFlag(manifest: FlagManifest, code: string | null): FlagSpec | null {
  if (!code) return null
  const item = manifest.countries.items.find((c) => c.code === code)
  if (!item) return null
  return {
    sheet: manifest.countries.sheet,
    index: item.index,
    columns: manifest.columns,
    rows: manifest.countries.rows,
    label: item.name,
  }
}

/**
 * O código ISO 3166-2 já diz a que país a subdivisão pertence ("BR-SP" -> BR),
 * então a bandeira do estado não depende do campo país do player. É isso que
 * permite exibir só a bandeira estadual, com o país marcado como "Nenhum".
 */
export function regionFlag(manifest: FlagManifest, regionCode: string | null): FlagSpec | null {
  if (!regionCode) return null
  const sheet = manifest.regions[countryOfRegion(regionCode)]
  const item = sheet?.items.find((r) => r.code === regionCode)
  if (!sheet || !item) return null
  return { sheet: sheet.sheet, index: item.index, columns: manifest.columns, rows: sheet.rows, label: item.name }
}

export function countryOfRegion(regionCode: string): string {
  return regionCode.split('-')[0]
}

/** Sub-regiões na ordem em que o manifesto as lista (América do Norte -> Sul). */
export function countriesBySubregion(manifest: FlagManifest) {
  const groups = new Map<string, FlagManifest['countries']['items']>()
  for (const country of manifest.countries.items) {
    const list = groups.get(country.subregion) ?? []
    list.push(country)
    groups.set(country.subregion, list)
  }
  return [...groups.entries()]
}
