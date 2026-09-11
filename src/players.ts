import { useSyncExternalStore } from 'react'
import type { Player } from './types'

/**
 * Store dos players. Fica no localStorage: o projeto é 100% client-side e a
 * lista precisa sobreviver ao refresh no meio de um torneio.
 */
const KEY = 'unicompslide.players.v1'

let players: Player[] = read()
const listeners = new Set<() => void>()

function read(): Player[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Player[]) : []
  } catch {
    // Modo privado, storage cheio ou JSON corrompido: começa vazio em vez de
    // derrubar a tela inteira.
    return []
  }
}

function commit(next: Player[]) {
  players = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a lista continua válida em memória nesta sessão */
  }
  for (const fn of listeners) fn()
}

export function usePlayers(): Player[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => players,
    () => players
  )
}

export function addPlayer(input: Omit<Player, 'id' | 'createdAt'>) {
  commit([
    ...players,
    { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
  ])
}

/**
 * Cadastra vários de uma vez.
 *
 * Uma gravação só, e não uma por pessoa: importar os 23 de exemplo com
 * `addPlayer` num laço escreveria 23 vezes no localStorage e redesenharia a
 * lista 23 vezes, com a chance de o meio da fila cair se a cota estourar.
 */
export function addPlayers(inputs: Omit<Player, 'id' | 'createdAt'>[]) {
  if (inputs.length === 0) return
  const agora = new Date().toISOString()
  commit([
    ...players,
    ...inputs.map((input) => ({ ...input, id: crypto.randomUUID(), createdAt: agora })),
  ])
}

export function updatePlayer(id: string, input: Omit<Player, 'id' | 'createdAt'>) {
  commit(players.map((p) => (p.id === id ? { ...p, ...input } : p)))
}

export function removePlayer(id: string) {
  commit(players.filter((p) => p.id !== id))
}
