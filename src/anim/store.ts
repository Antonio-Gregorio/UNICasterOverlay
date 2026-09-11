import { useSyncExternalStore } from 'react'
import { DEFAULT_FONT } from '../topbar/store'
import type { AnimBackground, AnimStyle, AnimTemplate } from './types'

/**
 * Store dos templates de animação: localStorage + subscribe, como topbars.
 *
 * A diferença é que este já nasce cheio. Um editor de topbar vazio ainda deixa
 * montar a barra em dois minutos; uma animação vazia não existe — ou vem a
 * coreografia pronta, ou não há o que ajustar. As três de fábrica entram na
 * primeira visita e depois são templates comuns: dá para renomear, mexer e
 * apagar.
 */
const KEY = 'unicompslide.anims.v1'

/** Rótulo e descrição de cada coreografia, para o seletor do editor. */
export const ANIM_STYLES: { value: AnimStyle; label: string; hint: string }[] = [
  { value: 'abertura', label: 'Abertura', hint: 'clarão e onda de choque no ponto onde os dois se encontram' },
  { value: 'correntes', label: 'Correntes', hint: 'correntes de elo desenhado varrem a tela e balançam no lugar' },
  { value: 'chamas', label: 'Chamas', hint: 'línguas de fogo sobem do chão levantando brasas' },
  { value: 'relampago', label: 'Relâmpago', hint: 'raios rasgam o quadro e o clarão pisca junto' },
  { value: 'estilhaco', label: 'Estilhaço', hint: 'o vidro trinca e os cacos abrem para os dois' },
  { value: 'neon', label: 'Neon', hint: 'grade em fuga e faixa de luz atravessando, ao estilo synthwave' },
  { value: 'petalas', label: 'Pétalas', hint: 'pétalas caem em três profundidades, com vento' },
  { value: 'glitch', label: 'Glitch', hint: 'canais deslocados, varredura e cortes de sinal' },
  { value: 'vortice', label: 'Vórtice', hint: 'anéis de energia girando em torno do centro' },
  { value: 'cortina', label: 'Cortina', hint: 'lâminas diagonais varrem o quadro, ao estilo esports' },
  { value: 'faiscas', label: 'Faíscas', hint: 'estouro de partículas a partir do encontro' },
  { value: 'ondas', label: 'Ondas', hint: 'anéis concêntricos de choque abrindo do centro' },
]

/** Fundo padrão: nada, que é como o overlay sempre se comportou. */
export function blankBackground(): AnimBackground {
  return {
    type: 'none',
    color: '#0f0f18',
    gradient: { angle: 140, stops: ['#241b33', '#0f0f18'] },
    image: null,
    presetId: null,
    blur: 18,
    dim: 35,
  }
}

let anims: AnimTemplate[] = read()
const listeners = new Set<() => void>()

function read(): AnimTemplate[] {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return factory()
  }
  // Chave ausente = primeira visita: entra o trio de fábrica. Chave presente com
  // lista vazia = o usuário apagou tudo, e ressemear seria desfazer isso.
  if (raw === null) {
    const seeded = factory()
    try {
      localStorage.setItem(KEY, JSON.stringify(seeded))
    } catch {
      /* segue em memória nesta sessão */
    }
    return seeded
  }
  try {
    // Campo novo não pode derrubar template antigo: os que já estavam salvos
    // antes do fundo e do enquadramento existirem voltam com o padrão deles.
    return (JSON.parse(raw) as AnimTemplate[]).map((a) => ({
      ...a,
      background: { ...blankBackground(), ...(a.background ?? {}) },
      figureZoom: a.figureZoom ?? 1,
      figureOffsetY: a.figureOffsetY ?? 0,
      fadeIn: a.fadeIn ?? 0,
      fadeOut: a.fadeOut ?? 0,
    }))
  } catch {
    return []
  }
}

function commit(next: AnimTemplate[]) {
  anims = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a lista continua válida em memória nesta sessão */
  }
  for (const fn of listeners) fn()
}

export function useAnims(): AnimTemplate[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => anims,
    () => anims
  )
}

