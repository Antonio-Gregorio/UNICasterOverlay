import { FLAG_ASPECT } from './Flag'
import type { FlagSpec } from './types'

/**
 * Uma bandeira recortada do sprite, em SVG — mesma conta do componente CSS,
 * trocando `background-position` por `clipPath`.
 */
export function FlagSvg({
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
