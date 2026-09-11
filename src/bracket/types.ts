/** Chave de torneio. Templates e torneios vivem no localStorage — ver store.ts. */

/** Quem está numa vaga da chave. */
export interface Entry {
  /** id de um Player cadastrado. Nulo = nome digitado na hora. */
  playerId: string | null
  name: string
  /**
   * O segundo jogador da vaga, no modo de duplas.
   *
   * A dupla é **um** participante: ela avança junta, tem um placar só e ocupa uma
   * vaga só. Por isso mora dentro da inscrição, e não como uma segunda inscrição
   * — que teria que ser mantida ao lado da primeira em cada sorteio e cada troca
   * de posição.
   */
  partner?: { playerId: string | null; name: string } | null
}

/**
 * Um confronto.
 *
 * `slots` guarda **índice na lista de participantes**, e não o objeto: trocar
 * duas pessoas de lugar vira trocar dois números, e o placar e o resultado ficam
 * onde estão — presos ao confronto, que é o que não muda.
 */
export interface Match {
  /** Rodada, de 0 (primeira) até a final. */
  round: number
  /** Posição do confronto dentro da rodada, de cima para baixo. */
  order: number
  /** Índice do participante, ou nulo: bye, ou vaga que ainda não foi decidida. */
  slots: [number | null, number | null]
  score: [number, number]
  /** Quem passou. Nulo = em aberto. */
  winner: 0 | 1 | null
  /**
   * Apagado à mão pelo painel, por lado.
   *
   * Separado do cinza automático do perdedor: aquele é consequência do
   * resultado, este é decisão de quem está operando — marcar quem desistiu, quem
   * foi desclassificado, ou quem já era numa fase que ainda não fechou.
   */
  dim?: [boolean, boolean]
}

/**
 * Uma pessoa dentro de uma torre, no modo de times.
 *
 * Placar e cinza ficam aqui, e não num confronto: não há confronto. Numa guerra
 * de times o que se acompanha é quem ainda está de pé e quantas o time levou.
 */
export interface TowerSlot {
  /** Índice na lista de participantes. */
  entry: number
  score: number
  dim: boolean
}

/**
 * Os dois lados do modo de times.
 *
 * O time não tem placar: quem pontua é cada jogador, na sua vaga. Um número no
 * cabeçalho competia com esses e dizia outra coisa — e numa guerra de times o
 * que se acompanha é quem ainda está de pé.
 */
export interface Towers {
  names: [string, string]
  sides: [TowerSlot[], TowerSlot[]]
  /**
   * Alguém já mexeu nas torres à mão?
   *
   * Separa "ninguém escalou ainda" de "esvaziei de propósito". Sem essa
   * diferença, tirar todo mundo das torres fazia a divisão automática devolver
   * o elenco inteiro no quadro seguinte — o sistema desfazendo o que acabaram
   * de fazer.
   */
  touched?: boolean
}

export interface Tournament {
  id: string
  name: string
  /** Até MAX_ENTRIES. A ordem aqui é a ordem de entrada na chave. */
  entries: Entry[]
  matches: Match[]
  /**
   * Só o modo de times usa. Fica ao lado dos confrontos, e não no lugar deles:
   * trocar de modo no meio de um evento não pode apagar a chave que já foi ao
   * ar — e a lista de participantes é a mesma nos dois.
   */
  towers?: Towers
  createdAt: string
}

/**
 * O que a chave desenha.
 *
 * `solo` é o confronto de sempre. `duo` põe os dois da dupla na mesma linha —
 * dois bonecos, dois nomes, duas bandeiras. `times` larga a chave e desenha duas
 * torres, uma por time, que é como uma guerra 5x5 se acompanha: quem já caiu
 * fica em cinza, e o placar sobe de um em um.
 */
export type BracketMode = 'solo' | 'duo' | 'times'

/** Onde um gesto da prévia acontece. */
export type SlotRef =
  | { kind: 'match'; round: number; order: number; side: 0 | 1 }
  | { kind: 'tower'; side: 0 | 1; index: number }

