/** Template de topbar de stream. Vive no localStorage — ver src/topbar/store.ts. */

export type BarShape = 'straight' | 'center-notch'
export type NotchDirection = 'up' | 'down'
export type EdgeStyle = 'square' | 'rounded' | 'taper'
export type TaperDirection = 'up' | 'down'
export type FillType = 'solid' | 'gradient'
export type BorderStyle = 'none' | 'solid' | 'dotted' | 'dashed' | 'dash-dot'

export interface TopbarTemplate {
  id: string
  name: string

  /** Altura da barra em unidades do template (a largura é fixa, ver WIDTH). */
  barHeight: number

  shape: {
    style: BarShape
    /** Quanto o miolo avança para fora da barra. */
    notchDepth: number
    notchWidth: number
    /** Inclinação das laterais do miolo; 0 dá um degrau reto. */
    notchSlant: number
    notchDirection: NotchDirection
  }

  edges: {
    style: EdgeStyle
    radius: number
    /** Quanto a ponta recua na diagonal. */
    taper: number
    taperDirection: TaperDirection
  }

  fill: {
    type: FillType
    color: string
    gradient: {
      /** Graus, 0 = da esquerda para a direita. */
      angle: number
      stops: string[]
      /**
       * Espelha o degradê na barra do player 2, para as duas se refletirem em
       * vez de correrem no mesmo sentido.
       */
      mirror: boolean
    }
    /**
     * Cada lado com o próprio fundo. Desligado, o player 2 repete o do player 1
     * (espelhado ou não, conforme `gradient.mirror`).
     */
    perSide: boolean
    /** O fundo do player 2 quando `perSide` está ligado. Usa o mesmo `type`. */
    p2: {
      color: string
      gradient: { angle: number; stops: string[] }
    }
  }

  /** Contorno desenhado sobre a silhueta. */
  border: {
    style: BorderStyle
    color: string
    width: number
  }

  /** Brilho colorido por trás da barra, escapando pelas bordas. */
  highlight: {
    enabled: boolean
    /** Cor do player 1. */
    color: string
    /** Cor do player 2: cada lado acende com a sua, sem depender do boneco. */
    color2: string
    /**
     * Ignora as cores acima e usa a cor primária do personagem em cena — cada
     * player acende a barra com a própria identidade.
     */
    useCharacterColor: boolean
    /** 0–100. */
    intensity: number
    blur: number
  }

  typography: {
    fontFamily: string
    nameColor: string
    teamColor: string
    scoreColor: string
  }

  show: {
    characterArt: boolean
    /** Troca a arte oficial pelo sprite chibi (SD). */
    useSD: boolean
    /** Alinha os personagens pelo ponto abaixo dos olhos. */
    useAnchor: boolean
    teamTag: boolean
    teamFlag: boolean
    countryFlag: boolean
    regionFlag: boolean
  }

  createdAt: string
}

/** O que a topbar exibe. Vem de um player cadastrado ou montado à mão. */
export interface TopbarData {
  name: string
  teamTag: string | null
  teamLogo: string | null
  characterSlug: string | null
  countryCode: string | null
  regionCode: string | null
  score: number
}