/** Cria e devolve o id, para a tela já selecionar o que acabou de nascer. */
export function addAnim(input: Omit<AnimTemplate, 'id' | 'createdAt'>): string {
  const id = crypto.randomUUID()
  commit([...anims, { ...structuredClone(input), id, createdAt: new Date().toISOString() }])
  return id
}

export function updateAnim(id: string, input: Omit<AnimTemplate, 'id' | 'createdAt'>) {
  commit(anims.map((a) => (a.id === id ? { ...a, ...structuredClone(input) } : a)))
}

export function removeAnim(id: string) {
  commit(anims.filter((a) => a.id !== id))
}

/** Duplica batizando a cópia como o Explorer faz: "Abertura" → "Abertura (1)". */
export function duplicateAnim(id: string): string | null {
  const original = anims.find((a) => a.id === id)
  if (!original) return null
  const root = original.name.replace(/\s*\(\d+\)$/, '').trim() || original.name
  let n = 1
  while (anims.some((a) => a.name === `${root} (${n})`)) n++
  const copy: AnimTemplate = {
    ...structuredClone(original),
    id: crypto.randomUUID(),
    name: `${root} (${n})`,
    createdAt: new Date().toISOString(),
  }
  commit([...anims, copy])
  return copy.id
}

/** Ponto de partida de um template novo. */
export function blankAnimation(): Omit<AnimTemplate, 'id' | 'createdAt'> {
  return {
    name: '',
    style: 'abertura',
    background: blankBackground(),
    useSD: false,
    figureZoom: 1,
    figureOffsetY: 0,
    typography: { fontFamily: DEFAULT_FONT, nameColor: '#ffffff', teamColor: '#e66d9f' },
    showTeam: true,
    accentColor: '#e66d9f',
    useCharacterColor: true,
    fadeIn: 0,
    fadeOut: 0,
    duration: 5000,
  }
}

/**
 * As que entram na primeira visita.
 *
 * Uma por família de efeito e não uma por estilo: doze templates de fábrica
 * seriam doze linhas para rolar num seletor antes de chegar no que se quer. O
 * estilo é um campo — trocá-lo num destes leva aos outros nove sem criar nada.
 */
function factory(): AnimTemplate[] {
  const base = {
    useSD: false,
    showTeam: true,
    figureZoom: 1,
    figureOffsetY: 0,
    fadeIn: 0,
    fadeOut: 0,
    typography: { fontFamily: DEFAULT_FONT, nameColor: '#ffffff', teamColor: '#e66d9f' },
    createdAt: new Date().toISOString(),
  }
  const escuro = (): AnimBackground => ({ ...blankBackground(), type: 'gradient' })
  // Quem nasce com fundo nasce com fade: fundo opaco entrando em corte seco pisca.
  const comFade = { fadeIn: 400, fadeOut: 500 }

  return [
    {
      ...base,
      id: crypto.randomUUID(),
      name: 'Abertura',
      style: 'abertura',
      background: blankBackground(),
      accentColor: '#8fd8ff',
      useCharacterColor: true,
      duration: 5000,
    },
    {
      ...base,
      id: crypto.randomUUID(),
      name: 'Correntes',
      style: 'correntes',
      background: escuro(),
      ...comFade,
      accentColor: '#c9a227',
      useCharacterColor: false,
      duration: 6000,
    },
    {
      ...base,
      id: crypto.randomUUID(),
      name: 'Chamas',
      style: 'chamas',
      background: escuro(),
      ...comFade,
      // Chibi de propósito: o fogo cobre boa parte do quadro, e a arte oficial
      // some atrás dele — o chibi lê inteiro mesmo pequeno.
      useSD: true,
      accentColor: '#ff7a2f',
      useCharacterColor: false,
      duration: 5500,
    },
    {
      ...base,
      id: crypto.randomUUID(),
      name: 'Neon',
      style: 'neon',
      background: escuro(),
      ...comFade,
      accentColor: '#ff2fd0',
      useCharacterColor: false,
      duration: 5500,
    },
    {
      ...base,
      id: crypto.randomUUID(),
      name: 'Cortina',
      style: 'cortina',
      background: escuro(),
      ...comFade,
      accentColor: '#4fa8ff',
      useCharacterColor: true,
      duration: 4500,
    },
  ]
}
