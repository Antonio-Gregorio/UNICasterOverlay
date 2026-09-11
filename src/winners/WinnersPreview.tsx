import { useId, useLayoutEffect, useRef, useState } from 'react'
import { CANVAS, FOOTER, HEADER, LAYOUTS, leaderBox, type Slot } from './layouts'
import { gradientVector } from '../topbar/shape'
import { artSource, leaderFigure, portraitPath, rosterPlacement, type Box } from '../portrait'
import { countryFlag, regionFlag } from '../flags'
import { FlagSvg } from '../FlagSvg'
import { FLAG_ASPECT } from '../Flag'
import type { ArtSource } from '../portrait'
import type { Competitor, GraphicContent, LeaderPlacement, TextStyle, WinnersTemplate } from './types'
import type { Character, FlagManifest } from '../types'

/**
 * Desenha o gráfico de vencedores inteiro em SVG — mesma escolha do editor de
 * topbar: silhuetas livres, degradês e contornos são nativos aqui, e a peça já
 * nasce pronta para virar imagem em qualquer resolução.
 */
export function WinnersPreview({
  template,
  content,
  characters,
  flags,
  eventLogo,
  backgroundUrl,
  width = 900,
}: {
  template: WinnersTemplate
  content: GraphicContent
  characters: Character[]
  flags: FlagManifest | null
  /** Data URL da logo escolhida na aba Logos, já resolvida. */
  eventLogo: string | null
  /** URL do fundo do preset escolhido, já resolvida. */
  backgroundUrl: string | null
  width?: number
}) {
  const uid = useId().replace(/:/g, '')
  const { competitors } = content
  const spec = LAYOUTS[template.layout]
  const count = Math.min(template.slotCount, spec.maxSlots)
  const withLeaders = template.layout === 'team-vs' && template.leaders.show
  const slots = spec.slots(count, {
    leaders: withLeaders,
    widthScale: template.portrait.widthScale,
    heightScale: template.portrait.heightScale,
    gapX: template.grid.gapX,
    gapY: template.grid.gapY,
    spread: template.grid.spread,
  })
  const bySlug = new Map(characters.map((c) => [c.slug, c]))

  const bg = template.background
  const bgVector = gradientVector(bg.gradient.angle)
  const bgStops = bg.gradient.stops.length ? bg.gradient.stops : [bg.color]
  const photo = bg.type === 'preset' ? backgroundUrl : bg.type === 'image' ? bg.image : null

  return (
    <svg
      className="winners-svg"
      width={width}
      height={(width * CANVAS.height) / CANVAS.width}
      viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
      role="img"
      aria-label={`Gráfico ${template.name || 'sem nome'}`}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} {...bgVector}>
          {bgStops.map((color, i) => (
            <stop key={i} offset={bgStops.length === 1 ? 0 : i / (bgStops.length - 1)} stopColor={color} />
          ))}
        </linearGradient>
        <linearGradient id={`border-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={template.portrait.borderColor} />
          <stop offset="1" stopColor={template.portrait.borderColor2} />
        </linearGradient>
        <linearGradient id={`event-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={template.event.style.color} />
          <stop offset="1" stopColor={template.event.gradientColor2} />
        </linearGradient>
        {/* O time perdedor sai dessaturado: a diferença já diz quem ganhou. */}
        <filter id={`gray-${uid}`}>
          <feColorMatrix type="saturate" values="0.05" />
        </filter>
        {template.portrait.shadow !== 'none' && (
          // Descola a moldura do fundo. Os presets são de propósito leves: o
          // exagero aqui vira borrão escuro em volta de cada card.
          <filter id={`shadow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow {...SHADOWS[template.portrait.shadow]} floodColor="#000000" />
          </filter>
        )}
      </defs>

      {/* --- fundo --- */}
      {photo ? (
        <>
          <rect width={CANVAS.width} height={CANVAS.height} fill={bg.color} />
          <image
            href={photo}
            width={CANVAS.width}
            height={CANVAS.height}
            preserveAspectRatio="xMidYMid slice"
          />
          <rect
            width={CANVAS.width}
            height={CANVAS.height}
            fill={bg.overlayColor}
            opacity={bg.overlayOpacity / 100}
          />
        </>
      ) : (
        <rect
          width={CANVAS.width}
          height={CANVAS.height}
          fill={bg.type === 'gradient' ? `url(#bg-${uid})` : bg.color}
        />
      )}

      {withLeaders &&
        ([0, 1] as const).map((side) => (
          <Leader
            key={side}
            uid={`${uid}-l${side}`}
            side={side}
            box={leaderBox(side, count, {
              gapX: template.grid.gapX,
              spread: template.grid.spread,
            })}
            competitor={content.leaders[side]}
            placement={content.leaderLayout[side]}
            dim={content.winner !== null && content.winner !== side}
            bySlug={bySlug}
            grayId={`gray-${uid}`}
          />
        ))}

      {template.event.show && (
        <EventHeader uid={uid} template={template} name={content.eventName} logo={eventLogo} />
      )}

      {/* --- rótulo de cada lado, no layout de confronto --- */}
      {template.layout === 'team-vs' &&
        ([0, 1] as const).map((team) => {
          const own = slots.filter((s) => s.team === team)
          if (own.length === 0) return null
          const left = Math.min(...own.map((s) => s.x))
          const right = Math.max(...own.map((s) => s.x + s.width))
          return (
            <TeamLabel
              key={team}
              text={content.teamNames[team]}
              centerX={(left + right) / 2}
              y={Math.min(...own.map((s) => s.y)) - 46}
              won={content.winner === team}
              style={template.nameStyle}
              // Sem vencedor os dois rótulos ficam na cor de destaque: apagar
              // os dois seria dizer que ninguém importa, e o que se anuncia é
              // justamente o confronto.
              color={
                content.winner === null || content.winner === team
                  ? template.portrait.borderColor
                  : '#9b9bb0'
              }
            />
          )
        })}

      {slots.map((slot, i) => (
        <PortraitSlot
          key={i}
          uid={`${uid}-s${i}`}
          slot={slot}
          template={template}
          competitor={competitors[i]}
          winner={content.winner}
          bySlug={bySlug}
          flags={flags}
          gradientId={`border-${uid}`}
          grayId={`gray-${uid}`}
          shadowId={template.portrait.shadow === 'none' ? null : `shadow-${uid}`}
        />
      ))}

      <Footer template={template} content={content} />
    </svg>
  )
}


/**
 * Líder do time, em pé na lateral e à frente do fundo. Só o boneco: o nome dele
 * não é escrito ali.
 *
 * Tudo o que muda de um líder para o outro — imagem, brilho, tamanho, posição —
 * vem de `placement`, definido na geração, porque depende de quem foi escalado.
 * O brilho atrás é uma elipse desfocada na cor escolhida, ou na cor primária do
 * próprio personagem, que é o que faz cada líder acender com a própria
 * identidade. O lado perdedor continua dessaturado, como o resto do time.
 */
function Leader({
  uid,
  side,
  box,
  competitor,
  placement,
  dim,
  bySlug,
  grayId,
}: {
  uid: string
  side: 0 | 1
  /** Faixa lateral, medida junto com o arranjo dos blocos. */
  box: Box
  competitor: Competitor | null
  /** Ajuste fino deste líder, definido na geração. */
  placement: LeaderPlacement
  /** Lado perdedor sai dessaturado, como o resto do time. */
  dim: boolean
  bySlug: Map<string, Character>
  grayId: string
}) {
  const character = competitor?.characterSlug ? bySlug.get(competitor.characterSlug) : undefined
  if (!character) return null
  // A imagem do líder é dele: dá para pôr o chibi de um lado e a arte do outro,
  // independente do que os retratos usam.
  const source = artSource(character, placement.useSD)
  if (!source) return null

  // A faixa inteira é do boneco: o nome do líder não é desenhado. Quem está ali
  // é o personagem, e o nome já aparece na lista do time.
  const usable = box.height

  // Todo líder sai com a mesma altura de corpo — ver leaderFigure. E o
  // alinhamento é pela figura, não pela borda do arquivo, que tem sobras muito
  // diferentes de personagem para personagem.
  const fit = leaderFigure(source, { x: 0, y: 0, width: box.width, height: usable }, placement.scale)
  const width = fit.width * placement.widthScale
  const height = fit.height * placement.heightScale
  const figure = {
    y: fit.figure.y * placement.heightScale,
    height: fit.figure.height * placement.heightScale,
  }

  /**
   * A faixa se alinha pelo **rosto**, não pelo meio da imagem: numa pose de
   * braço estendido ou chicote solto, o meio do arquivo cai longe do
   * personagem, e o líder ficava plantado fora do centro da própria faixa.
   */
  const anchorX = source.bodyAnchor?.x ?? source.anchor?.x ?? 0.5
  const alvo = 0.5 + placement.offsetX

  /**
   * O rosto cai exatamente no alvo, sem exceção.
   *
   * Antes eu puxava a arte para dentro da tela quando ela passava da borda, e
   * isso tirava o rosto do centro em 18 dos 28 — o da Yuzuriha ia parar colado
   * na esquerda. Com a altura igualada as artes ficaram largas (a da Wagner dá
   * 739 contra 354 da faixa), então essa correção era a regra e não a exceção.
   * Deixar a ponta da capa sangrar na borda custa menos que o líder plantado
   * fora do lugar.
   */
  const mirrored = side === 1
  const faceX = box.x + alvo * box.width
  const x = faceX - anchorX * width
  // Padrão: os pés na base da faixa. O deslocamento sobe ou desce a partir daí.
  const y = box.y - figure.y + (usable - figure.height) + placement.offsetY * usable

  // O da direita entra espelhado, para os dois líderes se olharem. O espelho é
  // no eixo do rosto e não no meio da imagem: no meio, o personagem escorregaria
  // para o lado ao inverter.
  const flip = mirrored ? `translate(${2 * faceX} 0) scale(-1 1)` : undefined

  const glow = placement.highlight
    ? placement.colorMode === 'character'
      ? (character.colors?.[0]?.hex ?? placement.color)
      : placement.color
    : null

  // A intensidade mexe na opacidade e no tamanho ao mesmo tempo: só opacidade
  // deixava o brilho forte virar um disco chapado, e só tamanho deixava o fraco
  // virar uma mancha larga e cinzenta.
  const power = Math.max(0, Math.min(100, placement.glow)) / 100
  const spreadFactor = 0.55 + power * 0.75

  return (
    <g>
      <defs>
        <filter id={`leaderglow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={60} />
        </filter>
      </defs>
      {glow && power > 0 && (
        // Centrado na figura e no rosto, não na imagem: com a arte muito maior
        // que o personagem, o brilho acendia um canto vazio.
        <ellipse
          cx={faceX}
          cy={y + figure.y + figure.height * 0.55}
          rx={box.width * 0.5 * spreadFactor}
          ry={figure.height * 0.42 * spreadFactor}
          fill={glow}
          opacity={0.2 + power * 0.7}
          filter={`url(#leaderglow-${uid})`}
        />
      )}
      <g filter={dim ? `url(#${grayId})` : undefined} transform={flip}>
        <image href={source.href} x={x} y={y} width={width} height={height} preserveAspectRatio="none" />
      </g>
    </g>
  )
}

/** Título do evento, ancorado no canto escolhido do topo. */
function EventHeader({
  uid,
  template,
  name,
  logo,
}: {
  uid: string
  template: WinnersTemplate
  name: string
  logo: string | null
}) {
  const { event } = template
  const margin = 90
  const centerY = HEADER.height / 2
  const logoW = 260
  const logoH = 130

  const anchor = event.align === 'center' ? 'middle' : event.align === 'right' ? 'end' : 'start'
  // O canto resolve o caso comum; o deslocamento é para desviar de uma logo ou
  // de um detalhe do fundo sem ter que trocar de canto.
  const shiftX = event.offsetX * CANVAS.width
  const shiftY = event.offsetY * HEADER.height
  const baseX =
    (event.align === 'center' ? CANVAS.width / 2 : event.align === 'right' ? CANVAS.width - margin : margin) +
    shiftX

  // A logo fica do lado de fora do texto, para não empurrá-lo do canto.
  const logoX =
    event.align === 'right'
      ? baseX - logoW - 300
      : event.align === 'center'
        ? CANVAS.width / 2 - logoW - 240
        : baseX
  const textX = logo && event.align === 'left' ? baseX + logoW + 24 : baseX

  return (
    <g>
      {logo && (
        <image
          href={logo}
          x={logoX}
          y={centerY - logoH / 2 + shiftY}
          width={logoW}
          height={logoH}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <text
        x={textX}
        y={centerY + shiftY}
        textAnchor={anchor}
        dominantBaseline="central"
        fontFamily={event.style.fontFamily}
        fontSize={event.size}
        fontWeight={800}
        fill={event.gradient ? `url(#event-${uid})` : event.style.color}
        {...strokeProps(event.style)}
      >
        {name || 'Nome do evento'}
      </text>
    </g>
  )
}

/**
 * Um competidor: arte de corpo inteiro recortada na moldura escolhida,
 * colocação, insígnia e nome. Slots de dupla dividem a caixa em dois retratos.
 */
function PortraitSlot({
  uid,
  slot,
  template,
  competitor,
  winner,
  bySlug,
  flags,
  gradientId,
  grayId,
  shadowId,
}: {
  uid: string
  slot: Slot
  template: WinnersTemplate
  competitor: Competitor | undefined
  /** Lado vencedor; o outro sai em tons de cinza. */
  winner: 0 | 1 | null
  bySlug: Map<string, Character>
  flags: FlagManifest | null
  gradientId: string
  grayId: string
  /** Filtro de sombra da moldura, ou nulo quando desligada. */
  shadowId: string | null
}) {
  const { portrait, nameStyle } = template

  /**
   * Escala igual para todo o elenco (`rosterWidth`) e o ponto abaixo dos olhos
   * em 50% x 25% da moldura. Sem recuo: encaixar quem sobra empurrava o rosto
   * para fora da linha, que é justamente o que o alinhamento existe para
   * garantir — quem tem pose mais esticada perde um pedaço do pé, e tudo bem.
   * Por último o ajuste manual do template.
   */
  const placeArt = (source: ArtSource, box: Box): Box => {
    const placed = rosterPlacement(source, box, portrait.imageZoom, portrait.useAnchor)
    return {
      ...placed,
      x: placed.x + portrait.imageOffsetX * box.width,
      y: placed.y + portrait.imageOffsetY * box.height,
    }
  }
  const stroke = portrait.borderGradient ? `url(#${gradientId})` : portrait.borderColor
  // Dessatura o lado que perdeu. Sem vencedor definido, ninguém desbota: é
  // assim que a mesma peça anuncia um jogo que ainda não aconteceu.
  const dim = slot.team !== undefined && winner !== null && slot.team !== winner

  const boxes: { box: Box; slug: string | null | undefined; key: string }[] = slot.pair
    ? [
        {
          box: { x: slot.x, y: slot.y, width: slot.width / 2 - 8, height: slot.height },
          slug: competitor?.characterSlug,
          key: 'a',
        },
        {
          box: {
            x: slot.x + slot.width / 2 + 8,
            y: slot.y,
            width: slot.width / 2 - 8,
            height: slot.height,
          },
          slug: competitor?.partnerCharacterSlug,
          key: 'b',
        },
      ]
    : [
        {
          box: { x: slot.x, y: slot.y, width: slot.width, height: slot.height },
          slug: competitor?.characterSlug,
          key: 'a',
        },
      ]

  // O texto se mede pelo passo do arranjo, não pela moldura ampliada.
  const textWidth = slot.pitch ?? slot.width
  const baseSize = Math.min(52, Math.max(20, textWidth * (slot.pair ? 0.1 : 0.13)))
  const label = competitor
    ? slot.pair && competitor.partnerName
      ? `${competitor.name} & ${competitor.partnerName}`
      : competitor.name
    : '—'
  const badge = flags && competitor ? insignia(template.flag, competitor, flags) : null
  const badgeH = Math.max(20, slot.height * 0.11)
  // A insígnia entra na mesma linha do nome, então come parte do espaço dele —
  // sem descontar, o conjunto passava do slot e encostava no vizinho.
  const badgeSpace = badge ? badgeH * FLAG_ASPECT * 1.5 : 0
  const nameSize = fitFontSize(label, textWidth - badgeSpace, baseSize)
  // Só onde há espaço: num gráfico de 20 jogadores o bloco é estreito demais e
  // o arroba viraria um borrão sob o nome.
  const handle = textWidth >= HANDLE_MIN_PITCH ? competitor?.twitter : null

  return (
    <g opacity={competitor ? 1 : 0.25}>
      {boxes.map(({ box, slug, key }) => {
        const character = slug ? bySlug.get(slug) : undefined
        const source = character ? artSource(character, portrait.useSD) : null
        const art = source ? placeArt(source, box) : null
        const path = portraitPath(portrait.shape, box, portrait.radius, portrait.cut, portrait.cutAngle)
        const clipId = `${uid}-${key}`

        return (
          <g key={key}>
            <defs>
              <clipPath id={clipId}>
                <path d={path} />
              </clipPath>
            </defs>
            {/* Véu por baixo da arte: sobre foto de fundo, o personagem some.
                É ele que projeta a sombra — a moldura é só um contorno, e um
                contorno não tem miolo para sombrear. */}
            <path
              d={path}
              fill="#0d0d15"
              fillOpacity={0.72}
              filter={shadowId ? `url(#${shadowId})` : undefined}
            />
            {art && source && (
              <g clipPath={`url(#${clipId})`} filter={dim ? `url(#${grayId})` : undefined}>
                <image
                  href={source.href}
                  x={art.x}
                  y={art.y}
                  width={art.width}
                  height={art.height}
                  preserveAspectRatio="none"
                />
              </g>
            )}
            <path d={path} fill="none" stroke={stroke} strokeWidth={portrait.borderWidth} />
          </g>
        )
      })}

      {slot.rank && (
        <text
          x={slot.x + slot.width / 2}
          y={slot.y - 22}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={nameStyle.fontFamily}
          fontSize={nameSize * 1.15}
          fontWeight={800}
          fill={portrait.borderColor}
          {...strokeProps(nameStyle)}
        >
          {slot.rank}
        </text>
      )}

      {handle && (
        <XHandle
          handle={handle}
          centerX={slot.x + slot.width / 2}
          y={slot.nameY + HANDLE_LINE}
          size={nameSize * 0.6}
          style={template.handleStyle}
          shadowId={`handleshadow-${uid}`}
        />
      )}

      <NameWithBadge
        uid={`${uid}-name`}
        label={label}
        badge={badge}
        badgeHeight={badgeH}
        centerX={slot.x + slot.width / 2}
        y={slot.nameY + NAME_LINE}
        size={nameSize}
        style={nameStyle}
      />
    </g>
  )
}


/**
 * Nome do competidor com a insígnia à frente, o conjunto centrado no slot.
 *
 * O texto é medido depois de desenhado (`getComputedTextLength`) porque a
 * largura muda com a fonte escolhida — sem medir, a bandeira ora encostava no
 * nome, ora ficava boiando longe dele.
 */
function NameWithBadge({
  uid,
  label,
  badge,
  badgeHeight,
  centerX,
  y,
  size,
  style,
}: {
  uid: string
  label: string
  badge: ReturnType<typeof insignia>
  badgeHeight: number
  centerX: number
  y: number
  size: number
  style: TextStyle
}) {
  const text = useRef<SVGTextElement>(null)
  const [textWidth, setTextWidth] = useState(0)

  useLayoutEffect(() => {
    setTextWidth(text.current?.getComputedTextLength() ?? 0)
  }, [label, size, style.fontFamily])

  const badgeWidth = badge ? badgeHeight * FLAG_ASPECT : 0
  const gap = badge ? size * 0.42 : 0
  const total = badgeWidth + gap + textWidth
  const left = centerX - total / 2

  return (
    <g>
      {badge?.kind === 'flag' && textWidth > 0 && (
        <FlagSvg uid={uid} spec={badge.spec} x={left} y={y - badgeHeight / 2} height={badgeHeight} />
      )}
      {badge?.kind === 'logo' && textWidth > 0 && (
        <image
          href={badge.href}
          x={left}
          y={y - badgeHeight / 2}
          width={badgeWidth}
          height={badgeHeight}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <text
        ref={text}
        x={textWidth > 0 ? left + badgeWidth + gap : centerX}
        y={y}
        textAnchor={textWidth > 0 ? 'start' : 'middle'}
        dominantBaseline="central"
        fontFamily={style.fontFamily}
        fontSize={size}
        fontWeight={700}
        fill={style.color}
        {...strokeProps(style)}
      >
        {label}
      </text>
    </g>
  )
}


/** Distância do fim do bloco até a linha do nome e à do arroba. */
const NAME_LINE = 32
const HANDLE_LINE = 78

/** Abaixo de que largura de bloco o arroba não cabe mais. */
const HANDLE_MIN_PITCH = 260

/**
 * Sombra da moldura, por nível. Números baixos de propósito: o que se quer é
 * descolar o card do fundo, não desenhar uma mancha em volta dele.
 */
const SHADOWS = {
  none: { dx: 0, dy: 0, stdDeviation: 0, floodOpacity: 0 },
  soft: { dx: 0, dy: 4, stdDeviation: 6, floodOpacity: 0.35 },
  medium: { dx: 0, dy: 7, stdDeviation: 11, floodOpacity: 0.5 },
  strong: { dx: 0, dy: 10, stdDeviation: 18, floodOpacity: 0.65 },
} as const

/**
 * Rótulo do time, com coroa no vencedor.
 *
 * A coroa é o que diz quem ganhou de perto; a dessaturação do outro lado diz de
 * longe. Dois sinais para a mesma informação, porque quem vê a peça na timeline
 * não vai comparar saturação.
 */
function TeamLabel({
  text,
  centerX,
  y,
  won,
  style,
  color,
}: {
  text: string
  centerX: number
  y: number
  won: boolean
  style: TextStyle
  color: string
}) {
  const label = useRef<SVGTextElement>(null)
  const [width, setWidth] = useState(0)
  const size = 52

  useLayoutEffect(() => {
    setWidth(label.current?.getComputedTextLength() ?? 0)
  }, [text, style.fontFamily])

  // A coroa entra antes do nome e o conjunto continua centrado no bloco: por
  // isso o texto se desloca meia coroa para a direita.
  const crown = won ? size * 0.95 : 0
  const gap = crown ? size * 0.3 : 0
  const textX = centerX + (crown + gap) / 2

  return (
    <g>
      {won && width > 0 && (
        <CrownIcon x={textX - width / 2 - gap - crown} y={y - crown / 2} size={crown} color={color} />
      )}
      <text
        ref={label}
        x={textX}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={style.fontFamily}
        fontSize={size}
        fontWeight={800}
        fill={color}
        {...strokeProps(style)}
      >
        {text}
      </text>
    </g>
  )
}

/** Coroa do time vencedor. */
function CrownIcon({
  x,
  y,
  size,
  color,
}: {
  x: number
  y: number
  size: number
  color: string
}) {
  const scale = size / 24
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={color}>
      <path d="M3 8.5 6.6 12 12 4.5 17.4 12 21 8.5 19.4 19H4.6L3 8.5zm2.3 12.2h13.4a1 1 0 0 1 0 2H5.3a1 1 0 0 1 0-2z" />
    </g>
  )
}

/** Logo do X seguido do arroba, centrado sob o nome. */
function XHandle({
  handle,
  centerX,
  y,
  size,
  style,
  shadowId,
}: {
  handle: string
  centerX: number
  y: number
  size: number
  style: TextStyle
  /** Sombra em volta do texto e do ícone, para o arroba ler sobre a arte. */
  shadowId: string
}) {
  const { color, fontFamily } = style
  const text = useRef<SVGTextElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    setWidth(text.current?.getComputedTextLength() ?? 0)
  }, [handle, size, fontFamily])

  const gap = size * 0.42
  const left = centerX - (size + gap + width) / 2

  // A sombra vai no grupo inteiro para pegar o logo junto com o texto: o arroba
  // cai sobre a arte do personagem, e sem ela some no que estiver atrás.
  return (
    <g opacity={0.9} filter={`url(#${shadowId})`}>
      <defs>
        <filter id={shadowId} x="-30%" y="-60%" width="160%" height="220%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.85" />
        </filter>
      </defs>
      {width > 0 && <XLogo x={left} y={y - size / 2} size={size} color={color} />}
      <text
        ref={text}
        x={width > 0 ? left + size + gap : centerX}
        y={y}
        textAnchor={width > 0 ? 'start' : 'middle'}
        dominantBaseline="central"
        fontFamily={fontFamily}
        fontSize={size}
        fontWeight={600}
        fill={color}
        {...strokeProps(style)}
      >
        @{handle}
      </text>
    </g>
  )
}

/** Marca do X (antigo Twitter). */
function XLogo({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const scale = size / 24
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={color}>
      <path d="M18.9 1.8h3.7l-8.1 9.2L24 22.2h-7.4l-5.8-7.6-6.7 7.6H.4l8.6-9.9L0 1.8h7.6l5.2 6.9 6.1-6.9zm-1.3 18.2h2L6.5 3.9H4.3l13.3 16.1z" />
    </g>
  )
}

/** Qual insígnia desenhar no retrato, conforme a escolha do template. */
function insignia(kind: WinnersTemplate['flag'], competitor: Competitor, flags: FlagManifest) {
  if (kind === 'country') {
    const spec = countryFlag(flags, competitor.countryCode ?? null)
    return spec ? ({ kind: 'flag', spec } as const) : null
  }
  if (kind === 'region') {
    const spec = regionFlag(flags, competitor.regionCode ?? null)
    return spec ? ({ kind: 'flag', spec } as const) : null
  }
  if (kind === 'team' && competitor.teamLogo) {
    return { kind: 'logo', href: competitor.teamLogo } as const
  }
  return null
}

/** Canais à esquerda, narradores à direita. */
function Footer({ template, content }: { template: WinnersTemplate; content: GraphicContent }) {
  const { nameStyle } = template
  const { channels, casters } = content
  const y = FOOTER.top + FOOTER.height / 2
  const size = 34

  const items: { icon: 'twitch' | 'youtube'; text: string }[] = []
  if (channels.twitch.show && channels.twitch.handle) {
    items.push({ icon: 'twitch', text: channels.twitch.handle })
  }
  if (channels.youtube.show && channels.youtube.handle) {
    items.push({ icon: 'youtube', text: channels.youtube.handle })
  }

  // Os narradores viram uma linha só: um microfone e os nomes separados por
  // ponto. Espalhá-los deixava o ícone órfão do outro lado do rodapé.
  const casterLine = casters.filter((n) => n.trim()).join(' · ')

  let cursor = 90
  return (
    <g fontFamily={nameStyle.fontFamily} fill={nameStyle.color}>
      {items.map((item) => {
        const x = cursor
        cursor += size + 14 + item.text.length * size * 0.62 + 60
        return (
          <g key={item.icon}>
            <ChannelIcon kind={item.icon} x={x} y={y - size / 2} size={size} />
            <text x={x + size + 14} y={y} dominantBaseline="central" fontSize={size} fontWeight={600}>
              {item.text}
            </text>
          </g>
        )
      })}

      {casterLine && <Casters text={casterLine} y={y} size={size} color={nameStyle.color} />}
    </g>
  )
}


/**
 * Narradores alinhados à direita, com o microfone colado no começo do texto.
 *
 * A largura vem de `getComputedTextLength()` depois do primeiro desenho, não de
 * uma estimativa por número de caracteres: com fonte proporcional a estimativa
 * errava para mais, e o erro crescia a cada nome — o ícone ia se afastando.
 */
function Casters({
  text,
  y,
  size,
  color,
}: {
  text: string
  y: number
  size: number
  color: string
}) {
  const label = useRef<SVGTextElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    setWidth(label.current?.getComputedTextLength() ?? 0)
  }, [text, size])

  const right = CANVAS.width - 90
  return (
    <g>
      {width > 0 && <MicIcon x={right - width - size - 14} y={y - size / 2} size={size} color={color} />}
      <text
        ref={label}
        x={right}
        y={y}
        textAnchor="end"
        dominantBaseline="central"
        fontSize={size}
        fontWeight={600}
      >
        {text}
      </text>
    </g>
  )
}

function ChannelIcon({
  kind,
  x,
  y,
  size,
}: {
  kind: 'twitch' | 'youtube'
  x: number
  y: number
  size: number
}) {
  const scale = size / 24
  if (kind === 'twitch') {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} fill="#9146ff">
        <path d="M4 2 2 6v14h5v3l3-3h4l6-6V2H4zm15 11-3 3h-4l-3 3v-3H6V4h13v9zM15 7h2v5h-2V7zm-5 0h2v5h-2V7z" />
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="#ff0033">
      <path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 4.9 12 4.9 12 4.9s-7 0-8.9.5A3 3 0 0 0 1 7.5C.5 9.4.5 12 .5 12s0 2.6.5 4.5a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.5.5-4.5s0-2.6-.5-4.5zM9.8 15.5v-7l6 3.5-6 3.5z" />
    </g>
  )
}

