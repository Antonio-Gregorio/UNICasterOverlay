/** Template de gráfico de vencedores. Vive no localStorage — ver store.ts. */

export type GraphicLayout = 'top8' | 'top8-duo' | 'team-vs' | 'top3'
export type BackgroundType = 'preset' | 'solid' | 'gradient' | 'image'
export type PortraitShape = 'rect' | 'rounded' | 'circle' | 'hex'
export type PortraitCut = 'none' | 'top' | 'bottom' | 'both'
export type FlagKind = 'none' | 'country' | 'region' | 'team'
export type ShadowLevel = 'none' | 'soft' | 'medium' | 'strong'
export type EventAlign = 'left' | 'center' | 'right'

export interface TextStyle {
  fontFamily: string
  color: string
  strokeColor: string
  strokeWidth: number
}

export interface WinnersTemplate {
  id: string
  name: string

  /** Qual arranjo de slots o gráfico usa. */
  layout: GraphicLayout
  /** Quantos competidores entram — "top 8 ou menos". */
  slotCount: number
  /**
   * Líder de cada time, desenhado em pé nas laterais, à frente do fundo.
   * Só vale no layout de confronto.
   */
  leaders: {
    /**
     * Só isto fica no template: se o arranjo reserva ou não as faixas laterais.
     * Imagem, brilho, tamanho e posição são de cada líder, na geração — ver
     * LeaderPlacement.
     */
    show: boolean
  }

  /**
   * Como as caixas dos jogadores se distribuem. Vive no template porque é
   * decisão de visual, não do torneio.
   */
  grid: {
    /** Espaço extra entre colunas e entre fileiras, em unidades da tela. */
    gapX: number
    gapY: number
    /**
     * Largura do bloco de cada time, em fração da que o arranjo reservou. Acima
     * de 1 o bloco avança sobre a faixa dos líderes — que continuam desenhados
     * atrás, então a sobreposição é de propósito.
     */
    spread: number
  }

  background: {
    type: BackgroundType
    /** Id de um fundo de public/backgrounds/index.json. */
    presetId: string | null
    color: string
    gradient: { angle: number; stops: string[] }
    /** Data URL; só usada quando type === 'image'. */
    image: string | null
    /** Véu sobre o fundo, para o texto continuar legível sobre foto. */
    overlayColor: string
    overlayOpacity: number
  }

  /** Moldura de cada retrato de personagem. */
  portrait: {
    shape: PortraitShape
    radius: number
    /** Multiplicadores sobre o tamanho que o arranjo calculou. */
    widthScale: number
    heightScale: number
    /** Chanfro nas bordas de cima e de baixo. */
    cut: PortraitCut
    cutAngle: number
    /** Ajuste da arte dentro da moldura: zoom e deslocamento em fração da caixa. */
    imageZoom: number
    imageOffsetX: number
    imageOffsetY: number
    /** Troca a arte oficial pelo sprite chibi (SD). */
    useSD: boolean
    /**
     * Alinha todo mundo pelo ponto abaixo dos olhos. Desligado, cada arte fica
     * simplesmente centrada na moldura, cada uma na sua pose.
     */
    useAnchor: boolean
    borderColor: string
    borderWidth: number
    /** Segunda cor da moldura; usada como degradê quando ligada. */
    borderGradient: boolean
    borderColor2: string
    /**
     * Sombra sob a moldura. Presets de propósito: o valor livre convidava a
     * exageros que sujam o fundo, e o que serve aqui é um descolamento leve.
     */
    shadow: ShadowLevel
  }

  /** Nome do competidor sob o retrato. */
  nameStyle: TextStyle

  /**
   * Arroba do X, sob o nome. Estilo próprio porque é outra leitura: menor, e
   * numa fonte que não precisa combinar com a do nome.
   */
  handleStyle: TextStyle

  /** Estilo do cabeçalho. O texto e a logo vêm do conteúdo. */
  event: {
    show: boolean
    style: TextStyle
    /** Preenche o título com degradê em vez de cor chapada. */
    gradient: boolean
    gradientColor2: string
    /** Canto do topo onde o título fica. */
    align: EventAlign
    /**
     * Deslocamento a partir desse canto, em fração da tela. O canto resolve o
     * caso comum; o ajuste fino é para desviar de uma logo ou de um detalhe do
     * fundo, e para descer o título quando o cabeçalho fica vazio demais.
     */
    offsetX: number
    offsetY: number
    /** Tamanho do título. */
    size: number
  }

