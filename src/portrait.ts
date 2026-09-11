import type { Character } from './types'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Onde desenhar a arte do personagem para que o rosto preencha `box`.
 *
 * Escala a arte até a região do rosto cobrir a caixa e então desloca para
 * centralizá-la. `zoom` afasta a câmera do enquadramento marcado em
 * scripts/face-overrides.json: 1 é só o rosto, valores maiores pegam ombros e
 * tronco. Usado na topbar, onde só cabe a cabeça.
 */
export function facePlacement(character: Character, box: Box, zoom: number): Box | null {
  const { face, imageSize } = character
  if (!face || !imageSize || !character.assets.art) return null

  const aspect = imageSize.width / imageSize.height
  const faceW = face.width * zoom
  const faceH = face.height * zoom
  const width = Math.max(box.width / faceW, (box.height * aspect) / faceH)
  const height = width / aspect
  const cx = face.x + face.width / 2
  const cy = face.y + face.height / 2

  return {
    x: box.x + box.width / 2 - cx * width,
    y: box.y + box.height / 2 - cy * height,
    width,
    height,
  }
}

/**
 * Arte inteira encaixada na caixa, do jeito que um pôster mostra o personagem
 * de corpo todo. `zoom` aproxima a partir daí e os offsets deslocam, em fração
 * da caixa — é assim que se acerta um personagem que ficou torto no quadro.
 */
export function fullBodyPlacement(
  character: Character,
  box: Box,
  { zoom = 1, offsetX = 0, offsetY = 0 }: { zoom?: number; offsetX?: number; offsetY?: number }
): Box | null {
  const { imageSize } = character
  if (!imageSize || !character.assets.art) return null

  const aspect = imageSize.width / imageSize.height
  // "contain": o personagem inteiro cabe, sem cortar cabeça nem pés.
  const width = Math.min(box.width, box.height * aspect) * zoom
  const height = width / aspect

  return {
    x: box.x + (box.width - width) / 2 + offsetX * box.width,
    y: box.y + (box.height - height) / 2 + offsetY * box.height,
    width,
    height,
  }
}

export type PortraitShape = 'rect' | 'rounded' | 'circle' | 'hex'
export type PortraitCut = 'none' | 'top' | 'bottom' | 'both'

/**
 * Silhueta da moldura do retrato, como `d` de um <path>.
 *
 * `cut` corta a borda de cima e/ou de baixo na diagonal; `cutAngle` é a
 * inclinação em graus, convertida na altura que a diagonal come. O corte só
 * vale para as formas retas — arredondar ou circular já define a silhueta toda.
 */
export function portraitPath(
  shape: PortraitShape,
  box: Box,
  radius: number,
  cut: PortraitCut = 'none',
  cutAngle = 0
): string {
  const { x, y, width: w, height: h } = box

  if (shape === 'circle') {
    // Elipse inscrita, escrita como arcos para caber num único <path>.
    const rx = w / 2
    const ry = h / 2
    return `M ${x} ${y + ry} A ${rx} ${ry} 0 1 1 ${x + w} ${y + ry} A ${rx} ${ry} 0 1 1 ${x} ${y + ry} Z`
  }

  if (shape === 'hex') {
    const chamfer = h * 0.22
    return [
      `M ${x + w / 2} ${y}`,
      `L ${x + w} ${y + chamfer}`,
      `L ${x + w} ${y + h - chamfer}`,
      `L ${x + w / 2} ${y + h}`,
      `L ${x} ${y + h - chamfer}`,
      `L ${x} ${y + chamfer}`,
      'Z',
    ].join(' ')
  }

  // A diagonal sobe `w * tan(ângulo)`; limitada a 45% da altura para a moldura
  // não virar um triângulo.
  const drop = Math.min(w * Math.tan((cutAngle * Math.PI) / 180), h * 0.45)
  const top = cut === 'top' || cut === 'both' ? drop : 0
  const bottom = cut === 'bottom' || cut === 'both' ? drop : 0

  if (shape === 'rounded' && top === 0 && bottom === 0) {
    const r = Math.min(radius, w / 2, h / 2)
    if (r > 0) {
      return [
        `M ${x + r} ${y}`,
        `H ${x + w - r}`,
        `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
        `V ${y + h - r}`,
        `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
        `H ${x + r}`,
        `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
        `V ${y + r}`,
        `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
        'Z',
      ].join(' ')
    }
  }

  // Reta, com ou sem corte: quatro cantos, os de cima e de baixo deslocados.
  return [
    `M ${x} ${y + top}`,
    `L ${x + w} ${y}`,
    `L ${x + w} ${y + h - bottom}`,
    `L ${x} ${y + h}`,
    'Z',
  ].join(' ')
}

