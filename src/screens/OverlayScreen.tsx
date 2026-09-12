import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ScreenHeader } from './ScreenHeader'
import { Field } from '../components/Field'
import { Select } from '../components/Select'
import { Checkbox, HoldNudge, Range, Segmented } from '../components/controls'
import { CopyIcon, DiceIcon } from '../components/icons'
import { useData } from '../data'
import { useAnims } from '../anim/store'
import {
  MAX_ENTRIES,
  addScore as addMatchScore,
  roundName,
  roundCount,
  setSlot,
  setWinner,
  shuffle,
  swap,
  toggleDim as toggleMatchDim,
} from '../bracket/seed'
import {
  addTournament,
  removeTournament,
  setEntries,
  updateTournament,
  updateTowers,
  useBracketTemplates,
  useTournaments,
} from '../bracket/store'
import {
  addToTower,
  autoSides,
  dimInTower,
  putInTower,
  removeFromTower,
  renameTeam,
  scoreInTower,
  shouldAutoSplit,
  towersOf,
} from '../bracket/towers'
import { resolvePerson } from '../bracket/people'
import { BracketStage } from '../bracket/BracketStage'
import type { BracketEdit, BracketPlay, Entry, Match, SlotRef } from '../bracket/types'
import type { AnimPlay, AnimSide } from '../anim/types'
import { useEvents } from '../events'
import { usePlayers } from '../players'
import { teamOf, useTeams } from '../teams'
import { useTopbars } from '../topbar/store'
import { OverlayStage } from '../overlay/OverlayStage'
import {
  SCENE,
  broadcast,
  encodePayload,
  lighten,
  type LogoAlign,
  type OverlayPayload,
} from '../overlay/channel'
import { obsLink, useObsConnection } from '../overlay/obs'
import {
  addPreset,
  blankSetup,
  renamePreset,
  setupOf,
  updatePreset,
  useOverlayPresets,
  type OverlaySetup,
  type Side,
} from '../overlay/presets'
import type { TopbarData } from '../topbar/types'
import type { Player, Team } from '../types'

/**
 * Endereço da fonte de navegador do OBS.
 *
 * Não é `origin + '/overlay/live'`: no GitHub Pages o site mora em
 * /UNICasterOverlay/, e a URL sem o prefixo cai fora do app. BASE_URL já vem
 * com a barra no fim e vale '/' em dev.
 */
const LIVE_URL = `${window.location.origin}${import.meta.env.BASE_URL}overlay/live`

const EMPTY: TopbarData = {
  name: '',
  teamTag: null,
  teamLogo: null,
  characterSlug: null,
  countryCode: null,
  regionCode: null,
  score: 0,
}

const ALIGNS: { value: LogoAlign; label: string }[] = [
  { value: 'top', label: 'Topo' },
  { value: 'center', label: 'Centro' },
  { value: 'bottom', label: 'Base' },
]

/**
 * Painel do overlay: monta o que aparece na transmissão e manda para o OBS.
 *
 * Não existe servidor nosso aqui. A página do overlay é a mesma aplicação, então
 * quem já serve o painel serve ela também, e o tempo real vem do WebSocket que o
 * próprio OBS traz embutido. É o que permite o projeto continuar sem backend.
 *
 * A tela é larga e baixa de propósito: a prévia ocupa a faixa de cima e os
 * controles se espalham numa grade embaixo. Em coluna única isto virava uma tira
 * de rolagem — e rolar no meio de um set é justamente quando não dá para rolar.
 */
/**
 * As frentes do painel. Uma por vez: são peças diferentes da cena, e lado a lado
 * viravam uma parede de campos onde achar o placar custava mais que mexer nele.
 *
 * `geral` é a última porque é o que não se toca durante o set: nome, chave do
 * OBS, link da fonte. Ficava sob a prévia, mas é um bloco alto — e rolar até ele
 * levava a prévia para fora da tela, que é justamente o que a coluna fixa existe
 * para evitar.
 */
type Aba = 'topbar' | 'anim' | 'chave' | 'geral'

