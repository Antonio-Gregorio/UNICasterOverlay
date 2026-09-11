/**
 * Reancora os caminhos absolutos dos manifestos na base do deploy.
 *
 * Os scripts de `public/` gravam URLs de raiz (`/flags/countries.webp`), que
 * valem enquanto o site mora em `/`. No GitHub Pages ele mora em
 * `/UNICasterOverlay/`, então quem consome um manifesto passa a URL por aqui em
 * vez de usá-la crua. Em dev `BASE_URL` é `/` e a função não muda nada.
 */
const BASE = import.meta.env.BASE_URL

export function assetUrl(path: string): string
export function assetUrl(path: null | undefined): null
export function assetUrl(path: string | null | undefined): string | null
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return path.startsWith('/') ? BASE + path.slice(1) : path
}
