import { useId } from 'react'
import { barGeometry, borderDash, gradientVector, WIDTH } from './shape'
import { countryFlag, regionFlag } from '../flags'
import { FLAG_ASPECT } from '../Flag'
import { anchorPlacement, artSource, faceWidth, sdBarWidth } from '../portrait'
import type { TopbarData, TopbarTemplate } from './types'
import type { Character, FlagManifest, FlagSpec } from '../types'

/**
 * Desenha uma barra de player em SVG.
 *
 * SVG e não HTML porque a barra tem silhueta livre (miolo saliente, pontas
 * afuniladas), degradê, contorno tracejado e brilho — e porque o destino final
 * destas peças é virar imagem: um SVG já é o próprio material de exportação, em
 * qualquer resolução.
 *
 * `mirrored` espelha o layout para o player da direita. As posições são
 * refletidas uma a uma em vez de aplicar `scale(-1,1)` no grupo, senão o texto
 * sairia invertido.
 */
export function TopbarPreview({
  template,
  data,
  characters,
  flags,
  width = 900,
  mirrored = false,
}: {
  template: TopbarTemplate
  data: TopbarData
  characters: Character[]
  flags: FlagManifest
  width?: number
  mirrored?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  // Com o layout espelhado, o placar troca de ponta — e o corte lateral o segue.
  const geo = barGeometry(template, mirrored ? 'left' : 'right')
  const character = characters.find((c) => c.slug === data.characterSlug) ?? null

  const border = template.border.style !== 'none' ? template.border : null
  const { dash, cap } = borderDash(template.border.style, template.border.width)

  // Margem em volta para o brilho e o contorno não serem cortados pelo viewBox.
  const pad = (template.highlight.enabled ? template.highlight.blur * 2 + 12 : 8) + (border?.width ?? 0)
  const viewW = WIDTH + pad * 2
  const viewH = geo.height + pad * 2
  const scale = width / viewW

  const fillRef = template.fill.type === 'gradient' ? `url(#grad-${uid})` : template.fill.color
  // Espelhar o degradê é refletir o vetor no eixo horizontal: as duas barras
  // passam a se olhar em vez de correrem as duas para o mesmo lado.
  const flipGradient = mirrored && template.fill.gradient.mirror
  const vector = gradientVector(template.fill.gradient.angle)
  const { y1, y2 } = vector
  const x1 = flipGradient ? 1 - vector.x1 : vector.x1
  const x2 = flipGradient ? 1 - vector.x2 : vector.x2
  const stops = template.fill.gradient.stops.length ? template.fill.gradient.stops : [template.fill.color]

  const glowColor = template.highlight.useCharacterColor
    ? (character?.colors?.[0]?.hex ?? template.highlight.color)
    : template.highlight.color

  const layout = contentLayout(template, geo, data, flags, mirrored)
  const anchor = mirrored ? 'end' : 'start'

  return (
    <svg
      className="topbar-svg"
      width={width}
      height={viewH * scale}
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label={`Topbar de ${data.name || 'player'}`}
    >
      <defs>
        {template.fill.type === 'gradient' && (
          <linearGradient id={`grad-${uid}`} x1={x1} y1={y1} x2={x2} y2={y2}>
            {stops.map((color, i) => (
              <stop key={i} offset={stops.length === 1 ? 0 : i / (stops.length - 1)} stopColor={color} />
            ))}
          </linearGradient>
        )}
        <filter id={`glow-${uid}`} x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation={template.highlight.blur} />
        </filter>
        {/* Recorta o conteúdo à silhueta: nada escapa da barra. */}
        <clipPath id={`clip-${uid}`}>
          <path d={geo.d} />
        </clipPath>
      </defs>

      <g transform={`translate(${pad} ${pad})`}>
        {template.highlight.enabled && (
          <path
            d={geo.d}
            fill={glowColor}
            opacity={template.highlight.intensity / 100}
            filter={`url(#glow-${uid})`}
          />
        )}

        <path d={geo.d} fill={fillRef} />

        <g clipPath={`url(#clip-${uid})`}>
          {layout.art && character && (
            <CharacterArt
              uid={uid}
              character={character}
              box={layout.art}
              mirrored={mirrored}
              useSD={template.show.useSD}
              useAnchor={template.show.useAnchor}
            />
          )}

          {layout.flags.map((flag, i) => (
            <FlagSvg key={i} uid={`${uid}-f${i}`} spec={flag.spec} x={flag.x} y={flag.y} height={flag.height} />
          ))}

          {layout.teamLogo && (
            <image
              href={layout.teamLogo.href}
              x={layout.teamLogo.x}
              y={layout.teamLogo.y}
              width={layout.teamLogo.width}
              height={layout.teamLogo.height}
              preserveAspectRatio="xMidYMid meet"
            />
          )}

          {layout.teamTag && (
            <text
              x={layout.teamTag.x}
              y={layout.teamTag.y}
              fontFamily={template.typography.fontFamily}
              fontSize={layout.teamTag.size}
              fontWeight={800}
              fill={template.typography.teamColor}
              dominantBaseline="central"
              textAnchor={anchor}
            >
              {layout.teamTag.text}
            </text>
          )}

          <text
            x={layout.name.x}
            y={layout.name.y}
            fontFamily={template.typography.fontFamily}
            fontSize={layout.name.size}
            fontWeight={700}
            fill={template.typography.nameColor}
            dominantBaseline="central"
            textAnchor={anchor}
          >
            {data.name || 'NOME DO PLAYER'}
          </text>

          <text
            x={layout.score.x}
            y={layout.score.y}
            fontFamily={template.typography.fontFamily}
            fontSize={layout.score.size}
            fontWeight={800}
            fill={template.typography.scoreColor}
            dominantBaseline="central"
            textAnchor={mirrored ? 'start' : 'end'}
          >
            {data.score}
          </text>
        </g>

        {border && (
          <path
            d={geo.d}
            fill="none"
            stroke={border.color}
            strokeWidth={border.width}
            strokeDasharray={dash}
            strokeLinecap={cap}
            strokeLinejoin="round"
          />
        )}
      </g>
    </svg>
  )
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Posiciona tudo dentro da barra: arte, bandeiras, sigla e nome correndo a
 * partir da borda externa, com o placar ancorado na ponta oposta.
 */
function contentLayout(
  template: TopbarTemplate,
  geo: ReturnType<typeof barGeometry>,
  data: TopbarData,
  flags: FlagManifest,
  mirrored: boolean
) {
  const { show } = template
  const h = template.barHeight
  // Entra o quanto a ponta come da barra, para nada encostar na diagonal.
  const inset = Math.max(template.edges.style === 'taper' ? template.edges.taper : 0, h * 0.22)
  const mid = geo.barTop + h / 2
  /** Reflete uma coordenada quando a barra é a do player da direita. */
  const fx = (x: number) => (mirrored ? WIDTH - x : x)

  // O chibi é estreito e alto: numa caixa larga ele ficaria perdido no meio,
  // longe da ponta. A arte oficial, essa sim, precisa de largura para o recorte
  // de rosto respirar.
  const artWidth = h * (show.useSD ? 1.05 : 1.9)
  // Um respiro da ponta, senão o canto arredondado come a lateral do chibi.
  const artInset = show.useSD ? h * 0.12 : 0
  const art = show.characterArt
    ? { x: artInset, y: geo.barTop, width: artWidth, height: h }
    : null

  // Depois da arte o conteúdo começa fora do rastro do fade: colado nele, as
  // bandeiras ficavam em cima do ombro do personagem.
  let cursor = art ? art.x + art.width + h * 0.14 : inset

  const flagHeight = h * 0.34
  const flagWidth = flagHeight * FLAG_ASPECT
  const specs: FlagSpec[] = []
  if (show.countryFlag) {
    const spec = countryFlag(flags, data.countryCode)
    if (spec) specs.push(spec)
  }
  if (show.regionFlag) {
    const spec = regionFlag(flags, data.regionCode)
    if (spec) specs.push(spec)
  }

  const placedFlags = specs.map((spec) => {
    const placed = {
      spec,
      x: mirrored ? fx(cursor) - flagWidth : cursor,
      y: mid - flagHeight / 2,
      height: flagHeight,
    }
    cursor += flagWidth + h * 0.09
    return placed
  })

  let teamLogo: (Box & { href: string }) | null = null
  if (show.teamFlag && data.teamLogo) {
    teamLogo = {
      href: data.teamLogo,
      x: mirrored ? fx(cursor) - flagWidth : cursor,
      y: mid - flagHeight / 2,
      width: flagWidth,
      height: flagHeight,
    }
    cursor += flagWidth + h * 0.09
  }

  if (placedFlags.length || teamLogo) cursor += h * 0.08

  let teamTag: { text: string; x: number; y: number; size: number } | null = null
  if (show.teamTag && data.teamTag) {
    const size = h * 0.36
    teamTag = { text: data.teamTag, x: fx(cursor), y: mid, size }
    // Largura de texto em SVG só se sabe medindo; esta aproximação por número de
    // caracteres erra pouco em fonte de título e evita medir a cada tecla.
    cursor += data.teamTag.length * size * 0.62 + h * 0.16
  }

  return {
    art: art ? { ...art, x: mirrored ? WIDTH - art.width : art.x } : null,
    flags: placedFlags,
    teamLogo,
    teamTag,
    name: { x: fx(cursor), y: mid, size: h * 0.42 },
    score: { x: fx(WIDTH - inset), y: mid, size: h * 0.62 },
  }
}

/** Zoom out sobre o enquadramento do rosto: numa barra cabe cabeça e ombros. */
const ART_ZOOM = 1.7

/**
 * O chibi entra maior que a barra de propósito: a régua dele mede o corpo
 * inteiro, e numa barra só cabe cabeça e tronco. 3,8 mantém o tamanho que os
 * chibis já tinham ali, agora igual para todos.
 */
const SD_ZOOM = 3.8

function CharacterArt({
  uid,
  character,
  box,
  mirrored,
  useSD,
  useAnchor,
}: {
  uid: string
  character: Character
  box: Box
  mirrored: boolean
  useSD: boolean
  useAnchor: boolean
}) {
  const source = artSource(character, useSD)
  if (!source) return null
  // A escala vem do tamanho do rosto na arte oficial e da régua do chibi no
  // sprite SD; a posição, do ponto abaixo dos olhos — é o que deixa todo o
  // elenco alinhado na mesma altura da barra, e no mesmo tamanho.
  const width = useSD ? sdBarWidth(source, box, SD_ZOOM) : faceWidth(source, box, ART_ZOOM)
  const art = anchorPlacement(source, box, width, useAnchor)

  return (
    <>
      <defs>
        {/* O fade aponta para dentro da barra, na direção do nome. */}
        <linearGradient id={`fade-${uid}`} x1={mirrored ? 1 : 0} y1="0" x2={mirrored ? 0 : 1} y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`artmask-${uid}`}>
          <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={`url(#fade-${uid})`} />
        </mask>
        <clipPath id={`artclip-${uid}`}>
          <rect x={box.x} y={box.y} width={box.width} height={box.height} />
        </clipPath>
      </defs>
      <g mask={`url(#artmask-${uid})`} clipPath={`url(#artclip-${uid})`}>
        <image
          href={source.href}
          x={art.x}
          y={art.y}
          width={art.width}
          height={art.height}
          preserveAspectRatio="none"
        />
      </g>
    </>
  )
}

/** Uma bandeira recortada do sprite, do mesmo jeito que o componente CSS faz. */
function FlagSvg({
  uid,
  spec,
  x,
  y,
  height,
}: {
  uid: string
  spec: FlagSpec
  x: number
  y: number
  height: number
}) {
  const width = height * FLAG_ASPECT
  const col = spec.index % spec.columns
  const row = Math.floor(spec.index / spec.columns)

  return (
    <>
      <defs>
        <clipPath id={`flag-${uid}`}>
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#flag-${uid})`}>
        <image
          href={spec.sheet}
          x={x - col * width}
          y={y - row * height}
          width={spec.columns * width}
          height={spec.rows * height}
          preserveAspectRatio="none"
        />
      </g>
    </>
  )
}
