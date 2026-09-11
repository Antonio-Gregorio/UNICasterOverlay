import { useEffect } from 'react'
import { artSource } from '../portrait'
import { useData } from '../data'
import { SCENE } from '../overlay/channel'
import type { AnimBackground, AnimPlay, AnimSide, AnimStyle } from './types'
import type { Character } from '../types'

/** A mesma cena do overlay: `scale` é só a lente por onde se olha. */
export { SCENE }

/**
 * A apresentação dos dois jogadores.
 *
 * HTML e CSS, e não SVG como o resto da arte do projeto — a escolha é deliberada
 * e é a inversa da de lá. A topbar e o gráfico de vencedores existem para virar
 * imagem, e SVG já é o próprio material de exportação. Isto aqui nunca vira
 * arquivo: toca uma vez na transmissão e acaba. O que importa é keyframe, e
 * keyframe em CSS é uma linha do que em SMIL seria um bloco.
 *
 * Toda a coreografia vive no CSS (ver a seção "animações" em styles.css). Aqui
 * só se monta o palco e se passam as variáveis: a duração, a cor de cada lado e
 * onde cada figura cai. Quem escolhe o passo é a classe `is-<style>`.
 */
export function AnimStage({
  play,
  scale = 1,
  onDone,
  held = false,
}: {
  play: AnimPlay
  scale?: number
  /** Chamado quando a animação termina — quem chama decide se desmonta. */
  onDone?: () => void
  /**
   * Congela a cena no meio da sustentação, em vez de tocar.
   *
   * É como a prévia do editor fica entre um teste e outro: parada no quadro em
   * que tudo está em cena. Terminar de verdade deixaria a tela vazia — o último
   * keyframe é a saída —, e uma prévia vazia lê como coisa quebrada.
   */
  held?: boolean
}) {
  const { characters } = useData()
  const { template, sides } = play

  useEffect(() => {
    if (!onDone || held) return
    const timer = setTimeout(onDone, template.duration)
    return () => clearTimeout(timer)
  }, [onDone, held, template.duration])

  // O disparo manda; o template é só o valor de partida — ver AnimPlay.
  const zoom = play.figureZoom ?? template.figureZoom ?? 1
  const offsetY = play.figureOffsetY ?? template.figureOffsetY ?? 0
  const left = figure(sides[0], characters, template.useSD, 0, zoom, offsetY)
  const right = figure(sides[1], characters, template.useSD, 1, zoom, offsetY)

  return (
    <div
      className="anim-scene-box"
      style={{ width: SCENE.width * scale, height: SCENE.height * scale }}
    >
      <div
        className={`anim-scene is-${template.style}${held ? ' is-held' : ''}`}
        style={{
          width: SCENE.width,
          height: SCENE.height,
          transform: `scale(${scale})`,
          fontFamily: template.typography.fontFamily,
          // A duração vira variável de CSS e as fases são frações dela: esticar
          // este número estica a coreografia inteira sem descolar as partes.
          ['--dur' as string]: `${template.duration}ms`,
          ['--accent' as string]: template.accentColor,
        }}
      >
        {/*
         * O fade fica em duas camadas aninhadas, e não numa animação só.
         *
         * Entrada e saída têm durações independentes, e keyframe de CSS não
         * aceita porcentagem vinda de variável — não dá para escrever "escurece
         * a partir de (dur - fadeOut)". Duas camadas resolvem por multiplicação:
         * a de fora abre, a de dentro fecha, e a opacidade de uma multiplica a
         * da outra sem que as duas disputem a mesma propriedade.
         */}
        <div
          className="anim-fade anim-fade--in"
          style={{ ['--fade' as string]: `${template.fadeIn ?? 0}ms` }}
        >
          <div
            className="anim-fade anim-fade--out"
            style={{
              ['--fade' as string]: `${template.fadeOut ?? 0}ms`,
              ['--fade-at' as string]: `${Math.max(0, template.duration - (template.fadeOut ?? 0))}ms`,
            }}
          >
            <Background bg={template.background} sceneryUrl={play.sceneryUrl ?? null} />
        <Effect style={template.style} />

        {[left, right].map((fig, i) => (
          <div
            key={i}
            className={`anim-side ${i === 0 ? 'is-left' : 'is-right'}`}
            style={{
              // Cada lado acende com a cor do próprio personagem quando o
              // template pede — o mesmo critério do brilho da topbar.
              ['--side-accent' as string]: template.useCharacterColor
                ? (fig?.color ?? template.accentColor)
                : template.accentColor,
            }}
          >
            <span className="anim-side__glow" aria-hidden="true" />
            {fig && (
              <img
                className="anim-side__art"
                src={fig.src}
                alt=""
                style={{ left: fig.left, top: fig.top, width: fig.width, height: fig.height }}
              />
            )}
            <div className="anim-side__label">
              <strong style={{ color: template.typography.nameColor }}>{sides[i].name}</strong>
              {template.showTeam && sides[i].teamTag && (
                <span style={{ color: template.typography.teamColor }}>{sides[i].teamTag}</span>
              )}
            </div>
          </div>
        ))}

            <div className="anim-vs" aria-hidden="true">
              <span>VS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * O fundo, atrás de tudo.
 *
 * O desfoque e o véu ficam em elementos separados da imagem porque `filter`
 * borra o que estiver dentro do elemento: aplicado no contêiner, levaria os
 * personagens junto.
 */
function Background({ bg, sceneryUrl }: { bg: AnimBackground; sceneryUrl: string | null }) {
  if (!bg || bg.type === 'none') return null

  const url = bg.type === 'scenery' ? sceneryUrl : bg.type === 'image' ? bg.image : null
  const stops = bg.gradient.stops.length ? bg.gradient.stops : [bg.color]

  return (
    <div className="anim-bg" aria-hidden="true">
      {url ? (
        <div
          className="anim-bg__photo"
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
          className="anim-bg__fill"
          style={{
            background:
              bg.type === 'gradient'
                ? `linear-gradient(${bg.gradient.angle}deg, ${stops.join(', ')})`
                : bg.color,
          }}
        />
      )}
      {bg.dim > 0 && <div className="anim-bg__dim" style={{ opacity: bg.dim / 100 }} />}
    </div>
  )
}

/**
 * A camada de efeito de cada coreografia.
 *
 * O que é forma vem em SVG mesmo dentro de uma peça em HTML — corrente é elo,
 * raio é traço —, mas quem os move continua sendo o CSS. Os efeitos que são só
 * repetição de uma partícula (brasa, pétala) saem de `particles`, que espalha
 * posição, atraso e deriva sem repetir vinte vezes o mesmo JSX.
 */
function Effect({ style }: { style: AnimStyle }) {
  switch (style) {
    case 'correntes':
      return (
        <svg className="anim-fx anim-fx--chains" viewBox="0 0 1920 1080" aria-hidden="true">
          <defs>
            {/* O elo, desenhado uma vez e repetido ao longo da diagonal. Um
                <pattern> não serviria: ele não acompanha a inclinação da linha,
                e os elos sairiam tortos em relação à própria corrente. */}
            {/* Dois desenhos e não um com `scale`: a propriedade CSS `scale`
                independente só existe a partir do Chrome 104, e o navegador
                embutido do OBS 30.0 é anterior a isso. Um segundo <ellipse>
                custa uma linha e funciona em qualquer versão. */}
            <ellipse id="anim-link" cx="0" cy="0" rx="27" ry="15" />
            <ellipse id="anim-link-flat" cx="0" cy="0" rx="11" ry="18" />
          </defs>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} className="anim-chain" style={{ ['--i' as string]: i }}>
              <g className="anim-chain__swing" style={{ transformOrigin: `960px ${chainY(i)}px` }}>
                {Array.from({ length: 26 }, (_, k) => {
                  const x = -120 + k * 84
                  const y = chainY(i) + (k - 13) * (i % 2 === 0 ? -5.6 : 5.6)
                  // Elo sim, elo não deitado: é o que faz uma corrente parecer
                  // corrente em vez de uma fila de argolas.
                  return (
                    <use
                      key={k}
                      href={k % 2 ? '#anim-link-flat' : '#anim-link'}
                      transform={`translate(${x} ${y}) rotate(${i % 2 === 0 ? -3.8 : 3.8})`}
                    />
                  )
                })}
              </g>
            </g>
          ))}
        </svg>
      )

    case 'chamas':
      return (
        <div className="anim-fx anim-fx--flame" aria-hidden="true">
          {/* Sete línguas com larguras e atrasos diferentes: uma faixa só sobe
              como bloco e lê como degradê, não como fogo. */}
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className="anim-flame__tongue"
              style={{
                ['--x' as string]: `${4 + i * 14}%`,
                ['--w' as string]: `${20 + (i % 3) * 10}%`,
                ['--delay' as string]: `${(i % 4) * 0.13}s`,
              }}
            />
          ))}
          <span className="anim-flame__base" />
          {particles(16, 'anim-ember')}
        </div>
      )

    case 'relampago':
      return (
        <div className="anim-fx anim-fx--bolt" aria-hidden="true">
          <svg viewBox="0 0 1920 1080">
            {[0, 1, 2].map((i) => (
              <path key={i} className="anim-bolt" style={{ ['--i' as string]: i }} d={boltPath(i)} />
            ))}
          </svg>
          <span className="anim-bolt__flash" />
        </div>
      )

    case 'estilhaco':
      return (
        <svg className="anim-fx anim-fx--shatter" viewBox="0 0 1920 1080" aria-hidden="true">
          {/* Cada caco gira e voa a partir do ponto do impacto, e não do próprio
              meio — senão o vidro estilhaça para dentro. */}
          {SHARDS.map((d, i) => (
            <path
              key={i}
              className="anim-shard"
              d={d}
              style={{ ['--i' as string]: i, ['--dir' as string]: i % 2 ? 1 : -1 }}
            />
          ))}
        </svg>
      )

    case 'neon':
      return (
        <div className="anim-fx anim-fx--neon" aria-hidden="true">
          <span className="anim-neon__grid" />
          <span className="anim-neon__sun" />
          <span className="anim-neon__sweep" />
        </div>
      )

    case 'petalas':
      return (
        <div className="anim-fx anim-fx--petals" aria-hidden="true">
          {particles(22, 'anim-petal')}
        </div>
      )

    case 'glitch':
      return (
        <div className="anim-fx anim-fx--glitch" aria-hidden="true">
          <span className="anim-glitch__scan" />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="anim-glitch__tear" style={{ ['--i' as string]: i }} />
          ))}
        </div>
      )

    case 'vortice':
      return (
        <div className="anim-fx anim-fx--vortex" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="anim-vortex__ring" style={{ ['--i' as string]: i }} />
          ))}
        </div>
      )

    case 'cortina':
      return (
        <div className="anim-fx anim-fx--curtain" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="anim-curtain__blade" style={{ ['--i' as string]: i }} />
          ))}
        </div>
      )

    case 'faiscas':
      return (
        <div className="anim-fx anim-fx--sparks" aria-hidden="true">
          {/* Estouro radial: cada faísca sai do centro num ângulo próprio, então
              o que varia aqui é ângulo e alcance, não a posição de partida. */}
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className="anim-spark"
              style={{
                ['--ang' as string]: `${(i * 360) / 28 + (i % 3) * 4}deg`,
                ['--far' as string]: `${420 + (i % 5) * 130}px`,
                ['--delay' as string]: `${(i % 4) * 0.05}s`,
                ['--size' as string]: `${4 + (i % 3) * 3}px`,
              }}
            />
          ))}
          <span className="anim-spark__burst" />
        </div>
      )

    case 'ondas':
      return (
        <div className="anim-fx anim-fx--waves" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="anim-wave" style={{ ['--i' as string]: i }} />
          ))}
        </div>
      )

    // Abertura: o clarão do encontro, no meio.
    default:
      return (
        <div className="anim-fx anim-fx--flash" aria-hidden="true">
          <span className="anim-flash__core" />
          <span className="anim-flash__ring" />
          <span className="anim-flash__bar" />
        </div>
      )
  }
}

