/** Formato dos arquivos em public/characters/data/<slug>.json. */

export type ColorRole = 'primary' | 'secondary' | 'tertiary'

export interface CharacterColor {
  role: ColorRole
  hex: string
  rgb: [number, number, number]
  /** OKLab — útil para interpolar e derivar tons sem sujar o matiz. */
  oklab: [number, number, number]
  /** Fração dos pixels opacos da arte que caem neste cluster. */
  coverage: number
}

export interface Character {
  slug: string
  name: string
  voiceActor: string | null
  profile: {
    height: string | null
    weight: string | null
    birthday: string | null
    bloodType: string | null
    /** EXS / habilidade. */
    ability: string | null
    weapon: string | null
  }
  bio: string[]
  assets: {
    art: string | null
    artPortrait: string | null
    catchphrase: string | null
    /** Sprite chibi (SD). Nulo para quem ainda não tem um na wiki. */
    sd?: string | null
  }
  /** Dimensões do sprite SD, para saber a proporção sem carregar a imagem. */
  sdSize?: { width: number; height: number } | null
  /** Da mais chamativa à menos. Nulo só se a extração ainda não rodou. */
  colors: CharacterColor[] | null
  /** Paleta ajustada à mão: extract-colors.mjs não sobrescreve. */
  colorsLocked?: boolean
  /**
   * Enquadramento do rosto, normalizado (0-1) sobre a arte. Quadrado em pixels,
   * com zoom out para pegar cabeça e ombros. Usado no modo lista.
   */
  face: { x: number; y: number; width: number; height: number } | null
  /** Dimensões da arte — necessárias para converter `face` em pixels. */
  imageSize?: { width: number; height: number }
  /** Enquadramento marcado à mão: detect-faces.mjs não sobrescreve. */
  faceLocked?: boolean
  /**
   * Correção à mão da escala da arte oficial, de scripts/scale-overrides.json.
   * O chibi não precisa de uma: a escala dele está gravada no próprio sprite.
   */
  artScale?: number
  /**
   * Fração da arte que é corpo sólido (alfa >= 200). Metade da régua da
   * apresentação — ver src/anim/AnimStage.tsx.
   */
  artSolid?: number | null
  /** O mesmo, no sprite chibi — a outra metade da régua dele. */
  sdSolid?: number | null
  /**
   * Correção só da apresentação, por cima da régua de cabeça. Separada de
   * `artScale`, que também vale para os retratos do gráfico de vencedores —
   * corrigir a pose de um numa tela não pode mexer na outra.
   */
  animScale?: number
  /**
   * Corpo medido a partir do ponto dos olhos, em fração da altura da imagem:
   * quanto vai até o topo e quanto vai até os pés. Não é escala — é o que
   * permite desenhar dois personagens com a mesma altura de corpo, que é o que
   * a faixa do líder precisa.
   */
  artBody?: { above: number; below: number } | null
  sdBody?: { above: number; below: number } | null
  /**
   * Ponto logo abaixo dos olhos, normalizado sobre a arte. Levado a 50% x 25%
   * do bloco, alinha todos os personagens apesar das poses diferentes.
   */
  anchor?: { x: number; y: number } | null
  /**
   * Centro de corpo inteiro, quando o ponto do rosto não serve para os dois. A
   * mira que enquadra bem numa topbar às vezes deixa a figura torta no quadro do
   * gráfico. Nulo = usa `anchor`.
   */
  bodyAnchor?: { x: number; y: number } | null
  /** O mesmo ponto, no sprite SD — que tem enquadramento bem diferente. */
  sdAnchor?: { x: number; y: number } | null
  source: string
  rosterOrder: number
  scrapedAt: string
}

/** Formato de public/flags/index.json, gerado por scripts/fetch-flags.mjs. */

export interface FlagCell {
  /** ISO 3166-1 alpha-2 para país, ISO 3166-2 para subdivisão. */
  code: string
  name: string
  /** Posição da bandeira dentro do sprite, em ordem de leitura. */
  index: number
}

export interface CountryCell extends FlagCell {
  subregion: string
  /** Quantas subdivisões com bandeira este país tem. */
  regions: number
}

export interface FlagSheet<T extends FlagCell = FlagCell> {
  sheet: string
  rows: number
  items: T[]
}

export interface FlagManifest {
  cell: { width: number; height: number }
  columns: number
  countries: FlagSheet<CountryCell>
  /** Chaveado pelo código do país; só existe para quem tem subdivisões. */
  regions: Record<string, FlagSheet>
}

/** Uma bandeira pronta para recortar do sprite. */
export interface FlagSpec {
  sheet: string
  index: number
  columns: number
  /** Linhas do sprite — o SVG precisa dimensionar a imagem inteira. */
  rows: number
  label: string
}

/** Time cadastrado. Vive no localStorage — ver src/teams.ts. */
export interface Team {
  id: string
  name: string
  /** Sigla curta, é o que aparece no cartão do player. */
  tag: string
  /** Logo em data URL (redimensionada na hora do upload). */
  logo: string | null
  createdAt: string
}

/** Logo de evento. Vive no localStorage — ver src/events.ts. */
export interface EventLogo {
  id: string
  name: string
  /** Imagem em data URL, com a proporção original preservada. */
  image: string
  /** Dimensões do que foi guardado — evita carregar a imagem só para saber. */
  width: number
  height: number
  createdAt: string
}

/** Player cadastrado. Vive no localStorage — ver src/players.ts. */
export interface Player {
  id: string
  name: string
  /** slug de um Character. */
  characterSlug: string
  /**
   * O time vem de um dos dois: `teamId` aponta para um time cadastrado (que tem
   * logo), `team` é um nome digitado na hora. Nunca os dois ao mesmo tempo.
   */
  teamId?: string | null
  team: string | null
  /**
   * Ambas as bandeiras são opcionais e independentes: dá para exibir só a do
   * país, só a do estado, as duas, ou nenhuma.
   */
  countryCode: string | null
  /** ISO 3166-2 — carrega o país no próprio código ("BR-SP"). */
  regionCode: string | null
  /** @ do X (Twitter), sem o arroba. Aparece nos gráficos com espaço de sobra. */
  twitter?: string | null
  createdAt: string
}

export type ViewMode = 'grid' | 'list'
