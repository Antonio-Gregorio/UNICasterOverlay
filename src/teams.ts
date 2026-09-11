import { useSyncExternalStore } from 'react'
import { fileToImage } from './imageUpload'
import type { Player, Team } from './types'

/** Store dos times, mesmo desenho do de players: localStorage + subscribe. */
const KEY = 'unicompslide.teams.v1'

/** Lado da logo depois do redimensionamento, em px. */
export const LOGO_SIZE = 128

let teams: Team[] = read()
const listeners = new Set<() => void>()

function read(): Team[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Team[]) : []
  } catch {
    return []
  }
}

function commit(next: Team[]) {
  teams = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a lista continua válida em memória nesta sessão */
  }
  for (const fn of listeners) fn()
}

export function useTeams(): Team[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => teams,
    () => teams
  )
}

export function getTeams(): Team[] {
  return teams
}

export function addTeam(input: Omit<Team, 'id' | 'createdAt'>) {
  commit([...teams, { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }])
}

export function updateTeam(id: string, input: Omit<Team, 'id' | 'createdAt'>) {
  commit(teams.map((t) => (t.id === id ? { ...t, ...input } : t)))
}

export function removeTeam(id: string) {
  commit(teams.filter((t) => t.id !== id))
}

/**
 * O time exibido de um player, venha ele do cadastro ou de um nome digitado.
 * Um `teamId` órfão (time apagado depois) cai para o texto, ou para nada.
 */
export function teamOf(player: Player, all: Team[]): { label: string; logo: string | null } | null {
  if (player.teamId) {
    const team = all.find((t) => t.id === player.teamId)
    if (team) return { label: team.tag || team.name, logo: team.logo }
  }
  return player.team ? { label: player.team, logo: null } : null
}

/** Logo de time: quadrada, para caber na mesma caixa de uma bandeira. */
export function fileToLogo(file: File, size = LOGO_SIZE): Promise<string> {
  return fileToImage(file, { maxSize: size, square: true }).then((img) => img.dataUrl)
}
