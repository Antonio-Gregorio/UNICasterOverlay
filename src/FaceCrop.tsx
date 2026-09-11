import type { Character } from './types'

/**
 * Mostra só o rosto do personagem, recortado da arte oficial.
 *
 * A arte inteira num quadrado de 56px deixa o personagem do tamanho de uma
 * formiga — no modo lista o que identifica é o rosto. As coordenadas vêm do
 * campo `face` do JSON (ver scripts/detect-faces.mjs).
 *
 * `fade` esmaece a borda direita, para o recorte se dissolver no cartão em vez
 * de terminar num corte reto.
 */
export function FaceCrop({
  character,
  width = 64,
  height = 56,
  fade = true,
}: {
  character: Character
  width?: number
  height?: number
  fade?: boolean
}) {
  const { face, imageSize, assets } = character

  // Sem enquadramento (ou sem arte): cai para a imagem inteira, sem quebrar.
  if (!assets.art) return <div className="face face--empty" style={{ width, height }} />
  if (!face || !imageSize) {
    return (
      <img
        className={`face${fade ? ' face--fade' : ''}`}
        style={{ width, height, objectFit: 'contain' }}
        src={assets.art}
        alt=""
        loading="lazy"
      />
    )
  }

  // Escala a arte até a região do rosto cobrir a caixa, e então desloca para
  // centralizá-la. Trabalhar com a largura renderizada (L) deixa a conta em uma
  // variável só, e a proporção da imagem cuida da altura.
  const aspect = imageSize.width / imageSize.height
  const renderedWidth = Math.max(width / face.width, (height * aspect) / face.height)
  const renderedHeight = renderedWidth / aspect
  const centerX = (face.x + face.width / 2) * renderedWidth
  const centerY = (face.y + face.height / 2) * renderedHeight

  return (
    <div
      className={`face${fade ? ' face--fade' : ''}`}
      style={{
        width,
        height,
        backgroundImage: `url(${assets.art})`,
        backgroundSize: `${renderedWidth}px ${renderedHeight}px`,
        backgroundPosition: `${width / 2 - centerX}px ${height / 2 - centerY}px`,
      }}
      role="img"
      aria-label={character.name}
    />
  )
}
