/**
 * Fundos prontos, baixados do wiki do jogo por scripts/fetch-backgrounds.mjs.
 *
 * O manifesto traz duas resoluções: a de uso e a miniatura. O seletor mostra os
 * 18 de uma vez, e puxar os arquivos grandes só para desenhar quadradinhos de
 * 140px custaria alguns MB à toa.
 */
export interface BackgroundPreset {
  id: string
  label: string
  url: string
  thumb: string
}

let cache: Promise<BackgroundPreset[]> | null = null

export function loadBackgrounds(): Promise<BackgroundPreset[]> {
  cache ??= fetch('/backgrounds/index.json')
    .then((res) => (res.ok ? res.json() : { backgrounds: [] }))
    .then((json: { backgrounds?: BackgroundPreset[] }) => json.backgrounds ?? [])
    .catch(() => [])
  return cache
}