/**
 * Partículas que caem ou sobem: posição, atraso, deriva e giro espalhados por
 * uma progressão, e não por sorteio.
 *
 * Sem `Math.random()` de propósito — ele daria uma distribuição diferente a cada
 * render do React, e a mesma animação sairia diferente no painel e no OBS. Os
 * multiplicadores são primos entre si para os valores não caírem em fileira.
 */
function particles(count: number, className: string) {
  return Array.from({ length: count }, (_, i) => (
    <span
      key={i}
      className={className}
      style={{
        ['--x' as string]: `${(i * 37) % 100}%`,
        ['--delay' as string]: `${((i * 7) % 11) * 0.14}s`,
        ['--drift' as string]: `${(i % 2 ? 1 : -1) * (30 + ((i * 13) % 7) * 22)}px`,
        ['--size' as string]: `${6 + ((i * 5) % 4) * 4}px`,
        ['--spin' as string]: `${(i % 2 ? 1 : -1) * (180 + ((i * 11) % 5) * 90)}deg`,
      }}
    />
  ))
}

/** Altura de cada corrente, espalhadas pelo quadro. */
function chainY(i: number): number {
  return 120 + i * 220
}

/** Um raio: zigue-zague descendo do topo, cada um com a sua inclinação. */
function boltPath(i: number): string {
  const x = [430, 960, 1490][i]
  const w = i === 1 ? 120 : 90
  return [
    `M ${x} -40`,
    `L ${x - w * 0.5} 260`,
    `L ${x + w * 0.28} 300`,
    `L ${x - w * 0.75} 640`,
    `L ${x + w * 0.15} 680`,
    `L ${x - w * 0.35} 1120`,
  ].join(' ')
}

