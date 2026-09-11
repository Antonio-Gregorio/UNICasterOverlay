import { useSyncExternalStore } from 'react'
import { DEFAULT_FONT } from '../topbar/store'
import { buildBracket } from './seed'
import { autoSides, shouldAutoSplit, towersOf } from './towers'
import type { BracketTemplate, Entry, Tournament, Towers } from './types'

/**
 * Dois stores no mesmo arquivo, porque são duas coisas que andam juntas mas
 * mudam em ritmos diferentes: o **template** é o visual, reaproveitado de evento
 * em evento; o **torneio** é quem jogou e quem passou, e nasce e morre num fim
 * de semana. Separá-los é o mesmo critério que separa topbar de player.
 */
const KEY_T = 'unicompslide.bracket-templates.v1'
const KEY_C = 'unicompslide.tournaments.v1'

function makeStore<T extends { id: string }>(key: string, migrate: (raw: T) => T) {
  let items: T[] = read()
  const listeners = new Set<() => void>()

  function read(): T[] {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T[]).map(migrate) : []
    } catch {
      return []
    }
  }
  function commit(next: T[]) {
    items = next
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* a lista continua válida em memória nesta sessão */
    }
    for (const fn of listeners) fn()
  }
  return {
    use: () =>
      useSyncExternalStore(
        (fn) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        () => items,
        () => items
      ),
    all: () => items,
    add(item: T) {
      commit([...items, item])
      return item.id
    },
    update(id: string, patch: Partial<T>) {
      commit(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    },
    remove(id: string) {
      commit(items.filter((i) => i.id !== id))
    },
  }
}

/**
 * Template gravado antes de um campo existir não pode derrubar a tela.
 *
 * A mistura é campo a campo nos objetos internos, e não só no topo: quando
 * `show` ganhou o selo do vencedor, um `show` antigo espalhado por cima do
 * padrão apagaria a chave nova de volta para `undefined` — e `undefined` num
 * `checked` de React troca o campo de controlado para não controlado no meio do
 * uso.
 */
function migrateTemplate(t: BracketTemplate): BracketTemplate {
  const base = blankTemplate()
  return {
    ...base,
    ...t,
    show: { ...base.show, ...t.show },
    background: { ...base.background, ...t.background },
    frame: { ...base.frame, ...t.frame },
    transition: { ...base.transition, ...t.transition },
    info: { ...base.info, ...t.info },
    teams: t.teams ?? base.teams,
    typography: { ...base.typography, ...t.typography },
    highlight: { ...base.highlight, ...t.highlight },
    slot: { ...base.slot, ...t.slot },
    id: t.id,
  }
}

const templates = makeStore<BracketTemplate>(KEY_T, migrateTemplate)
// O torneio só ganha torres quando o modo de times pede: um torneio antigo
// abre sem elas e continua válido — ver `towersOf`.
const tournaments = makeStore<Tournament>(KEY_C, (t) => t)

export const useBracketTemplates = templates.use
export const useTournaments = tournaments.use

export function addTemplate(input: Omit<BracketTemplate, 'id' | 'createdAt'>): string {
  return templates.add({ ...structuredClone(input), id: crypto.randomUUID(), createdAt: new Date().toISOString() })
}
export const updateTemplate = (id: string, patch: Partial<BracketTemplate>) => templates.update(id, patch)

/** Copia um template com "(n)" no nome — o atalho para variar sem recomeçar. */
export function duplicateTemplate(id: string): string | null {
  const original = templates.all().find((t) => t.id === id)
  if (!original) return null
  const raiz = original.name.replace(/\s*\(\d+\)$/, '').trim() || original.name
  let n = 1
  while (templates.all().some((t) => t.name === `${raiz} (${n})`)) n++
  return templates.add({
    ...structuredClone(original),
    id: crypto.randomUUID(),
    name: `${raiz} (${n})`,
    createdAt: new Date().toISOString(),
  })
}
export const removeTemplate = (id: string) => templates.remove(id)

export function addTournament(name: string): string {
  return tournaments.add({
    id: crypto.randomUUID(),
    name,
    entries: [],
    matches: [],
    createdAt: new Date().toISOString(),
  })
}
export const updateTournament = (id: string, patch: Partial<Tournament>) => tournaments.update(id, patch)

/**
 * Mexe nas torres de um torneio, criando-as se ainda não existirem.
 *
 * Se ninguém escalou ninguém, a divisão automática — a que está desenhada em
 * cena — vira a escalação de verdade **antes** do gesto. Sem isso, apagar ou
 * pontuar alguém que se está vendo na tela caía num array vazio: nada mudava, e
 * nada mudando, nada subia para o OBS.
 */
export function updateTowers(id: string, fn: (towers: Towers) => Towers) {
  const torneio = tournaments.all().find((t) => t.id === id)
  if (!torneio) return
  const base = shouldAutoSplit(torneio.towers)
    ? { ...towersOf(torneio.towers), sides: autoSides(torneio.entries.length) }
    : towersOf(torneio.towers)
  // Mexeu, virou decisão: daqui em diante a divisão automática não volta.
  tournaments.update(id, { towers: { ...fn(base), touched: true } })
}
export const removeTournament = (id: string) => tournaments.remove(id)

/** Troca a lista de participantes e refaz a chave junto — as duas andam presas. */
export function setEntries(id: string, entries: Entry[]) {
  tournaments.update(id, { entries, matches: buildBracket(entries) })
}

/** Ponto de partida de um template novo — já legível sem mexer em nada. */
export function blankTemplate(): Omit<BracketTemplate, 'id' | 'createdAt'> {
  return {
    name: '',
    // Chave de sempre: quem quiser dupla ou guerra de times troca o modo, e o
    // que já estava no ar continua como estava.
    mode: 'solo',
    show: { countryFlag: true, teamTag: true, characterArt: true, score: true, winnerMark: true },
    // Sem fundo: a chave nasce como sempre foi ao ar, direto sobre a
    // transmissão. Quem quiser a tela cheia pintada liga — o contrário tampava o
    // gameplay de quem já usava a chave assim.
    background: {
      type: 'none',
      color: '#0f0f18',
      gradient: { angle: 160, stops: ['#1b1b2a', '#0b0b12'] },
      image: null,
      presetId: null,
      blur: 10,
      dim: 35,
      // Respiro de tela cheia, e canto reto: o quadro é a cena inteira, e canto
      // arredondado num retângulo de 1920x1080 só aparece como falha.
      padding: 56,
      radius: 0,
    },
    frame: { style: 'none', color: '#e66d9f', intensity: 70, speed: 4000, thickness: 3 },
    transition: { style: 'fade', duration: 600, angle: 0 },
    // Duas cores diferentes de saída: é o que separa os dois lados de relance.
    teams: [
      { color: '#e66d9f', textColor: '#ffffff' },
      { color: '#4fa8e0', textColor: '#ffffff' },
    ],
    info: {
      showTitle: true,
      title: '',
      subtitle: '',
      align: 'center',
      color: '#ffffff',
      size: 34,
      showRounds: true,
      roundColor: '#8b8ba7',
      roundSize: 13,
    },
    typography: { fontFamily: DEFAULT_FONT, nameColor: '#ffffff', scoreColor: '#ffffff' },
    highlight: { enabled: true, useCharacterColor: true, color: '#e66d9f', intensity: 60 },
    dimLosers: true,
    dimAmount: 65,
    slot: {
      width: 300,
      height: 56,
      gap: 12,
      columnGap: 56,
      radius: 6,
      background: '#161622',
      borderColor: '#2a2a3c',
    },
  }
}
