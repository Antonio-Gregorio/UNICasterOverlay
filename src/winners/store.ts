import { useSyncExternalStore } from 'react'
import { DEFAULT_FONT } from '../topbar/store'
import { LAYOUTS } from './layouts'
import type { GraphicLayout, WinnersTemplate } from './types'

/** Store dos gráficos de vencedores: mesmo desenho dos outros stores. */
const KEY = 'unicompslide.winners.v1'

let templates: WinnersTemplate[] = read()
const listeners = new Set<() => void>()

function read(): WinnersTemplate[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as WinnersTemplate[]).map(migrate) : []
  } catch {
    return []
  }
}

/**
 * Template salvo antes de um campo existir continua valendo: o que falta vem do
 * padrão. Sem isto, um gráfico feito ontem quebrava o editor ao abrir hoje.
 */
function migrate(t: WinnersTemplate): WinnersTemplate {
  const base = blankWinners(t.layout)
  return {
    ...t,
    leaders: { ...base.leaders, ...t.leaders },
    grid: { ...base.grid, ...t.grid },
    portrait: { ...base.portrait, ...t.portrait },
    background: { ...base.background, ...t.background },
    event: { ...base.event, ...t.event, style: { ...base.event.style, ...t.event?.style } },
    nameStyle: { ...base.nameStyle, ...t.nameStyle },
    handleStyle: { ...base.handleStyle, ...t.handleStyle },
  }
}

function commit(next: WinnersTemplate[]) {
  templates = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a lista continua válida em memória nesta sessão */
  }
  for (const fn of listeners) fn()
}

export function useWinners(): WinnersTemplate[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => templates,
    () => templates
  )
}

export function addWinners(input: Omit<WinnersTemplate, 'id' | 'createdAt'>) {
  commit([...templates, { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }])
}

export function updateWinners(id: string, input: Omit<WinnersTemplate, 'id' | 'createdAt'>) {
  commit(templates.map((t) => (t.id === id ? { ...t, ...input } : t)))
}

export function removeWinners(id: string) {
  commit(templates.filter((t) => t.id !== id))
}

/** Duplica com sufixo "(n)", como a aba Topbar faz. */
export function duplicateWinners(id: string) {
  const index = templates.findIndex((t) => t.id === id)
  if (index < 0) return
  const original = templates[index]
  const root = original.name.replace(/\s*\(\d+\)$/, '').trim() || original.name

  let insertAt = index
  for (let i = index + 1; i < templates.length; i++) {
    const other = templates[i].name.replace(/\s*\(\d+\)$/, '').trim()
    if (other !== root) break
    insertAt = i
  }

  let n = 1
  const taken = templates.map((t) => t.name)
  while (taken.includes(`${root} (${n})`)) n++

  const copy: WinnersTemplate = {
    ...structuredClone(original),
    id: crypto.randomUUID(),
    name: `${root} (${n})`,
    createdAt: new Date().toISOString(),
  }
  commit([...templates.slice(0, insertAt + 1), copy, ...templates.slice(insertAt + 1)])
}

/**
 * Ponto de partida de um template. Recebe o layout porque a aba oferece os
 * arranjos prontos como atalhos de criação — escolher "Top 8" já traz o
 * gráfico montado, e o resto é ajuste fino.
 */
export function blankWinners(layout: GraphicLayout = 'top8'): Omit<WinnersTemplate, 'id' | 'createdAt'> {
  return {
    name: '',
    layout,
    slotCount: LAYOUTS[layout].defaultSlots,
    leaders: { show: false },
    grid: { gapX: 0, gapY: 0, spread: 1 },
    background: {
      // Fundo do próprio jogo é o padrão: é o que a maioria dos cartazes usa.
      type: 'preset',
      presetId: 'bg01',
      color: '#12121c',
      gradient: { angle: 150, stops: ['#241b33', '#0b0b12'] },
      image: null,
      overlayColor: '#000000',
      overlayOpacity: 35,
    },
    portrait: {
      shape: 'rounded',
      radius: 18,
      widthScale: 1,
      heightScale: 1,
      cut: 'none',
      cutAngle: 12,
      imageZoom: 1,
      imageOffsetX: 0,
      imageOffsetY: 0,
      useSD: false,
      useAnchor: true,
      borderColor: '#e66d9f',
      borderWidth: 4,
      borderGradient: false,
      borderColor2: '#6d6df0',
      shadow: 'soft',
    },
    nameStyle: {
      fontFamily: DEFAULT_FONT,
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 0,
    },
    handleStyle: {
      fontFamily: DEFAULT_FONT,
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 0,
    },
    event: {
      show: true,
      style: {
        fontFamily: DEFAULT_FONT,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 0,
      },
      gradient: false,
      gradientColor2: '#e66d9f',
      align: 'center',
      offsetX: 0,
      offsetY: 0,
      size: 86,
    },
    flag: 'country',
  }
}