/** Os cacos do estilhaço, em leque a partir do centro do quadro. */
const SHARDS = [
  'M960 540 L1360 120 L1620 420 Z',
  'M960 540 L1620 420 L1780 760 Z',
  'M960 540 L1780 760 L1420 1000 Z',
  'M960 540 L1420 1000 L960 1120 Z',
  'M960 540 L960 1120 L500 1000 Z',
  'M960 540 L500 1000 L140 760 Z',
  'M960 540 L140 760 L300 420 Z',
  'M960 540 L300 420 L560 120 Z',
  'M960 540 L560 120 L960 -40 Z',
  'M960 540 L960 -40 L1360 120 Z',
]

/**
 * A régua da arte oficial: **média geométrica de cabeça e área desenhada**.
 *
 * A altura desenhada, que o gráfico de vencedores usa (`leaderFigure`), não serve
 * aqui: ela mede o enquadramento da ilustração, não o personagem. A arte do Hyde
 * é um plano afastado onde espada e rastro respondem por metade da figura; a da
 * Linne é um plano fechado onde quase tudo é ela. Por altura, a Linne saía
 * "gigante" ao lado dele estando mais baixa.
 *
 * As duas réguas que sobram erram, e para o mesmo lado em personagens
 * diferentes:
 *
 * - **Cabeça** (`face.width`) é imune a pose, mas as caixas não foram marcadas
 *   com o mesmo critério — a do Hyde inclui o cabelo espetado, o que infla o
 *   número e o encolhe.
 * - **Área** de corpo sólido é imune a pose e a enquadramento, mas capa e
 *   vestido contam como corpo, e ela encolhe quem tem manto.
 *
 * A média geométrica divide cada erro pela metade em vez de somá-los. Conferida
 * contra os seis ajustes já julgados a olho, acerta cinco; cada régua sozinha
 * acerta dois. O que ela erra vira exceção em scripts/scale-overrides.json — hoje
 * só a Wagner, de manto grande demais para a área.
 */