export function OverlayScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { characters, backgrounds } = useData()
  const players = usePlayers()
  const teams = useTeams()
  const topbars = useTopbars()
  const events = useEvents()
  const presets = useOverlayPresets()
  const anims = useAnims()
  const bracketTemplates = useBracketTemplates()
  const tournaments = useTournaments()

  /**
   * A tela inteira num estado só, e não um `useState` por controle: é este
   * objeto que o preset grava e devolve. Espalhado em oito estados, salvar
   * significaria listar os oito de novo em cada ponto — e esquecer um deles na
   * próxima vez que a tela ganhasse um campo.
   */
  const salvo = presets.find((p) => p.id === id) ?? null
  const [setup, setSetup] = useState<OverlaySetup>(() => (salvo ? setupOf(salvo) : blankSetup()))
  const [aba, setAba] = useState<Aba>('topbar')
  const patch = useCallback(
    (input: Partial<OverlaySetup>) => setSetup((s) => ({ ...s, ...input })),
    []
  )
  const patchLogo = useCallback(
    (input: Partial<OverlaySetup['logo']>) =>
      setSetup((s) => ({ ...s, logo: { ...s.logo, ...input } })),
    []
  )

  const [presetName, setPresetName] = useState(salvo?.name ?? '')

  /*
   * Trocar de overlay é trocar o que este painel está editando — e só isso.
   *
   * A rota muda, o componente continua o mesmo e a conexão com o OBS nem fica
   * sabendo: ela vive fora do React (ver obsLink). Era esse o ponto — mudar de
   * cena no meio da transmissão sem derrubar o WebSocket.
   */
  useEffect(() => {
    const alvo = presets.find((p) => p.id === id)
    if (!alvo) return
    setSetup(setupOf(alvo))
    setPresetName(alvo.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na troca de overlay
  }, [id])

  const conn = useObsConnection()
  const conectado = conn.estado === 'conectado'
  const [auto, setAuto] = useState(true)
  const [enviado, setEnviado] = useState<number | null>(null)

  /**
   * Fora do preset de propósito: são gestos do ao vivo, não montagem de cena.
   * Carregar um preset no meio da transmissão não pode acender a barra que
   * acabou de ser escondida, nem redisparar a apresentação.
   */
  const [showBars, setShowBars] = useState(true)
  const [anim, setAnim] = useState<AnimPlay | null>(null)

  /** Qual confronto o painel está operando. Isso sim é gesto de ao vivo. */
  /*
   * Tudo que compõe a cena mora no preset — é o que faz "carregar o overlay das
   * quartas" devolver a mesma tela, e não uma parecida com a chave desligada.
   */
  const showBracket = setup.showBracket
  const setShowBracket = (v: boolean) => patch({ showBracket: v })
  const torneioId = setup.tournamentId
  const setTorneioId = (v: string | null) => patch({ tournamentId: v })
  const bracketTplId = setup.bracketTemplateId
  const setBracketTplId = (v: string | null) => patch({ bracketTemplateId: v })
  const bracketZoom = setup.bracketZoom
  const setBracketZoom = (v: number) => patch({ bracketZoom: v })
  const bracketOffsetY = setup.bracketOffsetY
  const setBracketOffsetY = (v: number) => patch({ bracketOffsetY: v })
  const desdeRodada = setup.bracketFromRound
  const setDesdeRodada = (v: number) => patch({ bracketFromRound: v })
  const figZoom = setup.figureZoom
  const setFigZoom = (v: number) => patch({ figureZoom: v })
  const figOffsetY = setup.figureOffsetY
  const setFigOffsetY = (v: number) => patch({ figureOffsetY: v })

  /** Só o confronto selecionado é da tela: some ao sair, e não faz falta. */
  const [confronto, setConfronto] = useState<string | null>(null)

  /**
   * O relógio da transição da chave mora aqui, e não na fonte.
   *
   * `run` muda a cada entrada — é o que manda a animação tocar de novo sem que
   * ela recomece a cada reenvio. `saindo` guarda o último quadro enquanto a saída
   * roda: o payload continua levando a chave, agora marcada como `out`, até o
   * tempo acabar. Assim qualquer mensagem, sozinha, descreve o que tem de estar
   * na tela — e uma fonte que recarregou no meio se acerta na mensagem seguinte.
   */
  const [bracketRun, setBracketRun] = useState(() => crypto.randomUUID())
  const [saindo, setSaindo] = useState<BracketPlay | null>(null)
  const anterior = useRef<BracketPlay | null>(null)

  // O link é o mesmo da aplicação inteira, e continua de pé ao sair da tela: só
  // desconecta quem clicar em desconectar.
  const link = obsLink()

  const template = topbars.find((t) => t.id === setup.templateId) ?? topbars[0] ?? null
  const animId = setup.animId

  /*
   * Escolher a animação carrega o enquadramento que ela trazia — o ponto de
   * partida daquele template. Só na troca: depois disso quem manda são os
   * controles daqui, e reaplicar o template desfaria o ajuste no meio do set.
   */
  useEffect(() => {
    const escolhida = anims.find((a) => a.id === animId)
    if (!escolhida) return
    setSetup((s) => ({
      ...s,
      figureZoom: escolhida.figureZoom ?? 1,
      figureOffsetY: escolhida.figureOffsetY ?? 0,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na troca de animação
  }, [animId])
  const logoEvent = events.find((e) => e.id === setup.logo.eventId) ?? null

  /*
   * Sem escolha, cai no primeiro. O torneio é estado de tela e não sobrevive ao
   * recarregar — e como este painel virou o único lugar onde ele existe, abrir a
   * página sem nada selecionado obrigaria a reescolher antes de qualquer coisa.
   */
  const torneio = tournaments.find((t) => t.id === torneioId) ?? tournaments[0] ?? null
  const bracketTpl = bracketTemplates.find((t) => t.id === bracketTplId) ?? bracketTemplates[0] ?? null

  /**
   * A chave sai daqui já resolvida em pessoas — o OBS não tem o cadastro desta
   * máquina, do mesmo jeito que não tem o de logos nem o de fundos.
   */
  const bracketPlay: BracketPlay | null = useMemo(() => {
    // Sem confronto a tela vai ao ar mesmo assim, vazia: quem tirou o último
    // participante quis limpar a chave, não tirá-la do ar.
    if (!showBracket || !torneio || !bracketTpl) return null
    return {
      template: bracketTpl,
      tournament: torneio,
      people: torneio.entries.map((e) => resolvePerson(e, players, teams, characters)),
      fromRound: desdeRodada,
    }
  }, [showBracket, torneio, bracketTpl, players, teams, characters, desdeRodada])

  useEffect(() => {
    const antes = anterior.current
    anterior.current = bracketPlay
    if (bracketPlay && !antes) {
      // Entrou: id novo, e o que estivesse saindo é descartado.
      setBracketRun(crypto.randomUUID())
      setSaindo(null)
      return
    }
    if (!bracketPlay && antes) {
      // Saiu: o último quadro fica no payload pelo tempo da animação.
      setSaindo(antes)
      const timer = setTimeout(
        () => setSaindo(null),
        Math.max(0, antes.template.transition.duration)
      )
      return () => clearTimeout(timer)
    }
  }, [bracketPlay])

  /** O que vai na cena: a chave no ar, ou a que ainda está saindo. */
  const bracketEmCena = bracketPlay ?? saindo

  const payload: OverlayPayload = useMemo(
    () => ({
      template,
      players: [sideData(setup.sides[0], players, teams), sideData(setup.sides[1], players, teams)],
      gap: setup.gap,
      width: setup.width,
      zoom: setup.zoom,
      offsetY: setup.offsetY,
      // A logo sai daqui já resolvida em imagem: o OBS não tem o cadastro desta
      // máquina para procurar o id guardado no preset.
      logo: logoEvent
        ? {
            image: logoEvent.image,
            size: setup.logo.size,
            align: setup.logo.align,
            gap: setup.logo.gap,
            offsetY: setup.logo.offsetY,
          }
        : null,
      showBars,
      // O enquadramento entra aqui, e não no disparo: assim mexer no slider com
      // a apresentação em cena a reposiciona na hora, em vez de só valer na
      // próxima vez que ela tocar.
      anim: anim ? { ...anim, figureZoom: figZoom, figureOffsetY: figOffsetY } : null,
      bracket: bracketEmCena,
      bracketZoom,
      bracketOffsetY,
      bracketPhase: bracketPlay ? 'in' : 'out',
      bracketRun,
    }),
    [
      template,
      setup,
      players,
      teams,
      logoEvent,
      showBars,
      anim,
      figZoom,
      figOffsetY,
      bracketPlay,
      bracketEmCena,
      bracketRun,
      bracketZoom,
      bracketOffsetY,
    ]
  )

  const obs = setup.obs
  const patchObs = (input: Partial<OverlaySetup['obs']>) => patch({ obs: { ...setup.obs, ...input } })

  const send = useCallback(() => {
    // Vai pelos dois caminhos: o OBS pela fonte de navegador, e o
    // BroadcastChannel para qualquer aba deste navegador que esteja aberta.
    link.send(payload)
    broadcast(payload)
    setEnviado(Date.now())
  }, [payload])

  // Ao vivo: cada mexida sai na hora. Desligado, só no botão — que é o que serve
  // para montar o próximo confronto enquanto o anterior está em cena.
  useEffect(() => {
    if (!auto) return
    const timer = setTimeout(send, 120)
    return () => clearTimeout(timer)
  }, [auto, send])

  /**
   * E repete a cada dois segundos, enquanto estiver no ar.
   *
   * O envio é de mão única: o painel fala, a fonte escuta, e ninguém confirma
   * nada. Basta a fonte não estar ouvindo no instante do evento — porque foi
   * recarregada, porque a cena acabou de ser ativada, porque o OBS reabriu a
   * página — para ela ficar parada num estado velho até alguém mexer no painel
   * de novo. O reenvio faz a fonte se acertar sozinha em no máximo dois
   * segundos, e é barato: o payload é o mesmo objeto que já está montado.
   *
   * Só no modo ao vivo. Com ele desligado, o silêncio é o pedido — é assim que
   * se monta o próximo confronto sem que ele vá ao ar antes da hora.
   */
  useEffect(() => {
    if (!auto || !conectado) return
    const timer = setInterval(() => link.send(payload), 2000)
    return () => clearInterval(timer)
  }, [auto, conectado, payload, link])

  const fit = useFitScale()

  const playerChoices = useMemo(
    () =>
      players.map((p) => ({
        value: p.id,
        label: p.name,
        hint: teamOf(p, teams)?.label,
        keywords: characters.find((c) => c.slug === p.characterSlug)?.name ?? '',
      })),
    [players, teams, characters]
  )

  /**
   * URL da fonte de navegador. O estado vai no hash para a fonte já abrir
   * preenchida mesmo antes de o painel mandar qualquer coisa — sem as imagens
   * pesadas, que estourariam o endereço.
   */
  const url = `${LIVE_URL}#${encodePayload(lighten(payload))}`

  function patchSide(index: 0 | 1, value: Partial<Side>) {
    setSetup((s) => {
      const sides: [Side, Side] = [s.sides[0], s.sides[1]]
      sides[index] = { ...sides[index], ...value }
      return { ...s, sides }
    })
  }

  /**
   * Soma no placar a partir do valor atual, e não do que estava na tela quando o
   * clique começou: no meio de um set os cliques vêm em rajada, e lendo o valor
   * de fora três cliques viravam um ponto só.
   */
  function addScore(index: 0 | 1, delta: number) {
    setSetup((s) => {
      const sides: [Side, Side] = [s.sides[0], s.sides[1]]
      sides[index] = { ...sides[index], score: Math.max(0, sides[index].score + delta) }
      return { ...s, sides }
    })
  }

  /** Grava neste overlay; sem um aberto, cria e passa a editá-lo. */
  function savePreset() {
    const name = presetName.trim() || 'Sem nome'
    if (salvo) {
      updatePreset(salvo.id, setup)
      if (salvo.name !== name) renamePreset(salvo.id, name)
      return
    }
    navigate(`/overlay/${addPreset(name, setup)}`, { replace: true })
  }

  /**
   * Dispara a apresentação com os dois que já estão na tela.
   *
   * Os nomes saem do payload e não do cadastro: o que a barra mostra é o que a
   * apresentação anuncia, sem uma segunda regra para divergir dela.
   */
  const animTemplate = anims.find((a) => a.id === setup.animId) ?? null
  function rodarAnim() {
    if (!animTemplate) return
    setAnim({
      template: animTemplate,
      sides: [animSide(payload.players[0]), animSide(payload.players[1])],
      // O cenário vai resolvido em URL, como a logo vai resolvida em imagem: a
      // fonte do OBS não tem o índice de fundos para procurar o id.
      sceneryUrl:
        backgrounds.find((b) => b.id === animTemplate.background.presetId)?.url ?? null,
      // Id novo a cada disparo: é a mudança dele que a fonte lê como "toca
      // agora". Ver OverlayLiveScreen.
      runId: crypto.randomUUID(),
    })
  }

  /**
   * O confronto que o painel está operando.
   *
   * Guardado como "rodada-ordem" e não por referência: o torneio é reconstruído
   * a cada resultado (ver setWinner), e uma referência apontaria para um objeto
   * que deixou de existir.
   */
  const confrontos = torneio
    ? torneio.matches
        .filter((m) => m.slots[0] !== null || m.slots[1] !== null)
        .sort((a, b) => a.round - b.round || a.order - b.order)
    : []
  const atual = confrontos.find((m) => `${m.round}-${m.order}` === confronto) ?? null

  const nomeDoLado = (m: typeof atual, lado: 0 | 1) =>
    m && m.slots[lado] !== null ? nomeDe(torneio?.entries[m.slots[lado]!]) : '—'

  const modo = bracketTpl?.mode ?? 'solo'
  const torres = torneio ? towersOf(torneio.towers) : null

  /** Onde está quem foi arrastado — em confronto ou em torre. */
  function entryDe(ref: SlotRef): number | null {
    if (!torneio) return null
    if (ref.kind === 'match') {
      const m = torneio.matches.find((x) => x.round === ref.round && x.order === ref.order)
      return m?.slots[ref.side] ?? null
    }
    return towersOf(torneio.towers).sides[ref.side][ref.index]?.entry ?? null
  }

  /**
   * O que a prévia do painel deixa fazer na própria vaga.
   *
   * Mexer onde se está olhando é mais direto do que achar o mesmo confronto numa
   * lista ao lado — e no meio de um set, procurar é o que custa caro.
   */
  const bracketEdit: BracketEdit = {
    score(ref, delta) {
      if (!torneio) return
      if (ref.kind === 'match') {
        mexerNoConfronto((ms) => addMatchScore(ms, ref.round, ref.order, ref.side, delta))
      } else {
        updateTowers(torneio.id, (t) => scoreInTower(t, ref.side, ref.index, delta))
      }
    },
    toggleDim(ref) {
      if (!torneio) return
      if (ref.kind === 'match') {
        mexerNoConfronto((ms) => toggleMatchDim(ms, ref.round, ref.order, ref.side))
      } else {
        updateTowers(torneio.id, (t) => dimInTower(t, ref.side, ref.index))
      }
    },
    remove(ref) {
      if (!torneio) return
      // Da primeira rodada ninguém sai: é ali que a lista de participantes está
      // desenhada, e tirar de lá perderia a pessoa da chave inteira.
      if (ref.kind === 'match') {
        if (ref.round > 0) mexerNoConfronto((ms) => setSlot(ms, ref.round, ref.order, ref.side, null))
      } else {
        updateTowers(torneio.id, (t) => removeFromTower(t, ref.side, ref.index))
      }
    },
    copy(de, para) {
      if (!torneio) return
      const entry = entryDe(de)
      if (entry === null) return
      if (para.kind === 'match') {
        mexerNoConfronto((ms) => setSlot(ms, para.round, para.order, para.side, entry))
      } else {
        updateTowers(torneio.id, (t) => putInTower(t, para.side, para.index, entry))
      }
    },
  }

  /**
   * O nome que vale é o do cadastro.
   *
   * A inscrição guarda um nome porque ela também aceita quem não está
   * cadastrado; para quem está, aquilo é só o retrato de quando a inscrição foi
   * feita. Renomear um player deixava a chave em cena com o nome novo — ela
   * resolve pelo cadastro — e as listas daqui com o antigo.
   */
  const nomeDe = (e: Entry | null | undefined): string =>
    (e && (players.find((p) => p.id === e.playerId)?.name ?? e.name)) || '?'

  /** Quem ainda não está inscrito neste torneio. */
  const livres = players.filter((p) => !torneio?.entries.some((e) => e.playerId === p.id))

  function patchEntries(entries: Entry[]) {
    if (torneio) setEntries(torneio.id, entries.slice(0, MAX_ENTRIES))
  }

  /**
   * Troca o parceiro de uma inscrição.
   *
   * Sem refazer os confrontos, ao contrário de tudo que mexe na lista: a dupla é
   * um participante só, e quem ela encara não muda por causa de quem está do
   * lado. Refazer aqui apagaria placar por uma correção de nome.
   */
  function setPartner(i: number, partner: Entry['partner']) {
    if (!torneio) return
    updateTournament(torneio.id, {
      entries: torneio.entries.map((e, k) => (k === i ? { ...e, partner } : e)),
    })
  }

  function mexerNoConfronto(fn: (matches: Match[]) => Match[]) {
    if (!torneio) return
    updateTournament(torneio.id, { matches: fn(torneio.matches) })
  }


  if (id && !salvo) return <p className="empty">Overlay não encontrado.</p>

  return (
    <>
      <ScreenHeader
        title={salvo ? salvo.name : 'Novo overlay'}
        subtitle="Fonte de navegador do OBS, atualizada em tempo real"
      >
        <p className="overlay-status">
          <span className={`overlay-dot${conectado ? ' is-on' : ''}`} aria-hidden="true" />
          {conectado ? 'no ar' : (conn.detalhe ?? 'desconectado')}
        </p>
        <button
          type="button"
          className={`btn${showBars ? '' : ' btn--primary'}`}
          onClick={() => setShowBars((v) => !v)}
        >
          {showBars ? 'Ocultar barras' : 'Mostrar barras'}
        </button>
        <Link className="btn" to="/overlay">
          Trocar de overlay
        </Link>
      </ScreenHeader>

      <div className="editor-screen__body">
        <div className="overlay-tabs">
          {/* Uma frente por vez: as três peças da cena não se ajustam juntas, e
              lado a lado elas viravam uma parede de campos onde achar o placar
              custava mais que mexer nele. */}
          <nav className="tabs tabs--inline" role="tablist">
            {(
              [
                ['topbar', 'Topbar'],
                ['anim', 'Apresentação'],
                ['chave', 'Chave'],
                ['geral', 'Geral'],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                className={`tab${aba === valor ? ' is-active' : ''}`}
                aria-selected={aba === valor}
                onClick={() => setAba(valor)}
              >
                {rotulo}
              </button>
            ))}
          </nav>

          <div className="overlay-tabs__body">
            {aba === 'topbar' && (
              <>
          {([0, 1] as const).map((side) => (
            <section key={side} className="editor-section">
              <h3>{side === 0 ? 'Player 1' : 'Player 2'}</h3>
              <Field label="Player" htmlFor={`ov-p${side}`}>
                <Select
                  id={`ov-p${side}`}
                  options={playerChoices}
                  value={setup.sides[side].playerId}
                  onChange={(v) => patchSide(side, { playerId: v })}
                  disabled={players.length === 0}
                  placeholder="Selecione"
                  emptyLabel="Vazio"
                  searchPlaceholder="Buscar player..."
                />
              </Field>
              <Field label="Pontos">
                <div className="score-row">
                  <button type="button" className="btn btn--small" onClick={() => addScore(side, -1)}>
                    −
                  </button>
                  <strong className="score-row__value">{setup.sides[side].score}</strong>
                  <button type="button" className="btn btn--small" onClick={() => addScore(side, 1)}>
                    +
                  </button>
                </div>
              </Field>
            </section>
          ))}

          <section className="editor-section">
            <h3>Barras</h3>
            <Field
              label="Template"
              htmlFor="ov-template"
              hint={topbars.length ? undefined : 'nenhum salvo'}
            >
              <Select
                id="ov-template"
                options={topbars.map((t) => ({ value: t.id, label: t.name }))}
                value={template?.id ?? null}
                onChange={(templateId) => patch({ templateId })}
                disabled={topbars.length === 0}
                placeholder="Selecione a topbar"
                searchPlaceholder="Buscar template..."
              />
            </Field>
            <Field label="Largura de cada barra">
              <Range
                value={setup.width}
                onChange={(width) => patch({ width })}
                min={360}
                max={960}
                suffix="px"
              />
            </Field>
            <Field label="Vão entre elas">
              <Range value={setup.gap} onChange={(gap) => patch({ gap })} min={0} max={400} suffix="px" />
            </Field>
            {/* Tamanho e largura são coisas diferentes: a largura decide quanto
                de cena cada barra ocupa, e o tamanho escala o conjunto todo —
                barras, vão e logo — depois que o arranjo já está certo. */}
            <Field label="Tamanho" hint="o conjunto todo">
              <Range
                value={Math.round(setup.zoom * 100)}
                onChange={(v) => patch({ zoom: v / 100 })}
                min={40}
                max={160}
                suffix="%"
              />
            </Field>
            <Field label="Posição vertical" hint="a partir do topo">
              <Range
                value={setup.offsetY}
                onChange={(offsetY) => patch({ offsetY })}
                min={0}
                max={920}
                suffix="px"
              />
            </Field>
          </section>

          <section className="editor-section">
            <h3>Logo do meio</h3>
            <Field label="Logo" htmlFor="ov-logo" hint={events.length ? undefined : 'cadastre em Logos'}>
              <Select
                id="ov-logo"
                options={events.map((e) => ({
                  value: e.id,
                  label: e.name,
                  icon: <img className="picker__thumb" src={e.image} alt="" />,
                }))}
                value={setup.logo.eventId}
                onChange={(eventId) => patchLogo({ eventId })}
                disabled={events.length === 0}
                placeholder="Sem logo"
                emptyLabel="Sem logo"
                searchPlaceholder="Buscar logo..."
              />
            </Field>
            {/* Os ajustes só aparecem com uma logo escolhida: sem ela são quatro
                sliders que não mexem em nada na tela. */}
            {logoEvent && (
              <>
                <Field label="Tamanho">
                  <Range
                    value={setup.logo.size}
                    onChange={(size) => patchLogo({ size })}
                    min={40}
                    max={400}
                    suffix="px"
                  />
                </Field>
                <Field label="Alinhamento">
                  <Segmented
                    value={setup.logo.align}
                    onChange={(align) => patchLogo({ align })}
                    options={ALIGNS}
                    ariaLabel="Alinhamento da logo"
                  />
                </Field>
                <Field label="Espaçamento" hint="dos dois lados">
                  <Range
                    value={setup.logo.gap}
                    onChange={(gap) => patchLogo({ gap })}
                    min={0}
                    max={200}
                    suffix="px"
                  />
                </Field>
                <Field label="Ajuste vertical">
                  <Range
                    value={setup.logo.offsetY}
                    onChange={(offsetY) => patchLogo({ offsetY })}
                    min={-120}
                    max={120}
                    suffix="px"
                  />
                </Field>
              </>
            )}
          </section>

              </>
            )}
            {aba === 'anim' && (
              <>
          <section className="editor-section">
            <h3>Apresentação</h3>
            <Field
              label="Animação"
              htmlFor="ov-anim"
              hint={anims.length ? undefined : 'nenhuma salva'}
            >
              <Select
                id="ov-anim"
                options={anims.map((a) => ({ value: a.id, label: a.name }))}
                value={setup.animId}
                onChange={(animId) => patch({ animId })}
                disabled={anims.length === 0}
                placeholder="Selecione"
                emptyLabel="Nenhuma"
                searchPlaceholder="Buscar animação..."
              />
            </Field>
            {/* O enquadramento é daqui, e não do template: ele depende de quem
                foi escalado, e escolher a animação só carrega o ponto de partida
                que ela trazia. Vale na hora, com a apresentação em cena. */}
            <Field label="Tamanho das figuras">
              <Range
                value={Math.round(figZoom * 100)}
                onChange={(v) => setFigZoom(v / 100)}
                min={60}
                max={130}
                suffix="%"
              />
            </Field>
            <Field label="Altura das figuras">
              <Range
                value={figOffsetY}
                onChange={setFigOffsetY}
                min={-180}
                max={180}
                suffix="px"
              />
            </Field>
            <button
              type="button"
              className="btn btn--primary"
              onClick={rodarAnim}
              disabled={!animTemplate}
            >
              Rodar apresentação
            </button>
            <p className="overlay-note">
              Toca uma vez sobre a cena e sai sozinha. As barras continuam onde
              estavam — use <strong>Ocultar barras</strong> para deixar o quadro só
              para ela.
            </p>
          </section>

              </>
            )}
            {aba === 'geral' && (
              <>
                <section className="editor-section">
                  <h3>Overlay</h3>
                  <Field label="Nome" htmlFor="ov-name">
                    <input
                      id="ov-name"
                      value={presetName}
                      placeholder="Ex.: Grand finals"
                      onChange={(e) => setPresetName(e.target.value)}
                    />
                  </Field>
                  <button type="button" className="btn btn--primary" onClick={savePreset}>
                    {salvo ? 'Salvar overlay' : 'Criar overlay'}
                  </button>
                </section>

                <section className="editor-section">
                  <h3>OBS</h3>
                  <div className="obs-grid">
                    <Field label="Endereço" htmlFor="ov-host">
                      <input
                        id="ov-host"
                        value={obs.host}
                        onChange={(e) => patchObs({ host: e.target.value })}
                      />
                    </Field>
                    <Field label="Porta" htmlFor="ov-port">
                      <input
                        id="ov-port"
                        type="number"
                        min={1}
                        max={65535}
                        value={obs.port}
                        onChange={(e) => patchObs({ port: Number(e.target.value) })}
                      />
                    </Field>
                  </div>
                  <Field label="Senha" htmlFor="ov-pass" hint="a mesma do OBS, se houver">
                    <input
                      id="ov-pass"
                      type="password"
                      value={obs.password}
                      onChange={(e) => patchObs({ password: e.target.value })}
                    />
                  </Field>
                  {/* Conectar fica junto do endereço e da senha, que é o que ele usa.
                      A conexão é da aplicação inteira e não desta tela: trocar de
                      overlay, ou ir até a lista e voltar, não a derruba. */}
                  {conectado ? (
                    <button type="button" className="btn btn--small" onClick={() => link.close()}>
                      Desconectar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--small btn--primary"
                      onClick={() => link.connect(obs.host, obs.port, obs.password)}
                      disabled={conn.estado === 'conectando'}
                    >
                      {conn.estado === 'conectando' ? 'Conectando...' : 'Conectar ao OBS'}
                    </button>
                  )}
                </section>

                <section className="editor-section">
                  <h3>Fonte de navegador</h3>
                  <Field label="URL" hint="1920x1080, sem fundo">
                    <div className="overlay-url">
                      <code>{LIVE_URL}</code>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Copiar com o estado atual"
                        aria-label="Copiar URL"
                        onClick={() => navigator.clipboard?.writeText(url)}
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </Field>
                  <Checkbox checked={auto} onChange={setAuto}>
                    Ao vivo — manda a cada mexida
                  </Checkbox>
                  {/* Com o "ao vivo" ligado o botão não teria o que fazer: some para não
                      sugerir que ainda falta um passo. */}
                  {!auto && (
                    <button type="button" className="btn btn--small btn--primary" onClick={send}>
                      Atualizar overlay
                    </button>
                  )}
                  {enviado && (
                    <p className="muted">Enviado às {new Date(enviado).toLocaleTimeString()}.</p>
                  )}
                </section>
              </>
            )}

            {aba === 'chave' && (
              <>
          <section className="editor-section">
            <h3>Chave em cena</h3>
            <Checkbox checked={showBracket} onChange={setShowBracket}>
              Mostrar a chave em cena
            </Checkbox>
            <p className="overlay-note">
              A chave ocupa a cena inteira e entra e sai com a animação do template. As
              barras continuam onde estavam, atrás dela.
            </p>
            {/*
             * O que está em cena, em uma linha. Existe porque a chave pode ir ao
             * ar vazia por três motivos diferentes — sem torneio, sem gente, sem
             * escalação — e do OBS não dá para saber qual deles é.
             */}
            {showBracket && (
              <p className="overlay-note">
                {!torneio
                  ? '⚠ Nenhum torneio escolhido: a chave não vai ao ar.'
                  : !bracketTpl
                    ? '⚠ Nenhum estilo escolhido: a chave não vai ao ar.'
                    : modo === 'times'
                      ? `Em cena: ${torres?.names[0]} x ${torres?.names[1]}, ${
                          shouldAutoSplit(torneio.towers)
                            ? `elenco dividido ao meio (${torneio.entries.length} inscritos)`
                            : `${torres?.sides[0].length} e ${torres?.sides[1].length} escalados`
                        }.`
                      : torneio.entries.length < 2
                        ? 'Em cena: a tela, sem confronto — faltam participantes.'
                        : `Em cena: ${torneio.entries.length} participantes, ${torneio.matches.length} confrontos.`}
              </p>
            )}
            <Field
              label="Estilo"
              htmlFor="ov-br-tpl"
              hint={bracketTemplates.length ? undefined : 'nenhum criado'}
            >
              <Select
                id="ov-br-tpl"
                options={bracketTemplates.map((t) => ({ value: t.id, label: t.name }))}
                value={bracketTpl?.id ?? null}
                onChange={setBracketTplId}
                disabled={bracketTemplates.length === 0}
                placeholder="Selecione"
                searchPlaceholder="Buscar estilo..."
              />
            </Field>
            {showBracket && (
              <>
                <Field label="Tamanho da chave">
                  <Range
                    value={Math.round(bracketZoom * 100)}
                    onChange={(v) => setBracketZoom(v / 100)}
                    min={30}
                    max={140}
                    suffix="%"
                  />
                </Field>
                <Field label="Mostrar a partir de" htmlFor="ov-desde" hint="a chave inteira raramente cabe">
                  <Select
                    id="ov-desde"
                    options={Array.from({ length: roundCount(torneio?.matches ?? []) }, (_, r) => ({
                      value: String(r),
                      label: roundName(r, roundCount(torneio?.matches ?? [])),
                    }))}
                    value={String(desdeRodada)}
                    onChange={(v) => setDesdeRodada(Number(v ?? 0))}
                    disabled={!torneio}
                    placeholder="Primeira rodada"
                  />
                </Field>
                <Field label="Ajuste vertical" hint="segure para rolar; clique no número para centrar">
                  <HoldNudge
                    value={bracketOffsetY}
                    onChange={setBracketOffsetY}
                    step={8}
                    min={-600}
                    max={600}
                    suffix="px"
                    labels={['↑', '↓']}
                    invert
                  />
                </Field>
              </>
            )}
          </section>

          {/*
           * O torneio e quem joga nele moram aqui, e não no editor de template.
           * O template é a cara da chave, reaproveitada de evento em evento;
           * quem entrou, quem ganhou e por quanto muda durante a transmissão, que
           * é onde esta tela está.
           */}
          <section className="editor-section">
            <h3>Torneio</h3>
            <Field label="Qual" htmlFor="ov-torneio" hint={tournaments.length ? undefined : 'nenhum criado'}>
              <Select
                id="ov-torneio"
                options={tournaments.map((t) => ({ value: t.id, label: t.name }))}
                value={torneio?.id ?? null}
                onChange={setTorneioId}
                disabled={tournaments.length === 0}
                placeholder="Selecione"
                emptyLabel="Nenhum"
                searchPlaceholder="Buscar torneio..."
              />
            </Field>
            {torneio && (
              <Field label="Nome" htmlFor="ov-torneio-nome">
                <input
                  id="ov-torneio-nome"
                  value={torneio.name}
                  onChange={(e) => updateTournament(torneio.id, { name: e.target.value })}
                />
              </Field>
            )}
            <div className="btn-row">
              <button
                type="button"
                className="btn btn--small"
                onClick={() => setTorneioId(addTournament('Novo torneio'))}
              >
                + Torneio
              </button>
              <button
                type="button"
                className="btn btn--small"
                title="Sortear a ordem e refazer a chave"
                disabled={!torneio || torneio.entries.length < 2}
                onClick={() => {
                  if (!torneio) return
                  const t = shuffle(torneio)
                  updateTournament(torneio.id, { entries: t.entries, matches: t.matches })
                }}
              >
                <DiceIcon /> Sortear
              </button>
              <button
                type="button"
                className="btn btn--small"
                disabled={!torneio}
                onClick={() => {
                  if (!torneio || !confirm(`Remover ${torneio.name}?`)) return
                  removeTournament(torneio.id)
                  setTorneioId(null)
                }}
              >
                Excluir
              </button>
            </div>
          </section>

          <section className="editor-section">
            <h3>
              Participantes{' '}
              <span className="count">
                {torneio?.entries.length ?? 0}/{MAX_ENTRIES}
              </span>
            </h3>
            {!torneio ? (
              <p className="overlay-note">Escolha ou crie um torneio para inscrever gente.</p>
            ) : (
              <>
                <Field label="Adicionar do cadastro" htmlFor="ov-add">
                  <Select
                    id="ov-add"
                    options={livres.map((p) => ({
                      value: p.id,
                      label: p.name,
                      hint: teamOf(p, teams)?.label,
                    }))}
                    value={null}
                    onChange={(id) => {
                      const p = players.find((x) => x.id === id)
                      if (p) patchEntries([...torneio.entries, { playerId: p.id, name: p.name }])
                    }}
                    disabled={livres.length === 0 || torneio.entries.length >= MAX_ENTRIES}
                    placeholder="Escolher player"
                    searchPlaceholder="Buscar player..."
                    /* Aceita quem não está cadastrado: num torneio aberto sempre
                       aparece alguém de última hora. */
                    onCustom={(texto) => patchEntries([...torneio.entries, { playerId: null, name: texto }])}
                  />
                </Field>
                <p className="overlay-note">
                  Digite um nome que não esteja na lista para inscrever alguém de fora do
                  cadastro. Mexer na ordem refaz os confrontos.
                </p>
                <ol className={`entry-list${modo === 'duo' ? ' entry-list--duo' : ''}`}>
                  {torneio.entries.map((e, i) => (
                    <li key={i}>
                      <span className="entry-list__n">{i + 1}</span>
                      <span className="entry-list__name">{nomeDe(e)}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Subir"
                        disabled={i === 0}
                        onClick={() => {
                          const t = swap(torneio, i, i - 1)
                          updateTournament(torneio.id, { entries: t.entries, matches: t.matches })
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Descer"
                        disabled={i === torneio.entries.length - 1}
                        onClick={() => {
                          const t = swap(torneio, i, i + 1)
                          updateTournament(torneio.id, { entries: t.entries, matches: t.matches })
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        title="Remover"
                        onClick={() => patchEntries(torneio.entries.filter((_, k) => k !== i))}
                      >
                        ✕
                      </button>
                      {/* A dupla é do participante, não uma segunda inscrição:
                          entra na mesma linha e some quando o modo não é duplas. */}
                      {modo === 'duo' && (
                        <span className="entry-list__partner">
                          <Select
                            options={players.map((p) => ({
                              value: p.id,
                              label: p.name,
                              hint: teamOf(p, teams)?.label,
                            }))}
                            value={e.partner?.playerId ?? null}
                            onChange={(id) => {
                              const p = players.find((x) => x.id === id)
                              setPartner(i, p ? { playerId: p.id, name: p.name } : null)
                            }}
                            placeholder={e.partner ? nomeDe(e.partner as Entry) : '+ dupla'}
                            emptyLabel="Sem dupla"
                            searchPlaceholder="Buscar player..."
                            onCustom={(texto) => setPartner(i, { playerId: null, name: texto })}
                          />
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <section className="editor-section">
            <h3>{modo === 'times' ? 'Torres' : 'Confronto'}</h3>
            {modo === 'times' ? (
              !torneio || !torres ? (
                <p className="overlay-note">Escolha ou crie um torneio para montar as torres.</p>
              ) : (
                <>
                  {([0, 1] as const).map((lado) => (
                    <div key={lado} className="tower-form">
                      <Field label={`Time ${lado + 1}`} htmlFor={`ov-time-${lado}`}>
                        <input
                          id={`ov-time-${lado}`}
                          value={torres.names[lado]}
                          onChange={(ev) =>
                            updateTowers(torneio.id, (t) => renameTeam(t, lado, ev.target.value))
                          }
                        />
                      </Field>

                      <Field label="Escalar" htmlFor={`ov-torre-${lado}`}>
                        <Select
                          id={`ov-torre-${lado}`}
                          options={torneio.entries
                            .map((e, i) => ({ e, i }))
                            .filter(
                              ({ i }) =>
                                !torres.sides[0].some((x) => x.entry === i) &&
                                !torres.sides[1].some((x) => x.entry === i)
                            )
                            .map(({ e, i }) => ({ value: String(i), label: nomeDe(e) }))}
                          value={null}
                          onChange={(v) =>
                            v !== null && updateTowers(torneio.id, (t) => addToTower(t, lado, Number(v)))
                          }
                          placeholder="Escolher participante"
                          searchPlaceholder="Buscar..."
                        />
                      </Field>
                      <ol className="entry-list">
                        {torres.sides[lado].map((slot, i) => (
                          <li key={i}>
                            <span className="entry-list__n">{i + 1}</span>
                            <span className={`entry-list__name${slot.dim ? ' is-dim' : ''}`}>
                              {nomeDe(torneio.entries[slot.entry])}
                            </span>
                            <span className="entry-list__n">{slot.score}</span>
                            <button
                              type="button"
                              className={`icon-btn${slot.dim ? ' is-on' : ''}`}
                              title={slot.dim ? 'Voltar a cor' : 'Deixar em cinza'}
                              onClick={() => updateTowers(torneio.id, (t) => dimInTower(t, lado, i))}
                            >
                              ◐
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              title="Tirar da torre"
                              onClick={() => updateTowers(torneio.id, (t) => removeFromTower(t, lado, i))}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn--small"
                      disabled={torneio.entries.length === 0}
                      title="Divide os inscritos entre os dois lados"
                      onClick={() =>
                        updateTowers(torneio.id, (t) => ({
                          ...t,
                          sides: autoSides(torneio.entries.length),
                        }))
                      }
                    >
                      Escalar todos
                    </button>
                    {/* Sem `disabled`: limpar uma escalação que ainda é a
                        automática é justamente o gesto que diz "quero as torres
                        vazias" — e é ele que desliga a divisão automática. */}
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => updateTowers(torneio.id, (t) => ({ ...t, sides: [[], []] }))}
                    >
                      Limpar escalação
                    </button>
                  </div>
                  <p className="overlay-note">
                    Ponto e cinza também saem da própria prévia: passe o mouse na vaga e use os
                    botões que aparecem nela. Sem escalação nenhuma, a cena divide os inscritos
                    ao meio para não ir ao ar vazia.
                  </p>
                </>
              )
            ) : (
              <>
                <Field label="Qual" htmlFor="ov-match" hint={torneio ? undefined : 'escolha um torneio'}>
                  <Select
                    id="ov-match"
                    options={confrontos.map((m) => ({
                      value: `${m.round}-${m.order}`,
                      label: `${nomeDoLado(m, 0)} x ${nomeDoLado(m, 1)}`,
                      hint: roundName(m.round, roundCount(torneio?.matches ?? [])),
                    }))}
                    value={confronto}
                    onChange={setConfronto}
                    disabled={confrontos.length === 0}
                    placeholder="Selecione"
                    emptyLabel="Nenhum"
                    searchPlaceholder="Buscar confronto..."
                  />
                </Field>
                {atual && (
                  <>
                    {([0, 1] as const).map((lado) => (
                      <Field key={lado} label={nomeDoLado(atual, lado)}>
                        <div className="score-row">
                          <button
                            type="button"
                            className="btn btn--small"
                            onClick={() =>
                              mexerNoConfronto((ms) => addMatchScore(ms, atual.round, atual.order, lado, -1))
                            }
                          >
                            −
                          </button>
                          <strong className="score-row__value">{atual.score[lado]}</strong>
                          <button
                            type="button"
                            className="btn btn--small"
                            onClick={() =>
                              mexerNoConfronto((ms) => addMatchScore(ms, atual.round, atual.order, lado, 1))
                            }
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className={`btn btn--small${atual.winner === lado ? ' btn--primary' : ''}`}
                            disabled={atual.slots[lado] === null}
                            onClick={() =>
                              mexerNoConfronto((ms) =>
                                setWinner(ms, atual.round, atual.order, atual.winner === lado ? null : lado)
                              )
                            }
                          >
                            {atual.winner === lado ? 'Venceu' : 'Passar'}
                          </button>
                        </div>
                      </Field>
                    ))}
                    <p className="overlay-note">
                      Passar alguém preenche a vaga dele na rodada seguinte. Mudar de ideia
                      refaz o caminho todo a partir daqui — o que vinha depois é recalculado,
                      não corrigido pela metade.
                    </p>
                  </>
                )}
                <p className="overlay-note">
                  Na prévia dá para mexer direto na vaga: ponto, cinza, tirar da casa (da
                  primeira rodada, não) e arrastar uma cópia de alguém para outra casa.
                </p>
              </>
            )}
          </section>

              </>
            )}
          </div>
        </div>

        <aside className="editor-screen__preview">
        <div className="overlay-preview" ref={fit.ref}>
          {/* O mesmo arranjo da página que o OBS carrega: centrado na
              horizontal, a `offsetY` px do topo. */}
          <div
            className="overlay-preview__scene"
            style={{ paddingTop: setup.offsetY * fit.scale }}
          >
            <OverlayStage payload={payload} scale={fit.scale} />
          </div>

          {/*
           * A chave entra na prévia pelo mesmo motivo que as barras: quem opera
           * o confronto daqui precisa ver o que "passar" fez. Conferir isso no
           * OBS significa olhar para outra tela no meio do set — e é justamente
           * aí que não dá para tirar os olhos daqui.
           *
           * Recebe o payload mesmo vazio, e não só quando há chave: é o
           * BracketStage que segura o último quadro no ar enquanto a saída toca.
           */}
          <div className="overlay-preview__bracket">
            <BracketStage
              play={payload.bracket}
              run={payload.bracketRun}
              phase={payload.bracketPhase}
              scale={fit.scale}
              zoom={bracketZoom}
              offsetY={bracketOffsetY}
              edit={bracketEdit}
            />
          </div>
        </div>


        </aside>
      </div>
    </>
  )
}

/**
 * Escala que faz a cena de 1920x1080 caber na largura da prévia.
 *
 * A prévia mostra o **quadro inteiro**, e não só as barras encaixadas na faixa.
 * Enquadrar só as barras deixava a posição vertical sem resposta na tela: o
 * controle existiria e o efeito dele só apareceria no OBS.
 */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setBox(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, scale: box ? box / SCENE.width : 0.4 }
}

/** O mesmo lado, reduzido ao que a apresentação precisa anunciar. */
function animSide(data: TopbarData): AnimSide {
  return { name: data.name, teamTag: data.teamTag, characterSlug: data.characterSlug }
}

/** Monta o TopbarData de um lado a partir do player escolhido. */
function sideData(side: Side, players: Player[], teams: Team[]): TopbarData {
  const player = players.find((p) => p.id === side.playerId)
  if (!player) return { ...EMPTY, score: side.score }
  const team = teamOf(player, teams)
  return {
    name: player.name,
    teamTag: team?.label ?? null,
    teamLogo: team?.logo ?? null,
    characterSlug: player.characterSlug,
    countryCode: player.countryCode,
    regionCode: player.regionCode,
    score: side.score,
  }
}
