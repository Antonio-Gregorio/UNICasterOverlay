import { useData } from '../data'
import { SCENE } from '../overlay/channel'
import { Slot } from './Slot'
import { TowersView } from './TowersView'
import { roundCount, roundName } from './seed'
import type {
  BracketAlign,
  BracketBackground,
  BracketEdit,
  BracketFrame,
  BracketPlay,
  BracketTemplate,
  Match,
  Person,
} from './types'

/** Onde o título encosta. A chave continua centrada: só ele se move. */
const ALIGN: Record<BracketAlign, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

/**
 * Desenha a tela da chave — a cena inteira, e não uma caixa dentro dela.
 *
 * Quando a chave entra, ela **é** a tela: o fundo cobre os 1920x1080, o efeito
 * corre pela borda do quadro e o conteúdo fica centrado no meio. Em HTML e não
 * em SVG, pela mesma razão da apresentação: isto não vira arquivo, é uma peça de
 * tela que muda a cada confronto — e o que se ganha em troca é o layout, já que
 * uma chave é uma grade de colunas com espaçamento que dobra a cada rodada.
 *
 * Serve os dois lados, a prévia do painel e a fonte do OBS. A diferença entre
 * eles é `scale` e o `edit`: no painel a vaga aceita gesto, no OBS é imagem.
 */
