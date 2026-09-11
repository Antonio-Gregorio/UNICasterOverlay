import type { AnimPlay } from '../anim/types'
import type { BracketPlay } from '../bracket/types'
import type { TopbarData, TopbarTemplate } from '../topbar/types'

/**
 * Como o painel manda o overlay mudar — sem servidor nenhum no meio.
 *
 * O projeto não tem backend, e uma página web não abre porta TCP: ela conversa
 * com servidores, nunca é um. Então o estado viaja por três caminhos, e o
 * overlay escuta os três:
 *
 * 1. **Evento do obs-browser** — o OBS tem um WebSocket embutido, e por ele dá
 *    para disparar um evento dentro da fonte de navegador. É o caminho ao vivo
 *    de verdade: o painel manda, a fonte redesenha, ninguém recarrega nada.
 * 2. **BroadcastChannel** — quando o overlay está aberto noutra aba do mesmo
 *    navegador. Serve para conferir sem abrir o OBS, e para quem captura a
 *    janela do navegador em vez de usar fonte de navegador.
 * 3. **Hash da URL** — o estado inteiro codificado no endereço. É o que faz a
 *    fonte já abrir preenchida, sem depender de ninguém estar mandando nada.
 */

/**
 * O quadro da transmissão, em px. Tudo que viaja no payload é medido nesta
 * régua, e quem desenha escala para o tamanho real da fonte — ver `scale` em
 * OverlayStage e AnimStage.
 */
export const SCENE = { width: 1920, height: 1080 }

export const OBS_EVENT = 'unicompslide-overlay'
export const CHANNEL = 'unicompslide-overlay'

/** Onde a logo do meio encosta, na vertical, em relação às barras. */
export type LogoAlign = 'top' | 'center' | 'bottom'

/**
 * A logo que ocupa o vão entre as duas barras — do evento, do patrocinador, do
 * que for.
 *
 * Viaja com a imagem embutida, e não com o id da logo cadastrada, pela mesma
 * razão do template: o OBS carrega a página de fora deste navegador e não
 * enxerga o localStorage desta máquina. Quem guarda o id é o preset (ver
 * presets.ts) — o payload já sai resolvido.
 */
export interface OverlayLogo {
  /** Imagem em data URL. */
  image: string
  /** Altura em px; a largura sai da proporção original. */
  size: number
  align: LogoAlign
  /** Respiro dos dois lados, somado ao vão entre as barras. */
  gap: number
  /** Empurrão vertical fino: o alinhamento sozinho raramente acerta de primeira. */
  offsetY: number
}

/** O que o overlay desenha. Cresce conforme mais peças entrarem. */
export interface OverlayPayload {
  /** Template inteiro, e não o id: o OBS não tem o localStorage desta máquina. */
  template: TopbarTemplate | null
  players: [TopbarData, TopbarData]
  /** Distância entre as duas barras, em px. */
  gap: number
  /** Largura de cada barra, em px de cena. */
  width: number
  /**
   * Escala do conjunto — barras, vão e logo juntos.
   *
   * Separada da largura de propósito: a largura decide quanto de cena cada barra
   * ocupa, e é o que se acerta uma vez montando a cena. O tamanho é o ajuste que
   * se faz depois, quando o conjunto inteiro está certo mas pequeno ou grande
   * demais para a resolução da transmissão.
   */
  zoom: number
  /** Distância do topo da cena até as barras, em px de cena. */
  offsetY: number
  /** Nulo = as barras se encaram direto, sem nada no meio. */
  logo: OverlayLogo | null
  /**
   * Tira as barras de cena sem mexer na fonte do OBS.
   *
   * Esconder pelo OBS significa clicar no olho da fonte, que é longe do painel e
   * fácil de esquecer ligado. E há um momento em que isto é obrigatório: a
   * apresentação usa a tela inteira, e o placar por cima dela fica no caminho.
   */
  showBars: boolean
  /** Apresentação em cena. Nulo = nada tocando. */
  anim: AnimPlay | null
  /**
   * Chave em cena. Nulo = não está no ar.
   *
   * Viaja com o torneio e as pessoas já resolvidos, como a logo e o cenário: o
   * OBS não tem o cadastro desta máquina para procurar quem é quem.
   */
  bracket: BracketPlay | null
  /**
   * Tamanho da chave dentro da cena, e o quanto ela sobe ou desce a partir do
   * centro, em px de cena. A tela em volta não se move: ela é a cena.
   */
  bracketZoom: number
  bracketOffsetY: number
  /**
   * Em que ponta a chave está: entrando/no ar, ou saindo.
   *
   * A fonte **não decide** isso. Ela decidia — deduzia a saída de `bracket` ter
   * virado nulo e rodava o próprio cronômetro —, e dois relógios independentes
   * desencontram sempre que uma mensagem chega tarde, se perde, ou a fonte
   * recarrega no meio da transição: uma ponta terminava a saída e a outra ainda
   * estava entrando. Agora quem tem o relógio é o painel, e o payload descreve o
   * estado inteiro — qualquer mensagem, sozinha, diz o que tem de estar na tela.
   */
  bracketPhase: 'in' | 'out'
  /**
   * Muda a cada vez que a chave entra em cena, e só aí.
   *
   * É o que faz a entrada tocar de novo quando ela entra, sem tocar a cada
   * reenvio — o mesmo truque do `runId` da apresentação, e pelo mesmo motivo: o
   * painel manda o estado inteiro a cada dois segundos, e sem um id a entrada
   * recomeçaria a cada mensagem.
   */
  bracketRun: string
}

