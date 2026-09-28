/**
 * Exportar e importar cadastros como JSON.
 *
 * O projeto não tem backend: tudo mora no localStorage de uma máquina. Levar os
 * players, as topbars ou os overlays para o notebook do evento — ou mandar para
 * quem vai operar a transmissão — é copiar um texto de um lado e colar do outro.
 *
 * O pacote diz de que tela veio (`kind`). Colar players na tela de topbars não
 * pode gravar players dentro da lista de topbars: o JSON é recusado com o nome
 * do que ele é.
 */

const APP = 'unicompslide'
const VERSION = 1

export interface Bundle {
  app: typeof APP
  kind: string
  version: number
  exportedAt: string
  items: unknown[]
  /** Cadastros de que os itens dependem — os times dos players, por exemplo. */
  related?: Record<string, unknown[]>
}

export function makeBundle(kind: string, items: unknown[], related?: Record<string, unknown[]>): string {
  const bundle: Bundle = {
    app: APP,
    kind,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    items,
    ...(related && Object.keys(related).length ? { related } : {}),
  }
  return JSON.stringify(bundle, null, 2)
}

/** Um item precisa de id e nome: é o mínimo que toda lista daqui usa. */
function isItem(x: unknown): x is { id: string; name: string } {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as { id?: unknown }).id === 'string' &&
    typeof (x as { name?: unknown }).name === 'string'
  )
}

/**
 * Lê o texto colado. Joga um Error com a explicação para quem colou — é essa
 * mensagem que a tela mostra.
 */
export function parseBundle(text: string, kind: string, kindLabels: Record<string, string>): Bundle {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Isso não é um JSON válido.')
  }
  const b = data as Partial<Bundle>
  if (!b || typeof b !== 'object' || b.app !== APP || !Array.isArray(b.items)) {
    throw new Error('Esse JSON não foi exportado pelo UNICompSlide.')
  }
  if (b.kind !== kind) {
    const nome = (b.kind && kindLabels[b.kind]) ?? b.kind ?? 'outra coisa'
    throw new Error(`Esse JSON é de ${nome}. Importe na tela certa.`)
  }
  if (!b.items.every(isItem)) {
    throw new Error('Algum item do JSON está incompleto (sem id ou nome).')
  }
  return b as Bundle
}

export interface ImportResult {
  added: number
  updated: number
}

/**
 * Junta o que chegou com o que já existe, pelo id.
 *
 * Mesmo id = o mesmo item, atualizado; id novo = entra no fim. Preservar o id é
 * o que mantém as ligações entre cadastros: um player importado continua
 * apontando para o time dele, e um overlay para a topbar que usa.
 */
export function upsert<T extends { id: string }>(current: T[], incoming: T[]): { next: T[]; result: ImportResult } {
  const byId = new Map(incoming.map((i) => [i.id, i]))
  let updated = 0
  const next = current.map((c) => {
    const novo = byId.get(c.id)
    if (!novo) return c
    byId.delete(c.id)
    updated++
    return novo
  })
  const added = [...byId.values()]
  return { next: [...next, ...added], result: { added: added.length, updated } }
}

/** Nome de cada `kind`, para a mensagem de JSON colado na tela errada. */
export const KIND_LABELS: Record<string, string> = {
  players: 'players',
  teams: 'times',
  events: 'logos',
  topbars: 'templates de topbar',
  winners: 'templates de winners',
  anims: 'animações',
  brackets: 'estilos de chave',
  overlays: 'overlays',
}