  /** Qual insígnia aparece no retrato de cada competidor. */
  flag: FlagKind

  createdAt: string
}

/** Um competidor no gráfico. Duplas preenchem os dois lugares. */
export interface Competitor {
  name: string
  characterSlug: string | null
  countryCode?: string | null
  regionCode?: string | null
  /** Data URL da logo do time, quando houver. */
  teamLogo?: string | null
  /** @ do X, sem o arroba. */
  twitter?: string | null
  /** Segundo jogador, nos layouts de dupla. */
  partnerName?: string
  partnerCharacterSlug?: string | null
}

/**
 * O que entra no gráfico numa geração específica: quem competiu, o evento e os
 * créditos.
 *
 * Separado do template de propósito — o visual é reaproveitado de torneio em
 * torneio, enquanto isto aqui muda toda vez.
 */
export interface GraphicContent {
  eventName: string
  /** Id de uma logo cadastrada na aba Logos. */
  logoId: string | null
  channels: {
    twitch: { show: boolean; handle: string }
    youtube: { show: boolean; handle: string }
  }
  /** Narradores, exibidos com um microfone ao lado. */
  casters: string[]
  /** Rótulo de cada lado no layout de confronto. */
  teamNames: [string, string]
  /**
   * Qual lado venceu. O outro sai dessaturado e o vencedor ganha a coroa — é a
   * única coisa que diz quem levou, já que os dois blocos são iguais.
   *
   * Nulo para peça de jogo que ainda não aconteceu: sem coroa e com os dois
   * lados coloridos, o mesmo gráfico anuncia o confronto.
   */
  winner: 0 | 1 | null
  /** Um por slot, na ordem da colocação. */
  competitors: Competitor[]
  /**
   * Líder de cada time no layout de confronto. É um jogador à parte, não o
   * primeiro da lista — o capitão nem sempre está entre os que jogaram.
   */
  leaders: [Competitor | null, Competitor | null]
  /**
   * Enquadramento de **cada** líder, um por lado. Fica no conteúdo e não no
   * template porque depende de quem foi escalado: cada personagem tem uma pose,
   * e o que serve para quem posa de braços abertos não serve para quem posa
   * agachado. Os dois lados são independentes.
   */
  leaderLayout: [LeaderPlacement, LeaderPlacement]
}

/** Ajuste fino de um líder na faixa lateral. */
export interface LeaderPlacement {
  /** Escala geral sobre a régua, que já iguala a altura de todo o elenco. */
  scale: number
  /** Ajustes por eixo, para achatar ou esticar um caso pontual. */
  widthScale: number
  heightScale: number
  /** Deslocamento a partir do lugar padrão, em fração da faixa. */
  offsetX: number
  offsetY: number
  /** Chibi no lugar da arte oficial, só para este líder. */
  useSD: boolean
  /** Brilho atrás do líder. */
  highlight: boolean
  /** 'character' usa a cor primária do próprio personagem. */
  colorMode: 'fixed' | 'character'
  color: string
  /**
   * Força do brilho, 0–100. Mexe na opacidade e no tamanho da elipse ao mesmo
   * tempo: um brilho fraco e enorme vira uma mancha, e um forte e pequeno vira
   * um disco.
   */
  glow: number
}

export function defaultLeaderPlacement(): LeaderPlacement {
  return {
    scale: 1,
    widthScale: 1,
    heightScale: 1,
    offsetX: 0,
    offsetY: 0,
    useSD: false,
    highlight: true,
    colorMode: 'character',
    color: '#e66d9f',
    glow: 60,
  }
}

/** Conteúdo vazio, para começar uma geração. */
export function emptyContent(): GraphicContent {
  return {
    eventName: '',
    logoId: null,
    channels: { twitch: { show: false, handle: '' }, youtube: { show: false, handle: '' } },
    casters: [],
    teamNames: ['Vencedor', 'Vice'],
    winner: 0,
    competitors: [],
    leaders: [null, null],
    leaderLayout: [defaultLeaderPlacement(), defaultLeaderPlacement()],
  }
}