/**
 * Microfone dos narradores. A cor vem por prop e não de `currentColor`: na
 * exportação o SVG é desenhado solto, sem CSS herdado, e o ícone saía preto.
 */
function MicIcon({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const scale = size / 24
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill={color}>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
      <path d="M17 11a1 1 0 1 1 2 0 7 7 0 0 1-6 6.9V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.1A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0z" />
    </g>
  )
}

/**
 * Encolhe a fonte até o texto caber na largura do slot.
 *
 * Medir texto em SVG exigiria renderizar antes; a estimativa por número de
 * caracteres erra pouco em fonte de título e evita o vaivém. Sem isso, um nome
 * comprido invade o retrato vizinho.
 */
function fitFontSize(text: string, maxWidth: number, base: number) {
  // 0.62 é o avanço de uma monoespaçada (Courier, a fonte padrão) com folga;
  // proporcionais gastam menos, então sobra margem em vez de faltar.
  const avgCharWidth = 0.62
  const estimated = text.length * base * avgCharWidth
  if (estimated <= maxWidth) return base
  return Math.max(base * 0.4, maxWidth / (text.length * avgCharWidth))
}

/** Contorno do texto — desenhado por baixo, para não comer o traço da letra. */
function strokeProps(style: TextStyle) {
  if (!style.strokeWidth) return {}
  return {
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeLinejoin: 'round' as const,
    paintOrder: 'stroke' as const,
  }
}
