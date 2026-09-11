import { assetUrl } from './assetUrl'
import type { Character, ColorRole } from './types'

/**
 * O dataset agregado é gerado por scripts/extract-colors.mjs a partir dos
 * arquivos individuais, que continuam sendo a fonte da verdade — editar um
 * <slug>.json à mão e rodar o pipeline é o fluxo esperado.
 */
let cache: Promise<Character[]> | null = null

export function loadCharacters(): Promise<Character[]> {
  cache ??= fetch(assetUrl('/characters/all.json'))
    .then((res) => {
      if (!res.ok) throw new Error(`characters/all.json: HTTP ${res.status}`)
      return res.json() as Promise<Character[]>
    })
    .then((list) => list.map(rebaseAssets).sort((a, b) => a.rosterOrder - b.rosterOrder))
  return cache
}

/** As artes vêm do manifesto com caminho de raiz; ver src/assetUrl.ts. */
function rebaseAssets(character: Character): Character {
  const { art, artPortrait, catchphrase, sd } = character.assets
  return {
    ...character,
    assets: {
      art: assetUrl(art),
      artPortrait: assetUrl(artPortrait),
      catchphrase: assetUrl(catchphrase),
      sd: assetUrl(sd),
    },
  }
}

export function colorOf(character: Character, role: ColorRole): string {
  return character.colors?.find((c) => c.role === role)?.hex ?? '#888888'
}
