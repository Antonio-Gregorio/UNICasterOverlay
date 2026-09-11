import { useSyncExternalStore } from 'react'
import type { LogoAlign } from './channel'

/**
 * Presets do overlay: a tela inteira salva com nome, para voltar a ela num
 * clique. Vive no localStorage + subscribe, como players, times e topbars.
 *
 * Existe porque montar a tela é trabalho de antes da transmissão, não de
 * durante: o overlay das oitavas, o da grand finals e o do showmatch mudam de
 * largura, de logo e de template, e refazer isso ao vivo entre um set e outro é
 * onde o erro acontece.
 */
const KEY = 'unicompslide.overlay-presets.v1'

/** Um lado da barra: quem está nela e quantos pontos tem. */
export interface Side {
  playerId: string | null
  score: number
}

/**
 * Os ajustes da logo do meio, como o painel os guarda.
 *
 * Aqui mora o `eventId` e não a imagem — ao contrário do payload, que viaja
 * resolvido. O localStorage tem poucos MB no total e uma logo de evento passa
 * de 100 KB; meia dúzia de presets repetindo a mesma imagem estouraria a cota
 * para guardar seis vezes o que já está em src/events.ts.
 */
export interface LogoSetup {
  /** id de uma logo de evento cadastrada. Nulo = sem nada no meio. */
  eventId: string | null
  size: number
  align: LogoAlign
  gap: number
  offsetY: number
}

/**
 * Como chegar no OBS desta cena.
 *
 * Fica no preset porque a máquina muda com o evento: o OBS da bancada tem uma
 * senha, o do notebook de casa tem outra, e o de um evento remoto está noutro
 * endereço. Digitar isso de novo a cada troca de overlay é justamente o tipo de
 * coisa que se erra ao vivo.
 *
 * A senha fica no localStorage desta máquina, em texto — como todo o resto do
 * projeto. É a senha do OBS local de quem está transmitindo, não uma credencial
 * de terceiro, e o que a protege é a máquina estar com o dono.
 */
export interface ObsSetup {
  host: string
  port: number
  password: string
}

/** Tudo que a tela do overlay define. É isto que o preset carrega. */
export interface OverlaySetup {
  /** id do template, porque o preset é local — quem resolve é o painel. */
  templateId: string | null
  gap: number
  width: number
  /** Escala do conjunto inteiro; a largura acima é de cada barra. */
  zoom: number
  /** Distância do topo da cena até as barras, em px de cena. */
  offsetY: number
  logo: LogoSetup
  sides: [Side, Side]
  /** id da animação de apresentação escolhida, se houver. */
  animId: string | null
  /** id do estilo de chave escolhido, se houver. */
  bracketTemplateId: string | null
  /** id do torneio que este overlay opera. */
  tournamentId: string | null
  /**
   * A chave em cena e o enquadramento dela.
   *
   * Isto **é** a cena, e não gesto de ao vivo: um overlay chamado "chave das
   * quartas" que abre com a chave desligada não é o overlay que foi salvo. Ficava
   * só no estado da tela, e aí abrir o overlay salvo — ou trocar de um para
   * outro — mandava `bracket: null` para a fonte e a chave sumia do ar.
   */
  showBracket: boolean
  bracketZoom: number
  bracketOffsetY: number
  /** Primeira rodada exibida. */
  bracketFromRound: number
  /**
   * Enquadramento das figuras da apresentação. Também é da cena: depende de quem
   * foi escalado neste overlay, não do template da animação.
   */
  figureZoom: number
  figureOffsetY: number
  obs: ObsSetup
}

export interface OverlayPreset extends OverlaySetup {
  id: string
  name: string
  createdAt: string
}

let presets: OverlayPreset[] = read()
const listeners = new Set<() => void>()

function read(): OverlayPreset[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    // Presets gravados antes de um campo novo existir não podem derrubar a tela:
    // o que faltar volta com o padrão.
    return (JSON.parse(raw) as OverlayPreset[]).map((p) => ({ ...blankSetup(), ...p }))
  } catch {
    return []
  }
}

function commit(next: OverlayPreset[]) {
  presets = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a lista continua válida em memória nesta sessão */
  }
  for (const fn of listeners) fn()
}

export function useOverlayPresets(): OverlayPreset[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => presets,
    () => presets
  )
}

/** Salva como novo e devolve o id, para o painel já selecionar o que criou. */
export function addPreset(name: string, setup: OverlaySetup): string {
  const id = crypto.randomUUID()
  commit([...presets, { ...structuredClone(setup), id, name, createdAt: new Date().toISOString() }])
  return id
}

/** Grava por cima de um preset existente, mantendo nome e id. */
export function updatePreset(id: string, setup: OverlaySetup) {
  commit(presets.map((p) => (p.id === id ? { ...p, ...structuredClone(setup) } : p)))
}

/** Copia um overlay inteiro, chave do OBS incluída, com "(n)" no nome. */
export function duplicatePreset(id: string): string | null {
  const original = presets.find((p) => p.id === id)
  if (!original) return null
  const raiz = original.name.replace(/s*(d+)$/, '').trim() || original.name
  let n = 1
  while (presets.some((p) => p.name === `${raiz} (${n})`)) n++
  const copia: OverlayPreset = {
    ...structuredClone(original),
    id: crypto.randomUUID(),
    name: `${raiz} (${n})`,
    createdAt: new Date().toISOString(),
  }
  commit([...presets, copia])
  return copia.id
}

export function renamePreset(id: string, name: string) {
  commit(presets.map((p) => (p.id === id ? { ...p, name } : p)))
}

export function removePreset(id: string) {
  commit(presets.filter((p) => p.id !== id))
}

/** Ponto de partida da tela — o mesmo com que o painel abre sem preset nenhum. */
export function blankSetup(): OverlaySetup {
  return {
    templateId: null,
    gap: 24,
    width: 720,
    zoom: 1,
    // Um pouco abaixo do topo: colado na borda a barra briga com o que o OBS
    // costuma pôr ali, e no meio ela tapa o jogo.
    offsetY: 48,
    logo: { eventId: null, size: 120, align: 'center', gap: 0, offsetY: 0 },
    bracketTemplateId: null,
    tournamentId: null,
    showBracket: false,
    bracketZoom: 1,
    bracketOffsetY: 0,
    bracketFromRound: 0,
    figureZoom: 1,
    figureOffsetY: 0,
    obs: { host: '127.0.0.1', port: 4455, password: '' },
    sides: [
      { playerId: null, score: 0 },
      { playerId: null, score: 0 },
    ],
    animId: null,
  }
}

/** Só os ajustes do preset, sem id/nome/data — o que o painel devolve à tela. */
export function setupOf(preset: OverlayPreset): OverlaySetup {
  const { id: _id, name: _name, createdAt: _createdAt, ...setup } = preset
  return structuredClone(setup)
}