/** Largura da cabeça na cena, em px, se a régua fosse só cabeça. */
const ART_HEAD = 106
/** Área desenhada alvo, em px² de cena, se a régua fosse só área. */
const ART_AREA = 125247
/**
 * O chibi não tem caixa de rosto, então a régua dele é olhos-pés — e ela sozinha
 * erra pelo mesmo motivo que a altura erra na arte oficial: mede o enquadramento.
 * Medida a área desenhada com olhos-pés fixo, ela variava **9,47x** no elenco (o
 * chibi do Waldstein dava 687k contra 72k do Ogre). A mesma média geométrica com
 * a área derruba para 3,08x.
 */
const SD_FEET = 360
/** Área desenhada alvo do chibi, em px² de cena. O par de ART_AREA. */
const SD_AREA = 98186
/**
 * Largura máxima da imagem. Não há teto de **altura**, e isso é deliberado.
 *
 * Um teto de altura mede a extensão desenhada, que inclui adereço: a foice do
 * Gordeau, a espada da Kaguya, as fitas da Izumi, as asas do Londrekia. Medido em
 * "cabeças de largura", a arte deles tem 5,3 a 7,7 contra 3,6 do Akatsuki — e o
 * teto encolhia justamente esses, deixando a Vatista em 81% do tamanho dos
 * outros. Sem teto, o adereço sangra para fora do quadro e o personagem fica do
 * tamanho certo, que é o que se olha.
 */
