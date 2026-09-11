import { useSyncExternalStore } from 'react'
import { OBS_EVENT, type OverlayPayload } from './channel'

/**
 * Cliente do WebSocket que o OBS já traz embutido (obs-websocket 5, ligado em
 * Ferramentas → Configurações do Servidor WebSocket).
 *
 * É ele que dá o tempo real sem o projeto virar um projeto com backend: o
 * servidor não é nosso, é o OBS. O painel manda um evento para dentro da fonte
 * de navegador (`CallVendorRequest` no vendor `obs-browser`), e a página do
 * overlay recebe como um CustomEvent — sem recarregar a fonte, que é o que
 * fazia o overlay piscar em cena.
 *
 * O protocolo cabe em poucas linhas: o OBS manda Hello (op 0), respondemos
 * Identify (op 1) com a resposta do desafio quando há senha, ele confirma com
 * Identified (op 2), e daí em diante é só Request (op 6).
 */

type Estado = 'parado' | 'conectando' | 'conectado' | 'erro'

export interface ObsConnection {
  estado: Estado
  detalhe: string | null
}

/** base64(sha256(texto)), que é o formato que o obs-websocket usa. */
async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  let binary = ''
  for (const b of new Uint8Array(digest)) binary += String.fromCharCode(b)
  return btoa(binary)
}

export class ObsLink {
  private socket: WebSocket | null = null
  private pendente: OverlayPayload | null = null
  private id = 0

  constructor(private onChange: (conn: ObsConnection) => void) {}

  get conectado() {
    return this.socket?.readyState === WebSocket.OPEN
  }

  connect(host: string, port: number, password: string) {
    this.close()
    this.onChange({ estado: 'conectando', detalhe: null })

    const socket = new WebSocket(`ws://${host}:${port}`)
    this.socket = socket

    socket.onmessage = async (e) => {
      const msg = JSON.parse(e.data as string) as { op: number; d: Record<string, unknown> }

      if (msg.op === 0) {
        const auth = msg.d.authentication as { challenge: string; salt: string } | undefined
        const identify: Record<string, unknown> = { rpcVersion: 1, eventSubscriptions: 0 }
        if (auth) {
          if (!password) {
            this.onChange({ estado: 'erro', detalhe: 'o OBS está pedindo senha' })
            socket.close()
            return
          }
          identify.authentication = await hash((await hash(password + auth.salt)) + auth.challenge)
        }
        socket.send(JSON.stringify({ op: 1, d: identify }))
        return
      }

      if (msg.op === 2) {
        this.onChange({ estado: 'conectado', detalhe: null })
        // O que já estava montado vai junto: a fonte não fica vazia esperando a
        // próxima mexida.
        if (this.pendente) this.send(this.pendente)
        return
      }

      if (msg.op === 7) {
        const status = (msg.d as { requestStatus?: { result: boolean; comment?: string } }).requestStatus
        if (status && !status.result) {
          this.onChange({ estado: 'erro', detalhe: status.comment ?? 'o OBS recusou o comando' })
        }
      }
    }

    socket.onerror = () => {
      this.onChange({ estado: 'erro', detalhe: 'não achei o OBS nesse endereço' })
    }
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null
      this.onChange({ estado: 'parado', detalhe: null })
    }
  }

  /**
   * Empurra o estado para dentro da fonte de navegador.
   *
   * O payload viaja **como texto**, num campo só, e não como objeto — e isso não
   * é preciosismo:
   *
   * No caminho até a página o JSON vira `obs_data_t`, a estrutura de dados da
   * libobs, e nela um array é `obs_data_array_t`: uma lista de **objetos**, e
   * nada mais. Array de número, de string, de booleano ou de outro array não tem
   * representação e some no caminho — chega como lista vazia do outro lado.
   *
   * O payload é cheio deles: `slots: [0, 7]`, `score: [2, 1]`, `dim`, os nomes e
   * as escalações das torres, as paradas do degradê. O resultado no ar era a
   * chave desenhada e **vazia**: as vagas sem ninguém, o placar em branco, os
   * times sem nome — porque cada par desses tinha sido apagado no meio do
   * caminho.
   *
   * Uma string atravessa inteira. Do outro lado, `listen` desempacota.
   */
  send(payload: OverlayPayload) {
    this.pendente = payload
    if (!this.conectado) return false
    this.socket!.send(
      JSON.stringify({
        op: 6,
        d: {
          requestType: 'CallVendorRequest',
          requestId: `uni-${++this.id}`,
          requestData: {
            vendorName: 'obs-browser',
            requestType: 'emit_event',
            requestData: { event_name: OBS_EVENT, event_data: { json: JSON.stringify(payload) } },
          },
        },
      })
    )
    return true
  }

  close() {
    this.socket?.close()
    this.socket = null
  }
}

/**
 * O link do OBS é **um só na aplicação**, e vive fora do React.
 *
 * Dentro de um componente ele morreria a cada navegação: sair do painel para a
 * lista de overlays e voltar derrubaria o WebSocket e obrigaria a reconectar no
 * meio da transmissão — que é exatamente quando não dá para reconectar. Aqui ele
 * atravessa a troca de tela e a troca de overlay: quem muda é o payload que sobe
 * por ele, não a conexão.
 */
let link: ObsLink | null = null
let conexao: ObsConnection = { estado: 'parado', detalhe: null }
const ouvintes = new Set<() => void>()

export function obsLink(): ObsLink {
  link ??= new ObsLink((c) => {
    conexao = c
    for (const fn of ouvintes) fn()
  })
  return link
}

/** O estado da conexão, para qualquer tela que precise mostrá-lo. */
export function useObsConnection(): ObsConnection {
  return useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn)
      return () => ouvintes.delete(fn)
    },
    () => conexao,
    () => conexao
  )
}
