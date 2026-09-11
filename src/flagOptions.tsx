import { BADGE_HEIGHT, Flag, FLAG_ASPECT } from './Flag'
import { countriesBySubregion } from './flags'
import type { SelectOption } from './components/Select'
import type { FlagManifest } from './types'

/** Caixa vazia do tamanho de uma bandeira, para a opção "Nenhum" não desalinhar. */
export function EmptyFlag() {
  return (
    <span
      className="flag flag--none"
      aria-hidden="true"
      style={{ width: BADGE_HEIGHT * FLAG_ASPECT, height: BADGE_HEIGHT }}
    />
  )
}

export function countryOptions(manifest: FlagManifest): SelectOption[] {
  return countriesBySubregion(manifest).flatMap(([subregion, items]) =>
    items.map((item) => ({
      value: item.code,
      label: item.name,
      group: subregion,
      keywords: item.code,
      icon: (
        <Flag
          spec={{
            sheet: manifest.countries.sheet,
            index: item.index,
            columns: manifest.columns,
            rows: manifest.countries.rows,
            label: item.name,
          }}
        />
      ),
    }))
  )
}

export function regionOptions(manifest: FlagManifest, countryCode: string | null): SelectOption[] {
  const sheet = countryCode ? manifest.regions[countryCode] : undefined
  if (!sheet) return []
  return sheet.items.map((item) => ({
    value: item.code,
    label: item.name,
    keywords: item.code,
    icon: <Flag spec={{
      sheet: sheet.sheet,
      index: item.index,
      columns: manifest.columns,
      rows: sheet.rows,
      label: item.name,
    }} />,
  }))
}