const MAX_WIDTH = 1120
/**
 * Altura da cena em que o rosto de todo mundo cai — uma por modo de arte.
 *
 * O chibi precisa da linha bem mais baixa: ele é atarracado e tem cabeça e
 * cabelo enormes em relação a olhos-pés, então com a linha da arte oficial onze
 * dos vinte e sete batiam no topo do quadro. Os dois números saíram de varrer a
 * combinação (régua, linha) que deixa o menor desvio de rosto no elenco todo.
 */
const FACE_AT_Y = { art: 0.3, sd: 0.48 }
/**
 * A faixa livre.
 *
 * A base é o pé da cena, e não o topo do nome: o corpo pode passar por trás da
 * faixa do nome — ela é desenhada depois e tem sombra própria. Parando o corpo
 * antes dela, dezoito dos vinte e oito eram empurrados para cima e o rosto
 * variava 384px, o que desfaz justamente a linha comum que a régua de cabeça
 * existe para dar.
 */
const BAND = { top: 16, base: 1064 }

interface Figure {
  src: string
  left: number
  top: number
  width: number
  height: number
  color: string | null
}

/** Largura renderizada do chibi: média de olhos-pés e área, como na arte. */
function sdWidth(below: number, solid: number | null, aspect: number): number {
  const porPes = SD_FEET / below
  if (!solid) return porPes * aspect
  const porArea = Math.sqrt(SD_AREA / (solid * aspect))
  return Math.sqrt(porPes * porArea) * aspect
}

/**
 * Largura renderizada da arte oficial, pela média das duas réguas.
 *
 * Sem `artSolid` medido cai na régua de cabeça sozinha, que é o que havia antes:
 * um personagem novo desenha razoável antes de `npm run data:scale` rodar.
 */
function artWidth(faceWidth: number, solid: number | null, aspect: number): number {
  const porCabeca = ART_HEAD / faceWidth
  if (!solid) return porCabeca
  // frac x largura² / aspect = área  =>  largura = raiz(área x aspect / frac)
  const porArea = Math.sqrt((ART_AREA * aspect) / solid)
  return Math.sqrt(porCabeca * porArea)
}

