import type { TopbarTemplate } from './types'

/**
 * Largura de uma barra em unidades internas. O preview e a exportação escalam
 * a partir daqui, então mudar o tamanho de saída não mexe em nenhum número
 * guardado no template.
 */
export const WIDTH = 1200

export interface BarGeometry {
  /** `d` do <path> da silhueta. */
  d: string
  /** Altura total, incluindo o que o miolo avança para fora. */
  height: number
  /** Faixa vertical do corpo da barra — onde o conteúdo pode entrar. */
  barTop: number
  barBottom: number
}

/**
 * Monta a silhueta da barra a partir do template.
 *
 * O caminho é percorrido no sentido horário a partir do canto superior
 * esquerdo. O miolo ("vazamento") entra na aresta de cima ou na de baixo
 * conforme a direção, e as bordas laterais são retas, arredondadas ou
 * diagonais — nunca as três ao mesmo tempo, por isso `edges.style` é exclusivo.
 *
 * O corte lateral vai só na ponta do placar (`scoreSide`): é a extremidade que
 * fecha a barra, e cortar as duas deixava a peça com cara de etiqueta solta.
 */
export function barGeometry(
  template: TopbarTemplate,
  scoreSide: 'left' | 'right' = 'right',
  width = WIDTH
): BarGeometry {
  const { shape, edges, barHeight } = template

  const notch = shape.style === 'center-notch' ? Math.max(0, shape.notchDepth) : 0
  const notchUp = shape.notchDirection === 'up'
  const height = barHeight + notch
  const barTop = notchUp ? notch : 0
  const barBottom = barTop + barHeight

  // Uma ponta afunilada não pode ser arredondada ao mesmo tempo, e vice-versa.
  const taper = edges.style === 'taper' ? clamp(edges.taper, 0, width / 2) : 0
  const radius = edges.style === 'rounded' ? clamp(edges.radius, 0, Math.min(barHeight / 2, width / 2)) : 0
  const taperUp = edges.taperDirection === 'up'

  // Afunilar "para cima" deixa o topo mais largo: quem recua é a base.
  const cutTop = taper && !taperUp ? taper : 0
  const cutBottom = taper && taperUp ? taper : 0
  const onLeft = scoreSide === 'left'

  const leftTop = onLeft ? cutTop : 0
  const leftBottom = onLeft ? cutBottom : 0
  const rightTop = width - (onLeft ? 0 : cutTop)
  const rightBottom = width - (onLeft ? 0 : cutBottom)

  const p: string[] = []
  const line = (x: number, y: number) => p.push(`L ${r(x)} ${r(y)}`)
  const arc = (x: number, y: number) => p.push(`A ${r(radius)} ${r(radius)} 0 0 1 ${r(x)} ${r(y)}`)

  // Aresta de cima, da esquerda para a direita.
  p.push(`M ${r(leftTop + radius)} ${r(barTop)}`)
  if (notch && notchUp) notchEdge(line, width, shape, barTop, 0)
  line(rightTop - radius, barTop)
  if (radius) arc(rightTop, barTop + radius)

  // Lateral direita.
  line(rightBottom, barBottom - radius)
  if (radius) arc(rightBottom - radius, barBottom)

  // Aresta de baixo, da direita para a esquerda.
  if (notch && !notchUp) notchEdge(line, width, shape, barBottom, height, true)
  line(leftBottom + radius, barBottom)
  if (radius) arc(leftBottom, barBottom - radius)

  // Lateral esquerda, fechando no ponto inicial.
  line(leftTop, barTop + radius)
  if (radius) arc(leftTop + radius, barTop)
  p.push('Z')

  return { d: p.join(' '), height, barTop, barBottom }
}

/**
 * Insere o miolo no meio de uma aresta. `base` é a linha da barra e `tip` a
 * linha para onde ele avança; `reverse` percorre da direita para a esquerda,
 * que é o sentido da aresta de baixo.
 */
function notchEdge(
  line: (x: number, y: number) => void,
  width: number,
  shape: TopbarTemplate['shape'],
  base: number,
  tip: number,
  reverse = false
) {
  const half = clamp(shape.notchWidth, 0, width) / 2
  const slant = Math.max(0, shape.notchSlant)
  const cx = width / 2
  const points: [number, number][] = [
    [cx - half - slant, base],
    [cx - half, tip],
    [cx + half, tip],
    [cx + half + slant, base],
  ]
  for (const [x, y] of reverse ? points.reverse() : points) line(x, y)
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const r = (n: number) => Math.round(n * 100) / 100

/** Converte o ângulo do degradê nos pontos que o SVG espera (unidades 0–1). */
export function gradientVector(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  const dx = Math.cos(rad) / 2
  const dy = Math.sin(rad) / 2
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy }
}

/** Traço do contorno. O ponto usa linecap redondo, senão vira quadradinho. */
export function borderDash(style: TopbarTemplate['border']['style'], width: number) {
  switch (style) {
    case 'dotted':
      return { dash: `0 ${width * 2.4}`, cap: 'round' as const }
    case 'dashed':
      return { dash: `${width * 4} ${width * 3}`, cap: 'butt' as const }
    case 'dash-dot':
      return { dash: `${width * 4} ${width * 2.5} 0 ${width * 2.5}`, cap: 'round' as const }
    default:
      return { dash: undefined, cap: 'butt' as const }
  }
}