export function BracketView({
  play,
  scale = 1,
  zoom = 1,
  offsetY = 0,
  phase = null,
  edit,
}: {
  play: BracketPlay
  /** Cena de 1920x1080 → tamanho real de quem está desenhando. */
  scale?: number
  /** Tamanho da chave dentro da cena. Não mexe no título nem na moldura. */
  zoom?: number
  /** Ajuste vertical da chave a partir do centro, em px de cena. */
  offsetY?: number
  /** Ponta da animação em curso. Nulo = parada em cena. */
  phase?: 'in' | 'out' | null
  /** Gestos do painel. Ausente = desenho parado. */
  edit?: BracketEdit
}) {
  const { backgrounds } = useData()
  const { template, tournament, people } = play
  const { background: fundo, frame, info, transition } = template
  const times = template.mode === 'times'
  const total = roundCount(tournament.matches)
  /*
   * Sem confronto nenhum a tela continua de pé, com o quadro e o título e sem
   * vaga dentro. Ela sumia, e isso é pior do que parece: tirar o último
   * participante — ou trocar para um torneio que ainda não foi montado —
   * apagava a peça inteira do ar no meio da transmissão, quando o que se queria
   * era só limpar a chave.
   */
  const desde = Math.min(Math.max(0, play.fromRound ?? 0), Math.max(0, total - 1))

  /*
   * O cenário é resolvido aqui, e não no painel como a logo e as pessoas: ele
   * mora em public/backgrounds/index.json, que a fonte do OBS carrega do mesmo
   * endereço de onde carrega a página. O que precisa viajar resolvido no payload
   * é só o que existe apenas no localStorage desta máquina.
   */
  const cenario = backgrounds.find((b) => b.id === fundo.presetId)?.url ?? null

  /*
   * Duas escalas, e não uma. `scale` é a lente de quem olha — a prévia encolhida
   * no painel, a fonte do OBS que não é 1920 de largura — e vale para a moldura,
   * o respiro e o título. `z` leva junto o zoom da chave, que é decisão de quem
   * opera: cabe mais rodada em cena sem encolher o título junto.
   */
  const z = scale * zoom
  const raio = fundo.radius * scale

  const titulo = info.title.trim() || tournament.name

  /*
   * A barra inclinada, em variáveis de CSS.
   *
   * `--incl` é metade da inclinação em % da largura: o corte tem o topo em
   * `p + incl` e a base em `p - incl`, e a faixa recebe o mesmo desnível por um
   * `skewX`. A conta usa a proporção da cena (1080/1920), porque o deslocamento
   * horizontal de uma diagonal depende da altura que ela atravessa.
   *
   * `--folga` é o tanto que a passada anda além das bordas: numa diagonal, o
   * canto de cima chega antes do de baixo, e sem a folga um triângulo do quadro
   * ficava para trás no fim da entrada.
   */
  const inclinacao = ((SCENE.height / SCENE.width) * Math.tan(((transition.angle ?? 0) * Math.PI) / 180) * 100) / 2
  const folga = Math.abs(inclinacao) + 4

  return (
    <div
      className={`bracket-scene is-${transition.style}${phase ? ` is-${phase}` : ''}`}
      style={{
        width: SCENE.width * scale,
        height: SCENE.height * scale,
        borderRadius: raio,
        fontFamily: template.typography.fontFamily,
        ['--troca' as string]: `${Math.max(0, transition.duration)}ms`,
        ['--barra' as string]: frame.color,
        ['--incl' as string]: `${inclinacao}%`,
        ['--folga' as string]: `${folga}%`,
        ['--torcao' as string]: `${-(transition.angle ?? 0)}deg`,
      }}
    >
      {/* Tudo que entra e sai junto fica nesta camada: é ela que o fade apaga e
          que a barra descobre. A barra em si corre por fora, senão o próprio
          recorte a esconderia. */}
      <div className="bracket-scene__layer">
        <Background bg={fundo} sceneryUrl={cenario} radius={raio} />
        <Frame frame={frame} scale={scale} radius={raio} />

        <div className="bracket-scene__inner" style={{ padding: fundo.padding * scale }}>
          {info.showTitle && (titulo || info.subtitle) && (
            <header className="bracket-head" style={{ alignItems: ALIGN[info.align] }}>
              {titulo && (
                <strong style={{ color: info.color, fontSize: info.size * scale }}>{titulo}</strong>
              )}
              {info.subtitle && (
                <span style={{ color: info.color, fontSize: info.size * 0.42 * scale }}>
                  {info.subtitle}
                </span>
              )}
            </header>
          )}

          {/*
           * O conteúdo fica no meio do que sobra, e o ajuste é a partir dali:
           * numa tela cheia, medir do topo obrigava a refazer a conta toda vez que
           * o título mudava de tamanho ou uma rodada saía de cena.
           *
           * A área é fechada (`overflow: hidden` no corpo) e o deslocamento fica
           * **dentro** dela, e não nela: uma chave de 64 vagas é mais alta que a
           * tela, e subindo ela passava por cima do nome do evento. Assim ela para
           * onde o título começa, e quem precisa de mais rodada em cena usa o
           * tamanho ou o corte de rodadas.
           */}
          <div className="bracket-scene__body">
            <div
              className="bracket-scene__fit"
              style={{ transform: offsetY ? `translateY(${offsetY * scale}px)` : undefined }}
            >
            {times ? (
              <TowersView
                towers={tournament.towers}
                template={template}
                people={people}
                scale={z}
                edit={edit}
              />
            ) : (
              <div
                className="bracket"
                style={{
                  gap: template.slot.columnGap * z,
                  ['--slot-h' as string]: `${template.slot.height * z}px`,
                  ['--slot-w' as string]: `${template.slot.width * z}px`,
                  ['--slot-gap' as string]: `${template.slot.gap * z}px`,
                }}
              >
                {Array.from({ length: total - desde }, (_, i) => desde + i).map((round) => (
                  <div key={round} className="bracket__round">
                    {info.showRounds && (
                      <p
                        className="bracket__round-name"
                        style={{ fontSize: info.roundSize * z, color: info.roundColor }}
                      >
                        {roundName(round, total)}
                      </p>
                    )}
                    <div className="bracket__column">
                      {tournament.matches
                        .filter((m) => m.round === round)
                        .sort((a, b) => a.order - b.order)
                        .map((m) => (
                          <MatchBox
                            key={`${m.round}-${m.order}`}
                            match={m}
                            template={template}
                            people={people}
                            scale={z}
                            edit={edit}
                            /*
                             * O espaço entre confrontos dobra a cada rodada: é o que faz
                             * cada par da coluna anterior apontar para o meio do seu
                             * confronto seguinte, sem desenhar uma única linha de ligação.
                             *
                             * Conta a partir da primeira rodada **exibida**: cortando as
                             * iniciais, a que sobra vira a base e o espaçamento recomeça
                             * nela — senão a chave nasceria com a altura das que não estão
                             * mais lá.
                             */
                            spread={2 ** (round - desde)}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/*
       * A faixa só existe enquanto há entrada ou saída acontecendo, e é remontada
       * a cada ponta (`key`): sem isso a animação da entrada já tinha terminado
       * quando a saída começava, e o CSS não a repete — a tela saía sem o feixe,
       * que era o que a entrada tinha de melhor.
       */}
      {transition.style === 'barra' && phase && (
        <span key={phase} className="bracket-wipe" aria-hidden="true" />
      )}
    </div>
  )
}

/**
 * O fundo da tela.
 *
 * O desfoque e o véu ficam em elementos separados da imagem porque `filter`
 * borra o que estiver dentro do elemento: aplicado no contêiner, levaria as
 * vagas junto.
 */
function Background({
  bg,
  sceneryUrl,
  radius,
}: {
  bg: BracketBackground
  sceneryUrl: string | null
  radius: number
}) {
  if (bg.type === 'none') return null

  const url = bg.type === 'scenery' ? sceneryUrl : bg.type === 'image' ? bg.image : null
  const stops = bg.gradient.stops.length ? bg.gradient.stops : [bg.color]

  return (
    <div className="bracket-bg" style={{ borderRadius: radius }} aria-hidden="true">
      {url ? (
        <div
          className="bracket-bg__photo"
          style={{
            backgroundImage: `url(${JSON.stringify(url)})`,
            // A escala acompanha o desfoque: borrar deixa a borda transparente,
            // e sem a folga aparece uma moldura clara em volta do quadro.
            filter: bg.blur ? `blur(${bg.blur}px)` : undefined,
            transform: bg.blur ? `scale(${1 + bg.blur / 120})` : undefined,
          }}
        />
      ) : (
        <div
          className="bracket-bg__fill"
          style={{
            background:
              bg.type === 'gradient'
                ? `linear-gradient(${bg.gradient.angle}deg, ${stops.join(', ')})`
                : bg.color,
          }}
        />
      )}
      {bg.dim > 0 && <div className="bracket-bg__dim" style={{ opacity: bg.dim / 100 }} />}
    </div>
  )
}

/**
 * O efeito em volta da tela.
 *
 * Os dois que percorrem a borda saem em SVG: em CSS o mesmo exigiria recortar o
 * miolo com `mask`, que o navegador embutido do OBS nem sempre compõe do jeito
 * esperado. Os outros três são CSS puro, que para eles basta.
 */
function Frame({ frame, scale, radius }: { frame: BracketFrame; scale: number; radius: number }) {
  if (frame.style === 'none') return null

  const espessura = Math.max(1, frame.thickness * scale)
  const vars = {
    ['--fx' as string]: frame.color,
    ['--fx-op' as string]: String(frame.intensity / 100),
    ['--fx-dur' as string]: `${Math.max(200, frame.speed)}ms`,
    ['--fx-w' as string]: `${espessura}px`,
    borderRadius: radius,
  }

  if (frame.style === 'corrida' || frame.style === 'tracejado') {
    return (
      <svg className={`bracket-fx bracket-fx--${frame.style}`} style={vars} aria-hidden="true">
        {/*
         * O traço fica centrado na borda do quadro, e o CSS recua a caixa meia
         * espessura para ele caber inteiro na tela — ver .bracket-fx--corrida.
         *
         * `pathLength` reescreve a régua do contorno para 100, e é o que permite
         * um tracejado em proporção: o perímetro real muda a cada rodada exibida
         * e a cada resultado, e um dash em px teria que ser refeito junto.
         */}
        <rect
          className="bracket-fx__base"
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={radius}
          fill="none"
          strokeWidth={espessura}
        />
        <rect
          className="bracket-fx__run"
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={radius}
          fill="none"
          pathLength={100}
          strokeWidth={espessura}
        />
      </svg>
    )
  }

  if (frame.style === 'faiscas') {
    return (
      <span className="bracket-fx bracket-fx--faiscas" style={vars} aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => {
          const ponto = edgePoint(((i * 37) % 100) / 100)
          const alcance = (10 + ((i * 13) % 5) * 6) * scale
          return (
            <span
              key={i}
              className="bracket-spark"
              style={{
                left: `${ponto.x}%`,
                top: `${ponto.y}%`,
                ['--dx' as string]: `${ponto.dx * alcance}px`,
                ['--dy' as string]: `${ponto.dy * alcance}px`,
                ['--size' as string]: `${(3 + ((i * 5) % 3)) * scale}px`,
                ['--delay' as string]: `${((i * 7) % 11) * 0.19}s`,
              }}
            />
          )
        })}
      </span>
    )
  }

  if (frame.style === 'varredura') {
    return (
      <span className="bracket-fx bracket-fx--varredura" style={vars} aria-hidden="true">
        <span className="bracket-fx__shine" />
      </span>
    )
  }

  return <span className="bracket-fx bracket-fx--pulso" style={vars} aria-hidden="true" />
}

/**
 * Um ponto do contorno, dado quanto dele já se andou (0 a 1), e para que lado é
 * "para fora" ali.
 *
 * Andar o perímetro em vez de sortear x e y é o que mantém as faíscas presas à
 * borda: sorteadas, metade cairia no meio da chave, por cima dos nomes.
 */
function edgePoint(t: number): { x: number; y: number; dx: number; dy: number } {
  const p = ((t % 1) + 1) % 1
  if (p < 0.25) return { x: p * 400, y: 0, dx: 0, dy: -1 }
  if (p < 0.5) return { x: 100, y: (p - 0.25) * 400, dx: 1, dy: 0 }
  if (p < 0.75) return { x: 100 - (p - 0.5) * 400, y: 100, dx: 0, dy: 1 }
  return { x: 0, y: 100 - (p - 0.75) * 400, dx: -1, dy: 0 }
}

function MatchBox({
  match,
  template,
  people,
  scale,
  spread,
  edit,
}: {
  match: Match
  template: BracketTemplate
  people: Person[]
  scale: number
  spread: number
  edit?: BracketEdit
}) {
  const altura = (template.slot.height * 2 + template.slot.gap) * spread + template.slot.gap * (spread - 1)
  return (
    <div className="bracket__match" style={{ height: altura * scale }}>
      {([0, 1] as const).map((lado) => (
        <Slot
          key={lado}
          person={match.slots[lado] !== null ? (people[match.slots[lado]!] ?? null) : null}
          score={match.score[lado]}
          template={template}
          scale={scale}
          /* Perdedor é quem estava no confronto e não passou — vaga vazia não
             perdeu nada, e cinzá-la faria a chave parecer toda derrotada. O
             cinza à mão soma a esse: é decisão de quem opera, não do resultado. */
          lost={
            (match.winner !== null && match.winner !== lado && match.slots[lado] !== null) ||
            Boolean(match.dim?.[lado])
          }
          won={match.winner === lado}
          edit={edit}
          slotRef={{ kind: 'match', round: match.round, order: match.order, side: lado }}
          /* Da primeira rodada ninguém sai: é ali que a lista de participantes
             está desenhada, e tirar alguém de lá o perderia da chave inteira. */
          canRemove={match.round > 0 && match.slots[lado] !== null}
        />
      ))}
    </div>
  )
}