export interface ArtSource {
  href: string
  /** largura / altura da imagem. */
  aspect: number
  /** Só a arte oficial tem enquadramento de rosto marcado. */
  face: Character['face']
  /** Ponto abaixo dos olhos, normalizado nesta imagem. */
  anchor: { x: number; y: number } | null
  /** Centro de corpo inteiro, quando difere do ponto do rosto. */
  bodyAnchor: { x: number; y: number } | null
  /**
   * Altura do sprite em pixels. Só o SD tem, e é a régua dele: os chibis já vêm
   * todos na mesma escala do arquivo (ver scripts/detect-scale.mjs), então o
   * tamanho de arquivo já diz o tamanho do personagem.
   */
  pixelHeight: number | null
  /** Correção manual de escala, de scripts/scale-overrides.json. */
  scale: number
  /** Corpo medido a partir do ponto dos olhos, em fração da altura da imagem. */
  body: { above: number; below: number } | null
}

/**
 * Qual imagem usar para o personagem: o sprite SD (chibi) ou a arte oficial.
 *
 * O SD não tem enquadramento de rosto — nem precisa, já é o personagem inteiro
 * num quadro apertado. Quem pede SD para alguém que ainda não tem sprite recebe
 * a arte normal, em vez de um buraco.
 */
export function artSource(character: Character, useSD: boolean): ArtSource | null {
  if (useSD && character.assets.sd && character.sdSize) {
    return {
      href: character.assets.sd,
      aspect: character.sdSize.width / character.sdSize.height,
      face: null,
      anchor: character.sdAnchor ?? null,
      bodyAnchor: null,
      pixelHeight: character.sdSize.height,
      scale: 1,
      body: character.sdBody ?? null,
    }
  }
  if (!character.assets.art || !character.imageSize) return null
  return {
    href: character.assets.art,
    aspect: character.imageSize.width / character.imageSize.height,
    face: character.face,
    anchor: character.anchor ?? null,
    bodyAnchor: character.bodyAnchor ?? null,
    pixelHeight: null,
    scale: character.artScale ?? 1,
    body: character.artBody ?? null,
  }
}

/** Encaixa uma imagem de proporção `aspect` na caixa, com zoom e deslocamento. */
export function containPlacement(
  aspect: number,
  box: Box,
  { zoom = 1, offsetX = 0, offsetY = 0 }: { zoom?: number; offsetX?: number; offsetY?: number } = {}
): Box {
  const width = Math.min(box.width, box.height * aspect) * zoom
  const height = width / aspect
  return {
    x: box.x + (box.width - width) / 2 + offsetX * box.width,
    y: box.y + (box.height - height) / 2 + offsetY * box.height,
    width,
    height,
  }
}

/** Cobre a caixa com a região do rosto, do jeito que a topbar precisa. */
export function faceCover(source: ArtSource, box: Box, zoom: number): Box {
  const { face, aspect } = source
  if (!face) return containPlacement(aspect, box)
  const faceW = face.width * zoom
  const faceH = face.height * zoom
  const width = Math.max(box.width / faceW, (box.height * aspect) / faceH)
  const height = width / aspect
  return {
    x: box.x + box.width / 2 - (face.x + face.width / 2) * width,
    y: box.y + box.height / 2 - (face.y + face.height / 2) * height,
    width,
    height,
  }
}

/** Onde o ponto de centralização cai dentro do bloco. */
export const ANCHOR_AT = { x: 0.5, y: 0.25 }

/**
 * Posiciona a imagem de modo que o ponto abaixo dos olhos caia em
 * `ANCHOR_AT` do bloco. A escala vem de fora — quem chama decide se o
 * personagem entra inteiro ou se é o rosto que preenche.
 *
 * É isto que alinha o elenco: cada arte tem o personagem numa pose e num canto
 * diferentes, e sem um ponto comum uns ficavam altos, outros baixos.
 */
export function anchorPlacement(source: ArtSource, box: Box, renderedWidth: number, use = true): Box {
  const width = renderedWidth
  const height = width / source.aspect
  // Desligado, o alvo é o centro da imagem: cada arte fica como veio.
  // Sem ponto marcado, mira um pouco acima do meio — melhor que o centro puro.
  const anchor = !use ? { x: 0.5, y: 0.5 } : (source.anchor ?? { x: 0.5, y: 0.35 })
  const at = use ? ANCHOR_AT : { x: 0.5, y: 0.5 }
  return {
    x: box.x + at.x * box.width - anchor.x * width,
    y: box.y + at.y * box.height - anchor.y * height,
    width,
    height,
  }
}

/** Largura renderizada para o personagem inteiro caber na caixa. */
export function containWidth(aspect: number, box: Box, zoom = 1): number {
  return Math.min(box.width, box.height * aspect) * zoom
}

/**
 * Moldura de referência da arte oficial, medida em "cabeças" — largura em
 * caixas de rosto, altura em caixas de rosto. A caixa de rosto é quadrada em
 * pixels nos 28, então serve de unidade.
 *
 * 8,6 de altura é o meio-termo escolhido olhando a folha de contato: cobre até
 * o percentil 75 de "olhos até os pés" do elenco. Mais alto encolhe todo mundo
 * para caber os dois ou três de pose mais esticada; mais baixo corta a canela do
 * Carmine e do Akatsuki.
 */
const ART_REF = { width: 5.3, height: 8.6 }

