/** Template de animação de apresentação. Vive no localStorage — ver store.ts. */

/**
 * As coreografias disponíveis.
 *
 * São efeitos desenhados em CSS e SVG, e não vídeo: recolorem com a cor do
 * template, escalam para qualquer resolução de fonte, não pesam no repositório e
 * não trazem licença de terceiros junto. Um render pronto ficaria travado na cor
 * e na resolução em que foi exportado.
 */
export type AnimStyle =
  | 'abertura'
  | 'correntes'
  | 'chamas'
  | 'relampago'
  | 'estilhaco'
  | 'neon'
  | 'petalas'
  | 'glitch'
  | 'vortice'
  | 'cortina'
  | 'faiscas'
  | 'ondas'

/** De onde sai o fundo da apresentação. */
export type AnimBgType = 'none' | 'solid' | 'gradient' | 'image' | 'scenery'

/**
 * O fundo da cena.
 *
 * `none` deixa a transmissão aparecer atrás, como o overlay sempre fez. Os
 * outros cobrem o quadro — que é o que uma apresentação costuma querer, já que
 * ela toma a tela inteira de qualquer forma.
 */
export interface AnimBackground {
  type: AnimBgType
  color: string
  gradient: { angle: number; stops: string[] }
  /** Data URL de uma imagem escolhida à mão. Só vale em `image`. */
  image: string | null
  /** Id de um fundo de public/backgrounds/index.json. Só vale em `scenery`. */
  presetId: string | null
  /**
   * Desfoque em px. É o que transforma um cenário em fundo: nítido, ele disputa
   * a atenção com os personagens que deveria emoldurar.
   */
  blur: number
  /** Véu escuro por cima, 0–100, para o nome continuar legível sobre foto. */
  dim: number
}

export interface AnimTemplate {
  id: string
  name: string

  /** Qual coreografia toca. */
  style: AnimStyle

  background: AnimBackground

  /** Troca a arte oficial pelo sprite chibi (SD), como na topbar. */
  useSD: boolean

  /**
   * Enquadramento das figuras: escala sobre a régua que já iguala a altura do
   * elenco, e o quanto as duas sobem ou descem juntas, em px de cena.
   *
   * Quem manda nisto agora é o painel do overlay — o ajuste depende de quem foi
   * escalado, e quem foi escalado só se sabe na hora do set. O que fica aqui é o
   * ponto de partida: escolher a animação no painel carrega estes dois valores
   * nos controles de lá.
   */
  figureZoom: number
  figureOffsetY: number

  typography: {
    fontFamily: string
    nameColor: string
    /** Sigla do time, sob o nome. */
    teamColor: string
  }

  /** Mostra a sigla do time sob o nome. Sem time cadastrado, some sozinha. */
  showTeam: boolean

  /** Cor do efeito — correntes, chamas, o clarão da abertura. */
  accentColor: string
  /**
   * Ignora `accentColor` e acende cada lado com a cor primária do próprio
   * personagem, como o brilho da topbar faz.
   */
  useCharacterColor: boolean

  /**
   * Entrada e saída da cena **inteira**, em ms — fundo incluído.
   *
   * Só faz diferença com fundo: sem ele a cena já é transparente e cada peça
   * entra e sai por conta própria. Com fundo, o quadro aparece e some de uma vez,
   * e num corte seco isso pisca na transmissão.
   *
   * Zero desliga. Descontados da duração total, não somados a ela.
   */
  fadeIn: number
  fadeOut: number

  /**
   * Duração total, em ms. As fases (entrada, sustentação, saída) são frações
   * disto, então esticar o número estica a animação inteira sem descolar nada.
   */
  duration: number

  createdAt: string
}

/** Quem entra em cada lado da apresentação. */
export interface AnimSide {
  name: string
  teamTag: string | null
  characterSlug: string | null
}

/**
 * Um disparo da animação.
 *
 * O `runId` é o que faz a fonte tocar de novo sem recarregar: o payload chega
 * inteiro a cada mexida no painel, e é a mudança deste id — não a presença do
 * template — que significa "toca agora". Sem ele, mexer no placar durante a
 * apresentação a reiniciaria do zero.
 */
export interface AnimPlay {
  template: AnimTemplate
  sides: [AnimSide, AnimSide]
  runId: string
  /** URL do cenário escolhido, já resolvida — o OBS não lê o índice local. */
  sceneryUrl?: string | null
  /**
   * Enquadramento das figuras neste disparo. Ausente = o que o template trazia.
   *
   * Viaja no disparo e não no template porque muda com quem está em cena: duas
   * artes largas pedem espaço no meio, e isso não se sabe antes de a chave dizer
   * quem joga.
   */
  figureZoom?: number
  figureOffsetY?: number
}