function figure(
  side: AnimSide,
  characters: Character[],
  useSD: boolean,
  index: 0 | 1,
  zoom: number,
  offsetY: number
): Figure | null {
  const character = characters.find((c) => c.slug === side.characterSlug)
  if (!character) return null
  const source = artSource(character, useSD)
  if (!source) return null

  const body = source.body ?? { above: 0.35, below: 0.65 }

  /**
   * Arte oficial pela caixa de rosto; chibi pelos olhos-pés, que é a régua que
   * ele tem. Sem nenhum dos dois, o encaixe simples da metade.
   *
   * `source.scale` é a correção à mão de scripts/scale-overrides.json, e entra
   * aqui pelo mesmo motivo que entra em `rosterWidth`: ela foi calibrada contra
   * uma régua de cabeça, que é esta. Sem ela as cinco artes com correção acima de
   * 1 saíam pequenas — a Wagner, de 1.3, ficava em 509px contra uma mediana de
   * 780. No chibi vale 1: ali a correção já está gravada no próprio sprite.
   */
  // `animScale` é a correção só desta tela; `source.scale` é a da arte oficial,
  // compartilhada com os retratos do gráfico de vencedores. Ver src/types.ts.
  const z = zoom * source.scale
  /**
   * `animScale` só vale para a arte oficial: foi calibrada olhando ela, e o chibi
   * tem régua própria. Aplicá-la nos dois faria a correção do gigante entrar
   * duas vezes no sprite dele.
   */
  let width = source.face
    ? artWidth(source.face.width, character.artSolid ?? null, source.aspect) * z * (character.animScale ?? 1)
    : source.body
      ? sdWidth(body.below, character.sdSolid ?? null, source.aspect) * z
      : (SCENE.width / 2) * z
  let height = width / source.aspect

  // A trava é o que impede a régua de jogar um personagem para fora do quadro:
  // 8 dos 28 encostam nela, e sem ela a Vatista sairia com 1313px de figura numa
  // cena de 1080.
  const k = Math.min(1, MAX_WIDTH / width)
  width *= k
  height *= k

  /**
   * O ponto do **rosto**, não o do corpo.
   *
   * `bodyAnchor` existe para o gráfico de vencedores, onde a mira que enquadra
   * bem uma cabeça deixa a figura torta no quadro — ali o alvo é o centro do
   * corpo. Aqui o alvo é o rosto, e usar o outro ponto tirava a Yuzuriha (a
   * única do elenco que tem `bodyAnchor`) da linha por 65px.
   */
  const anchorX = source.anchor?.x ?? 0.5
  const anchorY = source.anchor?.y ?? 0.35

  /**
   * A âncora do lado direito é a espelhada, não a do arquivo.
   *
   * A arte da direita entra invertida por `scaleX(-1)`, que reflete em torno do
   * centro da própria imagem: um rosto a 20% da borda esquerda vai parar a 20%
   * da direita, ou seja a 80% do começo. Mirando pela âncora original, metade do
   * elenco saía do lugar — 123px de erro na mediana e 515px no pior caso.
   */
  const mira = index === 0 ? anchorX : 1 - anchorX

  // O rosto vai para o meio da metade, que é onde o nome fica centrado — assim a
  // faixa do nome cai exatamente sob o rosto. Antes o rosto ficava a 55% (ou 45%)
  // e o nome a 50%, e os dois não se encontravam.
  const alvo = (SCENE.width / 2) * 0.5

  /**
   * Na vertical o rosto mira uma linha comum, mas **quem não caberia é empurrado
   * para dentro, não encolhido**.
   *
   * Já tentei o contrário — garantir a linha e encolher quem estoura. Alinha os
   * rostos, mas cobra em tamanho de quem tem muito desenhado acima do rosto (as
   * luvas da Mika, as asas da Kuon), e eram justamente os que tinham acabado de
   * ser ajustados à mão. Empurrar preserva o tamanho e não corta nada; o preço é
   * que sete dos vinte e oito ficam fora da linha.
   *
   * A conta é pela **imagem** e não pela figura medida: `artBody.above` para no
   * topo do corpo com substância, e asa fina, ponta de cabelo e auréola não
   * contam — foi assim que a Kuon perdia 95px de asa.
   */
  const faceY = SCENE.height * FACE_AT_Y[source.face ? 'art' : 'sd']
  let top = faceY - anchorY * height + offsetY
  const figBase = top + (anchorY + body.below) * height
  if (top < BAND.top) top += BAND.top - top
  else if (figBase > BAND.base) {
    // Subir para caber embaixo nunca pode cortar a cabeça: quem é alto demais
    // para a faixa sangra pelos pés, que é o que uma tela de confronto faz.
    top -= Math.min(figBase - BAND.base, top - BAND.top)
  }

  return {
    src: source.href,
    width,
    height,
    left: alvo - mira * width,
    top,
    color: character.colors?.[0]?.hex ?? null,
  }
}