/**
 * Os gestos que a prévia do painel aceita. Ausente = desenho parado.
 *
 * A fonte do OBS nunca recebe isto: lá a chave é imagem. Quem edita é o painel,
 * onde mexer na vaga que se está vendo é mais direto do que procurar o mesmo
 * confronto numa lista ao lado.
 */
export interface BracketEdit {
  score(ref: SlotRef, delta: number): void
  toggleDim(ref: SlotRef): void
  /** Só onde tirar não perde ninguém: da primeira rodada, não. */
  remove(ref: SlotRef): void
  /** Cópia: quem foi arrastado continua onde estava. */
  copy(from: SlotRef, to: SlotRef): void
}

/**
 * De onde sai o fundo da chave.
 *
 * O fundo cobre a **cena inteira**, e não uma caixa do tamanho da chave: quando
 * a chave entra, ela é a tela, não um adesivo no canto dela. `none` deixa a
 * transmissão aparecer atrás, que é como a chave sempre foi ao ar.
 */
export type BracketBgType = 'none' | 'solid' | 'gradient' | 'image' | 'scenery'

/**
 * O efeito que corre em volta do quadro.
 *
 * Em CSS e SVG, e não em vídeo, pela mesma razão da apresentação: recolore com a
 * cor do template, escala para qualquer resolução de fonte e não traz arquivo
 * nem licença de terceiros junto.
 */
export type BracketFxStyle = 'none' | 'pulso' | 'corrida' | 'tracejado' | 'faiscas' | 'varredura'

export type BracketAlign = 'left' | 'center' | 'right'

/**
 * As cores de um lado no modo de times.
 *
 * Ficam no template, e não no torneio: são a cara da tela, decididas uma vez ao
 * desenhar o modelo e reaproveitadas em toda guerra que usar esse modelo. O que
 * muda de evento para evento é o nome do time e quem está escalado, e isso o
 * painel resolve.
 */
export interface BracketTeamStyle {
  /** A barra do cabeçalho, que é o que identifica o lado de relance. */
  color: string
  /** O nome do time, escrito sobre ela. */
  textColor: string
}

/**
 * Como a tela da chave entra e sai de cena.
 *
 * Um corte seco no meio da transmissão parece falha de fonte. `fade` é o
 * discreto; `barra` é uma faixa que entra pela direita trazendo a tela atrás de
 * si, e sai do mesmo jeito levando-a embora.
 */
export type BracketTransition = 'fade' | 'barra'

/** O quadro atrás da chave. */
export interface BracketBackground {
  type: BracketBgType
  color: string
  gradient: { angle: number; stops: string[] }
  /** Data URL de uma imagem escolhida à mão. Só vale em `image`. */
  image: string | null
  /** Id de um fundo de public/backgrounds/index.json. Só vale em `scenery`. */
  presetId: string | null
  /** Desfoque em px: é o que transforma um cenário em fundo. */
  blur: number
  /** Véu escuro por cima, 0–100, para os nomes continuarem legíveis. */
  dim: number
  /** Respiro entre a borda da tela e o conteúdo, em px de cena. */
  padding: number
  /** Canto do quadro. Numa tela cheia costuma ser zero. */
  radius: number
}

/** O efeito ao redor da tela. */
export interface BracketFrame {
  style: BracketFxStyle
  /** Vale também para a barra de entrada e saída. */
  color: string
  /** 0–100: opacidade e brilho do efeito. */
  intensity: number
  /** Duração de uma volta, em ms. Mais alto, mais lento. */
  speed: number
  /** Espessura da linha, em px de cena. */
  thickness: number
}

/**
 * O texto do quadro: o que a chave diz além dos nomes.
 *
 * Fica no template e não no torneio porque é decisão de visual — o mesmo
 * torneio vai ao ar com "Chave principal" escrito numa tela e sem título nenhum
 * noutra. O que muda a cada evento é o nome, e esse o título vazio já puxa do
 * próprio torneio.
 */