/**
 * Altura de sprite, em pixels, equivalente à altura da moldura.
 *
 * Os chibis já vêm todos na mesma escala do arquivo — scripts/detect-scale.mjs
 * redimensiona cada um até "olhos até os pés" dar o mesmo número de pixels —,
 * então o desenho é uma regra de três com o tamanho do arquivo e não precisa de
 * número por personagem. Tem que bater com SD_UNIT lá.
 */
const SD_UNIT = 406

/**
 * Largura renderizada para o personagem sair no **mesmo tamanho** que os
 * outros, e não do tamanho que a moldura da imagem der.
 *
 * Cada imagem tem a sua régua, porque o que é constante em cada uma é diferente:
 * na arte oficial é a caixa de rosto (as poses variam demais para medir corpo);
 * no chibi é dos olhos até os pés (não dá para medir rosto, mas a pose é sempre
 * em pé e de frente). Encaixando a imagem inteira, o tamanho aparente virava
 * sorteio — a cabeça variava 2,2x entre o maior e o menor do elenco.
 */
/**
 * Onde desenhar a arte num retrato de corpo inteiro: escala igual para todo o
 * elenco e o centro no ponto certo.
 *
 * O centro pode ser outro que o do rosto. A mira que enquadra bem uma cabeça na
 * topbar às vezes deixa a figura torta no quadro do gráfico — quem precisa tem
 * `body` em scripts/anchor-overrides.json, e só esta conta usa esse ponto.
 */
export function rosterPlacement(source: ArtSource, box: Box, zoom: number, useAnchor: boolean): Box {
  const centered = { ...source, anchor: source.bodyAnchor ?? source.anchor }
  return anchorPlacement(centered, box, rosterWidth(source, box, zoom), useAnchor)
}

export function rosterWidth(source: ArtSource, box: Box, zoom = 1): number {
  const { face, pixelHeight, aspect, scale } = source
  const z = zoom * scale
  if (face) {
    return (
      Math.min(box.width / (ART_REF.width * face.width), (box.height * aspect) / (ART_REF.height * face.height)) * z
    )
  }
  if (pixelHeight) return ((box.height * pixelHeight) / SD_UNIT) * aspect * z
  return containWidth(aspect, box, z)
}

/**
 * Quanto da faixa o líder ocupa de alto a baixo, com a altura em 100%.
 */
const LEADER_FILL = 0.95

/**
 * Régua do líder: **altura desenhada igual para todos**, e não cabeça igual.
 *
 * Nos retratos a régua é a cabeça, porque o elenco aparece lado a lado e cabeça
 * igual é o que lê como "mesma escala" — a diferença de altura que sobra ali é
 * pose, e é verdadeira. Na faixa do líder só há duas figuras grandes, uma de
 * cada lado, e o que salta aos olhos é a altura.
 *
 * A medida é a extensão desenhada inteira, do topo ao ponto mais baixo, e não
 * dos olhos aos pés: normalizando pelos pés, quem posa em pé (Akatsuki) ficava
 * pequeno ao lado de quem posa sentado (Hilda), porque o corpo dela continua
 * muito além do que a distância olhos-pés mede.
 *
 * Devolve também onde a figura cai dentro da arte, porque alinhar pela borda do
 * arquivo não serve: as artes têm sobras muito diferentes em volta — a do
 * Akatsuki tem 4958px de altura contra 1692 da Hilda.
 */
export function leaderFigure(source: ArtSource, box: Box, zoom = 1) {
  const anchor = source.bodyAnchor ?? source.anchor ?? { x: 0.5, y: 0.35 }
  const body = source.body ?? { above: 0.35, below: 0.65 }
  const span = body.above + body.below
  // Sem corpo medido não há régua: cai no encaixe da arte inteira.
  const height = span > 0 ? (box.height * LEADER_FILL * zoom) / span : box.height * zoom
  const width = height * source.aspect

  return {
    width,
    height,
    /** Caixa da figura, relativa ao canto da arte renderizada. */
    figure: {
      x: 0,
      y: (anchor.y - body.above) * height,
      width,
      height: span * height,
    },
  }
}

/**
 * Largura do chibi numa barra: a mesma regra de três, com um zoom porque ali só
 * cabe a cabeça e o tronco — o resto sai pela máscara.
 *
 * Antes a topbar usava "cobrir a caixa", que dimensiona pela proporção do
 * arquivo: chibi largo saía grande, chibi estreito saía pequeno, com **2,8x** de
 * diferença entre o maior e o menor do elenco.
 */
export function sdBarWidth(source: ArtSource, box: Box, zoom = 1): number {
  if (!source.pixelHeight) return Math.max(box.width, box.height * source.aspect)
  return ((box.height * source.pixelHeight) / SD_UNIT) * source.aspect * zoom
}

/** Largura renderizada para a região do rosto cobrir a caixa. */
export function faceWidth(source: ArtSource, box: Box, zoom: number): number {
  const { face, aspect } = source
  if (!face) return Math.max(box.width, box.height * aspect)
  return Math.max(box.width / (face.width * zoom), (box.height * aspect) / (face.height * zoom))
}