/**
 * Codifica em base64 seguro para URL.
 *
 * O `btoa` engasga com acento — e nomes de player têm acento —, então o texto
 * passa por UTF-8 antes.
 */
export function encodePayload(payload: OverlayPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodePayload(text: string): OverlayPayload | null {
  try {
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as OverlayPayload
  } catch {
    return null
  }
}

/**
 * Tira o peso do que vai na URL.
 *
 * Logo de time é data URL e sozinha passa de 50 KB — na barra de endereço isso
 * vira uma URL que o OBS recusa. Pelo WebSocket ela vai inteira; só o caminho da
 * URL abre mão dela.
 */
export function lighten(payload: OverlayPayload): OverlayPayload {
  return {
    ...payload,
    players: payload.players.map((p) => ({ ...p, teamLogo: null })) as [TopbarData, TopbarData],
    // Pelo mesmo motivo a logo do meio fica para trás: é a maior imagem do
    // payload, e sozinha já estouraria o endereço.
    logo: null,
    // A apresentação também sai. O hash serve para a fonte abrir preenchida, e
    // uma animação gravada no endereço tocaria de novo a cada recarga da fonte —
    // inclusive no meio de um set.
    anim: null,
    // A chave é o maior objeto do payload — 40 pessoas e os confrontos todos.
    // Pelo WebSocket vai inteira; no endereço não caberia.
    bracket: null,
  }
}

/** Manda para quem estiver ouvindo no mesmo navegador. */
export function broadcast(payload: OverlayPayload) {
  try {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage(payload)
    channel.close()
  } catch {
    /* navegador sem BroadcastChannel: sobram o OBS e a URL */
  }
}

/** Escuta os três caminhos. Devolve a função de desligar. */
export function listen(onPayload: (payload: OverlayPayload) => void) {
  const fromHash = () => {
    const hash = window.location.hash.replace(/^#/, '')
    const payload = hash ? decodePayload(hash) : null
    if (payload) onPayload(payload)
  }
  fromHash()

  /**
   * O evento do obs-browser chega com o payload embrulhado em texto — ver
   * `ObsLink.send`, que explica por quê. Aceita também o objeto cru: é o formato
   * que uma versão anterior mandava, e uma fonte que ficou aberta desde antes da
   * troca continua funcionando.
   */
  const onObs = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (!detail) return
    const bruto =
      typeof detail === 'string'
        ? detail
        : typeof (detail as { json?: unknown }).json === 'string'
          ? (detail as { json: string }).json
          : null
    if (bruto === null) {
      onPayload(detail as OverlayPayload)
      return
    }
    try {
      onPayload(JSON.parse(bruto) as OverlayPayload)
    } catch {
      /* texto que não é o nosso payload: não é para nós */
    }
  }
  window.addEventListener(OBS_EVENT, onObs)
  window.addEventListener('hashchange', fromHash)

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e) => onPayload(e.data as OverlayPayload)
  } catch {
    /* sem BroadcastChannel, os outros dois caminhos continuam valendo */
  }

  return () => {
    window.removeEventListener(OBS_EVENT, onObs)
    window.removeEventListener('hashchange', fromHash)
    channel?.close()
  }
}
