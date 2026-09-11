import { useSyncExternalStore } from 'react'
import { fileToImage } from './imageUpload'
import type { EventLogo } from './types'

/** Store das logos de evento: localStorage + subscribe, como players e times. */
const KEY = 'unicompslide.events.v1'

/**
 * Lado máximo da logo depois do redimensionamento.
 *
 * Maior que a logo de time (128px) porque esta vai para arte promocional, não
 * para uma insígnia de 24px. A proporção original é preservada — logo de evento
 * costuma ser larga, e forçá-la num quadrado deixaria tarja dos dois lados.
 */
export const EVENT_LOGO_SIZE = 512

let events: EventLogo[] = read()
const listeners = new Set<() => void>()

function read(): EventLogo[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as EventLogo[]) : []
  } catch {
    return []
  }
}

function commit(next: EventLogo[]) {
  events = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a lista continua válida em memória nesta sessão */
  }
  for (const fn of listeners) fn()
}

export function useEvents(): EventLogo[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => events,
    () => events
  )
}

export function addEvent(input: Omit<EventLogo, 'id' | 'createdAt'>) {
  commit([...events, { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }])
}

export function updateEvent(id: string, input: Omit<EventLogo, 'id' | 'createdAt'>) {
  commit(events.map((e) => (e.id === id ? { ...e, ...input } : e)))
}

export function removeEvent(id: string) {
  commit(events.filter((e) => e.id !== id))
}

export function fileToEventLogo(file: File) {
  return fileToImage(file, { maxSize: EVENT_LOGO_SIZE })
}
