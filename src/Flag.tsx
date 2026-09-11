import type { FlagSpec } from './types'

/** Proporção das células do sprite. Toda bandeira é desenhada nesta caixa. */
export const FLAG_ASPECT = 4 / 3

/**
 * Altura das insígnias — bandeiras e logos de time — em qualquer tela que as
 * exiba. Uma constante só porque elas aparecem lado a lado: se divergirem, a
 * linha desalinha.
 */
export const BADGE_HEIGHT = 18

/**
 * Insígnia ampliada, para a listagem de times — lá a logo é o assunto do
 * cartão, não um acessório ao lado do nome. Mesma proporção, só maior.
 */
export const BADGE_HEIGHT_LG = 32

/**
 * Desenha uma bandeira recortando-a do sprite do seu país.
 *
 * As células são 4:3 e a bandeira vem encaixada dentro por "contain", então
 * basta escalar: a largura do elemento é sempre `height * 4/3` e o
 * `background-size` acompanha, deixando o `background-position` cair na célula
 * certa em qualquer tamanho.
 */
export function Flag({ spec, height = BADGE_HEIGHT }: { spec: FlagSpec; height?: number }) {
  const width = height * FLAG_ASPECT
  const col = spec.index % spec.columns
  const row = Math.floor(spec.index / spec.columns)

  return (
    <span
      className="flag"
      role="img"
      aria-label={spec.label}
      title={spec.label}
      style={{
        width,
        height,
        backgroundImage: `url(${spec.sheet})`,
        backgroundSize: `${spec.columns * width}px auto`,
        backgroundPosition: `${-col * width}px ${-row * height}px`,
      }}
    />
  )
}
