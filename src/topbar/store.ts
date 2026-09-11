import { useSyncExternalStore } from 'react'
import type { TopbarTemplate } from './types'

/** Store dos templates de topbar: localStorage + subscribe, como players e times. */
const KEY = 'unicompslide.topbars.v1'

let templates: TopbarTemplate[] = read()
const listeners = new Set<() => void>()

function read(): TopbarTemplate[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TopbarTemplate[]) : []
  } catch {
    return []
  }
}

function commit(next: TopbarTemplate[]) {
  templates = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a lista continua válida em memória nesta sessão */
  }
  for (const fn of listeners) fn()
}

export function useTopbars(): TopbarTemplate[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => templates,
    () => templates
  )
}

export function addTopbar(input: Omit<TopbarTemplate, 'id' | 'createdAt'>) {
  commit([...templates, { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }])
}

export function updateTopbar(id: string, input: Omit<TopbarTemplate, 'id' | 'createdAt'>) {
  commit(templates.map((t) => (t.id === id ? { ...t, ...input } : t)))
}

export function removeTopbar(id: string) {
  commit(templates.filter((t) => t.id !== id))
}

/**
 * Duplica um template, batizando a cópia como o Explorer faz: "Grand Finals"
 * vira "Grand Finals (1)", e o próximo número livre em diante.
 *
 * A cópia entra depois da última do mesmo grupo, não logo abaixo do original —
 * senão duplicar duas vezes deixava "(2)" acima de "(1)".
 */
export function duplicateTopbar(id: string) {
  const index = templates.findIndex((t) => t.id === id)
  if (index < 0) return
  const original = templates[index]
  const root = rootName(original.name)

  let insertAt = index
  for (let i = index + 1; i < templates.length; i++) {
    if (rootName(templates[i].name) !== root) break
    insertAt = i
  }

  const copy: TopbarTemplate = {
    ...structuredClone(original),
    id: crypto.randomUUID(),
    name: nextCopyName(root, templates.map((t) => t.name)),
    createdAt: new Date().toISOString(),
  }
  commit([...templates.slice(0, insertAt + 1), copy, ...templates.slice(insertAt + 1)])
}

/** "Grand Finals (2)" -> "Grand Finals". */
function rootName(name: string): string {
  return name.replace(/\s*\(\d+\)$/, '').trim() || name
}

/** Primeiro número ainda não usado para o nome base. */
function nextCopyName(root: string, taken: string[]): string {
  let n = 1
  while (taken.includes(`${root} (${n})`)) n++
  return `${root} (${n})`
}

/** Ponto de partida de um template novo — já legível sem mexer em nada. */
export function blankTemplate(): Omit<TopbarTemplate, 'id' | 'createdAt'> {
  return {
    name: '',
    barHeight: 96,
    shape: {
      style: 'straight',
      notchDepth: 26,
      notchWidth: 320,
      notchSlant: 34,
      notchDirection: 'down',
    },
    edges: { style: 'rounded', radius: 12, taper: 40, taperDirection: 'up' },
    fill: {
      type: 'gradient',
      color: '#1b1b28',
      gradient: { angle: 90, stops: ['#241b33', '#0f0f18'], mirror: true },
    },
    border: { style: 'none', color: '#ffffff', width: 2 },
    highlight: { enabled: true, color: '#e66d9f', useCharacterColor: true, intensity: 55, blur: 18 },
    typography: {
      fontFamily: DEFAULT_FONT,
      nameColor: '#ffffff',
      teamColor: '#e66d9f',
      scoreColor: '#ffffff',
    },
    show: {
      characterArt: true,
      useSD: false,
      useAnchor: true,
      teamTag: true,
      teamFlag: true,
      countryFlag: true,
      regionFlag: true,
    },
  }
}

/**
 * Fontes disponíveis. São stacks do sistema de propósito: a exportação desenha
 * o SVG num canvas, e uma webfont teria que estar embutida no arquivo para não
 * sair com a fonte errada na imagem final.
 *
 * A ordem importa — as setas do seletor passam por ela nesta sequência, então
 * fontes parecidas ficam vizinhas e a comparação é de uma para a seguinte.
 */
export const FONT_STACKS = [
  { value: 'system-ui, sans-serif', label: 'Sistema' },
  { value: '"Segoe UI", Roboto, sans-serif', label: 'Segoe UI' },
  { value: '"Segoe UI Black", "Segoe UI", sans-serif', label: 'Segoe UI Black' },
  { value: '"Arial Black", Arial, sans-serif', label: 'Arial Black' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Impact, Haettenschweiler, sans-serif', label: 'Impact' },
  { value: 'Bahnschrift, "DIN Condensed", sans-serif', label: 'Bahnschrift' },
  { value: '"Franklin Gothic Medium", "Arial Narrow", sans-serif', label: 'Franklin Gothic' },
  { value: '"Arial Narrow", Arial, sans-serif', label: 'Arial Narrow' },
  { value: '"Century Gothic", "Questrial", sans-serif', label: 'Century Gothic' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: 'Candara, Calibri, sans-serif', label: 'Candara' },
  { value: 'Corbel, Calibri, sans-serif', label: 'Corbel' },
  { value: '"Lucida Sans Unicode", "Lucida Grande", sans-serif', label: 'Lucida Sans' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times' },
  { value: '"Palatino Linotype", Palatino, serif', label: 'Palatino' },
  { value: 'Rockwell, "Courier Bold", serif', label: 'Rockwell' },
  { value: '"Book Antiqua", Palatino, serif', label: 'Book Antiqua' },
  { value: '"Courier New", monospace', label: 'Courier' },
  { value: 'Consolas, "Cascadia Mono", monospace', label: 'Consolas' },
  { value: '"Cascadia Code", Consolas, monospace', label: 'Cascadia' },
  { value: '"Comic Sans MS", "Comic Neue", cursive', label: 'Comic Sans' },
  { value: '"Segoe Print", "Bradley Hand", cursive', label: 'Segoe Print' },
]

/** Courier é a fonte padrão dos templates novos. */
export const DEFAULT_FONT = '"Courier New", monospace'