export interface BracketInfo {
  showTitle: boolean
  /** Vazio = o nome do torneio. */
  title: string
  subtitle: string
  align: BracketAlign
  color: string
  /** Tamanho do título, em px de cena. O subtítulo sai proporcional. */
  size: number
  /** Nome da rodada acima de cada coluna. */
  showRounds: boolean
  roundColor: string
  roundSize: number
}

/** Estilo da chave. É o que muda de evento para evento sem mexer nos confrontos. */
export interface BracketTemplate {
  id: string
  name: string

  /** Qual dos três desenhos. Ver BracketMode. */
  mode: BracketMode

  show: {
    /** Bandeira do país, ao lado do nome. */
    countryFlag: boolean
    /** Sigla do time. */
    teamTag: boolean
    /** O boneco do personagem, na lateral da vaga. */
    characterArt: boolean
    score: boolean
    /**
     * Selo em quem passou para a rodada seguinte.
     *
     * Sem ele, quem avançou só se descobre olhando a coluna da frente — e numa
     * chave cortada nas quartas a coluna da frente pode nem estar em cena.
     */
    winnerMark: boolean
  }

  /** O quadro sob a chave. */
  background: BracketBackground
  /** A animação em volta da tela. */
  frame: BracketFrame
  /** Como a tela entra e sai de cena. */
  transition: {
    style: BracketTransition
    /** Duração de cada ponta, em ms. */
    duration: number
    /**
     * Inclinação da barra, em graus. Zero = reta.
     *
     * Vale para a faixa e para o corte que ela carrega: os dois andam juntos, e
     * uma barra torta sobre um corte reto se denunciaria na primeira passada.
     */
    angle: number
  }
  /** Título, subtítulo e nomes de rodada. */
  info: BracketInfo
  /** As cores dos dois lados, no modo de times. */
  teams: [BracketTeamStyle, BracketTeamStyle]

  typography: {
    fontFamily: string
    nameColor: string
    scoreColor: string
  }

  /**
   * Realce da vaga.
   *
   * `useCharacterColor` acende cada uma com a cor primária do personagem, do
   * mesmo jeito que a topbar e a apresentação — é o que faz a chave ler como
   * parte do mesmo conjunto.
   */
  highlight: {
    enabled: boolean
    useCharacterColor: boolean
    color: string
    /** 0–100. */
    intensity: number
  }

  /** Quem perdeu sai de cor. Sem isto, uma chave cheia vira uma parede igual. */
  dimLosers: boolean
  /** 0–100: quanto o perdedor perde de cor. */
  dimAmount: number

  slot: {
    /** Largura da vaga, em px de cena. */
    width: number
    height: number
    /** Espaço vertical entre vagas da mesma rodada. */
    gap: number
    /** Espaço horizontal entre rodadas. */
    columnGap: number
    radius: number
    background: string
    borderColor: string
  }

  createdAt: string
}

/**
 * O que o overlay desenha da chave: template e torneio já resolvidos.
 *
 * Quem joga, o placar e quem passou vêm daqui — do torneio, montado no painel do
 * overlay. O template não guarda ninguém: ele é só a cara, reaproveitada de
 * evento em evento.
 */
export interface BracketPlay {
  template: BracketTemplate
  tournament: Tournament
  /** Dados de cada participante, resolvidos — o OBS não tem o cadastro daqui. */
  people: Person[]
  /**
   * Primeira rodada a desenhar.
   *
   * Uma chave de 40 tem 64 vagas e mede 2080x4352px — não cabe em 1080p num
   * tamanho legível. Transmissão de verdade não mostra a chave inteira: mostra
   * das quartas em diante. Cortar a rodada é o que torna isso possível sem
   * encolher o texto até sumir.
   */
  fromRound?: number
}

/** Um participante com tudo que a vaga precisa desenhar. */
export interface Person {
  name: string
  teamTag: string | null
  characterSlug: string | null
  countryCode: string | null
  /** Cor primária do personagem, já resolvida. */
  color: string | null
  /** O outro da dupla, no modo `duo`. */
  partner?: Person | null
}
