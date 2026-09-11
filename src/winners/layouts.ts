import type { GraphicLayout } from './types'

/** Tela do gráfico, em unidades internas. O preview e a exportação escalam. */
export const CANVAS = { width: 1920, height: 1080 }

/** Onde entra um competidor, e com que destaque. */
export interface Slot {
  x: number
  y: number
  width: number
  /** Altura do retrato; o nome fica logo abaixo. */
  height: number
  /** Rótulo de colocação ("1º", "5º"). Vazio nos layouts de time. */
  rank: string
  /** Duplas desenham dois retratos dentro da mesma caixa. */
  pair: boolean
  /** Nos layouts de confronto: 0 = vencedor, 1 = perdedor (dessaturado). */
  team?: 0 | 1
  /**
   * Largura que o arranjo reservou para este competidor. O retrato pode crescer
   * além disso, mas o nome continua limitado ao passo — senão aumentar a
   * moldura fazia o texto invadir o vizinho.
   */
  pitch?: number
  /**
   * Linha onde o nome é escrito. Vem do fim do bloco reservado, não da moldura:
   * assim toda a fileira escreve na mesma altura, mesmo com molduras de
   * tamanhos diferentes ou encolhidas pela escala.
   */
  nameY: number
}

/**
 * Ajustes que mudam o arranjo, não só o desenho.
 *
 * As escalas entram aqui e não depois: esticar as molduras no fim fazia as
 * fileiras se sobreporem. Com o arranjo sabendo o tamanho final, ele afasta as
 * fileiras na medida certa.
 */
export interface LayoutOptions {
  leaders?: boolean
  widthScale?: number
  heightScale?: number
  /** Espaço extra entre colunas e entre fileiras. */
  gapX?: number
  gapY?: number
  /**
   * Largura do bloco de cada time, em fração da reservada. Acima de 1 ele
   * avança sobre a faixa dos líderes — que ficam atrás, é intencional.
   */
  spread?: number
}

export interface LayoutSpec {
  label: string
  /** Quantidade de competidores que o arranjo comporta. */
  maxSlots: number
  /** Valor inicial ao trocar de layout. */
  defaultSlots: number
  slots: (count: number, opts?: LayoutOptions) => Slot[]
}

const HEADER_H = 210
const FOOTER_H = 120
const AREA = {
  top: HEADER_H,
  height: CANVAS.height - HEADER_H - FOOTER_H,
}

/** Espaço reservado ao nome sob cada retrato. */
const NAME_BAND = 62

/**
 * Espaço para a colocação acima do retrato. Generoso de propósito: além de
 * impedir que o número suba até o cabeçalho, é ele que separa o número de uma
 * fileira do nome da fileira anterior.
 */
const RANK_BAND = 76

/**
 * Até onde o crescimento pode descer. Aumentar a altura empurra o bloco para
 * baixo, não para cima: em cima estão o título, o rótulo do time e as
 * colocações, enquanto a faixa do rodapé é quase toda vazia — só tem os canais
 * num canto e os narradores no outro.
 *
 * O bloco entra nessa faixa, mas para antes da linha de texto dela (que começa
 * por volta de 1003): o nome sai 30 acima do fim do bloco, então o limite deixa
 * as duas linhas separadas mesmo na fileira de baixo, que ocupa a largura toda.
 */
const GROWTH_FLOOR = CANVAS.height - 90

/**
 * Quanto a altura ainda pode crescer descendo a partir de `top`, em `rows`
 * fileiras com `band` de texto cada. Devolve escala e não altura porque um
 * arranjo com blocos de tamanhos diferentes precisa aplicar o mesmo fator a
 * todos: se cada um crescesse até o seu próprio limite, o campeão pararia antes
 * dos vices e a hierarquia se inverteria.
 *
 * Nunca devolve menos que 1 — encolher é livre, o limite é só para cima. E ele
 * existe para a alavanca parar de responder em vez de desenhar fora da tela.
 */
function growRoom(pitchH: number, top: number, rows: number, band: number) {
  return Math.max(1, ((GROWTH_FLOOR - top) / rows - band) / pitchH)
}

/** Folga até a borda da tela quando um bloco cresce para os lados. */
const EDGE = 24

const RANKS = ['1º', '2º', '3º', '4º', '5º', '5º', '7º', '7º']

/** Distribui `n` caixas de passo `w` centradas em torno de `centerX`. */
function centerRow(n: number, w: number, gap: number, centerX: number) {
  const total = n * w + (n - 1) * gap
  return (i: number) => centerX - total / 2 + i * (w + gap)
}

/**
 * Top 8 com destaque: o campeão ocupa a esquerda num quadro grande, e do 2º em
 * diante vão para a direita em duas fileiras — 4 em cima, 3 embaixo.
 *
 * Em linha, o pódio tratava o campeão como só mais um da fila; assim a
 * hierarquia se lê de longe, que é o que um cartaz de resultado precisa.
 */
function topEight(count: number, pair: boolean, opts: LayoutOptions): Slot[] {
  const ws = opts.widthScale ?? 1
  const margin = 80
  const gap = 26 + (opts.gapX ?? 0)
  const slots: Slot[] = []

  const heroPitchW = pair ? 480 : 400
  const heroPitchH = 560

  // --- a direita, medida antes de desenhar: é ela que limita a escala ---
  const rest = count - 1
  const zoneLeft = margin + heroPitchW + 70
  const zoneWidth = CANVAS.width - margin - zoneLeft
  const zoneCx = zoneLeft + zoneWidth / 2

  const topRow = Math.min(rest, 4)
  const bottomRow = Math.max(0, rest - topRow)
  const cols = Math.max(topRow, 1)

  const rowsUsed = bottomRow ? 2 : 1
  // Entre uma fileira e a seguinte cabem duas faixas de texto: o nome da de
  // cima e a colocação da de baixo. Reservar só uma fazia o número da segunda
  // fileira aterrissar em cima do nome da primeira.
  const bands = NAME_BAND + RANK_BAND + (opts.gapY ?? 0)
  const pitchW = (zoneWidth - (cols - 1) * gap) / cols
  const pitchH = Math.min(pitchW * 1.15, (AREA.height - bands * rowsUsed) / rowsUsed)

  // O campeão tem mais folga vertical que as fileiras; a escala do arranjo é a
  // menor das duas, para o destaque não virar desproporção.
  const hs = Math.min(
    opts.heightScale ?? 1,
    growRoom(heroPitchH, AREA.top, 1, NAME_BAND),
    rest > 0 ? growRoom(pitchH, AREA.top, rowsUsed, bands) : Infinity
  )

  // --- campeão, à esquerda ---
  const heroW = heroPitchW * ws
  const heroH = heroPitchH * hs
  const heroBand = Math.max(heroPitchH, heroH)
  const heroCx = margin + heroPitchW / 2
  const heroTop = AREA.top + Math.max(0, (AREA.height - NAME_BAND - heroBand) / 2)
  // O pé da moldura fica na linha do nome: encolhendo, o retrato continua
  // apoiado nela; crescendo, é a linha que desce junto com ele.
  const heroLine = heroTop + heroBand
  slots.push({
    x: heroCx - heroW / 2,
    y: heroLine - heroH,
    width: heroW,
    height: heroH,
    rank: RANKS[0],
    pair,
    pitch: heroPitchW,
    nameY: heroLine,
  })
  if (count <= 1) return slots

  // --- do 2º em diante, à direita ---
  const cellW = pitchW * ws
  const cellH = pitchH * hs

  // A fileira só se afasta quando a moldura passa do passo — é o que evita a
  // sobreposição ao aumentar a altura.
  const rowStep = Math.max(pitchH, cellH) + bands
  const blockH = rowsUsed * rowStep - RANK_BAND
  const firstRowY = AREA.top + RANK_BAND + Math.max(0, (AREA.height - RANK_BAND - blockH) / 2)

  const place = (n: number, row: number, rankOffset: number) => {
    const at = centerRow(n, pitchW, gap, zoneCx)
    const line = firstRowY + row * rowStep + Math.max(pitchH, cellH)
    for (let i = 0; i < n; i++) {
      slots.push({
        x: at(i) + (pitchW - cellW) / 2,
        y: line - cellH,
        width: cellW,
        height: cellH,
        rank: RANKS[rankOffset + i],
        pair,
        pitch: pitchW,
        nameY: line,
      })
    }
  }

  place(topRow, 0, 1)
  if (bottomRow) place(bottomRow, 1, 1 + topRow)
  return slots
}

/** Pódio de 3: o campeão sobe e cresce. */
function podium(count: number, opts: LayoutOptions): Slot[] {
  const ws = opts.widthScale ?? 1
  const hs = opts.heightScale ?? 1
  const order = [1, 0, 2] // 2º, 1º, 3º da esquerda para a direita
  const pitchW = [380, 500, 380]
  const pitchH = [430, 560, 430]
  const gap = 50 + (opts.gapX ?? 0)
  const sizeAt = (rank: number) => (rank === 0 ? 1 : rank === 1 ? 0 : 2)
  const total =
    order.filter((r) => r < count).reduce((sum, r) => sum + pitchW[sizeAt(r)], 0) +
    (Math.min(count, 3) - 1) * gap

  const slots: Slot[] = []
  // O degrau do meio manda: é o mais alto, então é dele que sai o limite, e a
  // escala que sobrar vale igual para os três.
  const scale = Math.min(hs, growRoom(pitchH[1], AREA.top, 1, NAME_BAND))
  const band = Math.max(pitchH[1], pitchH[1] * scale)
  const podiumTop = AREA.top + Math.max(0, (AREA.height - NAME_BAND - band) / 2)
  // Todos na mesma linha: o pódio alinha os pés, o texto acompanha. Crescer
  // desce essa linha em vez de espalhar o bloco para os dois lados.
  const line = podiumTop + band
  let x = (CANVAS.width - total) / 2
  for (const rank of order) {
    if (rank >= count) continue
    const pw = pitchW[sizeAt(rank)]
    const ph = pitchH[sizeAt(rank)]
    const w = pw * ws
    const h = ph * scale
    slots.push({
      x: x + (pw - w) / 2,
      y: line - h,
      width: w,
      height: h,
      rank: RANKS[rank],
      pair: false,
      pitch: pw,
      nameY: line,
    })
    x += pw + gap
  }
  return slots.sort((a, b) => a.rank.localeCompare(b.rank))
}

/**
 * Dois times lado a lado, até 10 de cada. O perdedor é desenhado em tons de
 * cinza — a diferença de saturação diz quem ganhou sem precisar de legenda.
 */
/**
 * Onde ficam os dois blocos de time. Sai daqui e não de dentro do arranjo
 * porque a faixa do líder é justamente o que sobra ao lado deles — as duas
 * contas precisam da mesma origem, senão encolher o bloco abria um buraco em vez
 * de dar espaço ao líder.
 */
function teamBlocks(count: number, opts: LayoutOptions) {
  const perTeam = Math.max(1, Math.ceil(count / 2))
  // Menos colunas deixam os retratos maiores; a partir de 9 por time não cabe.
  const cols = perTeam <= 4 ? perTeam : perTeam <= 8 ? 4 : 5
  const rows = Math.ceil(perTeam / cols)

  const margin = 70
  const centerGap = 90
  const gap = 16 + (opts.gapX ?? 0)
  const leaderSpace = opts.leaders ? LEADER_WIDTH + 20 : 0

  // A célula sai do espaço disponível em vez de um tamanho fixo: assim o bloco
  // ocupa a sua metade da tela seja com 3 ou com 10 jogadores.
  const reserved = (CANVAS.width - margin * 2 - centerGap - leaderSpace * 2) / 2
  // O bloco pode passar do que sobrou depois dos líderes e avançar sobre eles —
  // os líderes são desenhados antes, então ficam atrás, e a faixa lateral deles
  // é mais alta que os retratos. O teto é a borda da tela.
  const widest = (CANVAS.width - EDGE * 2 - centerGap) / 2
  const blockW = Math.min(reserved * (opts.spread ?? 1), widest)

  return {
    perTeam,
    cols,
    rows,
    gap,
    blockW,
    // Ancorado no vão central: alargar o bloco o faz crescer para fora, e a
    // distância entre os dois times continua a mesma.
    blockX: [CANVAS.width / 2 - centerGap / 2 - blockW, CANVAS.width / 2 + centerGap / 2],
  }
}

function teamVs(count: number, opts: LayoutOptions): Slot[] {
  const ws = opts.widthScale ?? 1
  const hs = opts.heightScale ?? 1
  const { perTeam, cols, rows, gap, blockW, blockX } = teamBlocks(count, opts)
  const pitchW = (blockW - (cols - 1) * gap) / cols
  // O retrato cresce até onde a área permite: a proporção 1.22 desperdiçava
  // altura, deixando o personagem pequeno num espaço que estava sobrando.
  const pitchH = Math.min(pitchW * 1.85, (AREA.height - 70 - rows * NAME_BAND) / rows)
  const cellW = pitchW * ws
  // +40 abre espaço para o rótulo do time acima do bloco.
  const blockTop = AREA.top + 40
  const cellH = pitchH * Math.min(hs, growRoom(pitchH, blockTop, rows, NAME_BAND + (opts.gapY ?? 0)))

  const rowStep = Math.max(pitchH, cellH) + NAME_BAND + (opts.gapY ?? 0)
  const blockH = rows * rowStep
  // Centrado enquanto cabe; passando disso o topo trava e a sobra desce, para
  // o bloco não subir por cima do rótulo do time e do título do evento.
  const blockY = blockTop + Math.max(0, (AREA.height - 40 - blockH) / 2)

  const slots: Slot[] = []
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < perTeam; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      // Última fileira incompleta fica centrada no bloco, senão sobra um buraco
      // à direita e o time parece torto.
      const inRow = Math.min(cols, perTeam - row * cols)
      const rowW = inRow * pitchW + (inRow - 1) * gap
      // O pé da moldura é a linha do nome: encolhendo, o retrato continua
      // apoiado nela; crescendo, é a linha que desce junto com ele.
      const line = blockY + row * rowStep + Math.max(pitchH, cellH)
      slots.push({
        x: blockX[team] + (blockW - rowW) / 2 + col * (pitchW + gap) + (pitchW - cellW) / 2,
        y: line - cellH,
        width: cellW,
        height: cellH,
        rank: '',
        pair: false,
        team: team as 0 | 1,
        pitch: pitchW,
        nameY: line,
      })
    }
  }
  return slots
}

export const LAYOUTS: Record<GraphicLayout, LayoutSpec> = {
  top8: {
    label: 'Top 8',
    maxSlots: 8,
    defaultSlots: 8,
    slots: (count, opts = {}) => topEight(count, false, opts),
  },
  'top8-duo': {
    label: 'Top 8 duplas',
    maxSlots: 8,
    defaultSlots: 8,
    slots: (count, opts = {}) => topEight(count, true, opts),
  },
  top3: {
    label: 'Pódio (top 3)',
    maxSlots: 3,
    defaultSlots: 3,
    slots: (count, opts = {}) => podium(count, opts),
  },
  'team-vs': {
    label: 'Time vencedor',
    maxSlots: 20,
    defaultSlots: 10,
    slots: (count, opts = {}) => teamVs(count, opts),
  },
}

/** Faixa lateral reservada para o líder de cada time. */
export const LEADER_WIDTH = 300

/** Faixa mínima do líder, para ele não sumir quando o bloco avança sobre ele. */
const LEADER_MIN = 150

/** Folga entre a faixa do líder e o bloco de jogadores. */
const LEADER_GUTTER = 12

/**
 * Faixa do líder: tudo o que sobra entre a borda da tela e o bloco do time.
 *
 * Não é largura fixa. Estreitar o bloco de jogadores alarga o líder na mesma
 * medida — a sobra tem que ir para algum lugar, e o líder é quem está ali. No
 * sentido contrário, alargar o bloco além do reservado come a faixa, até o
 * mínimo: como o líder é desenhado antes dos retratos, ele fica atrás e a
 * sobreposição não atrapalha.
 */
export function leaderBox(side: 0 | 1, count: number, opts: LayoutOptions = {}) {
  const { blockW, blockX } = teamBlocks(count, { ...opts, leaders: true })
  const y = AREA.top - 30
  const height = AREA.height + 30

  if (side === 0) {
    const width = Math.max(LEADER_MIN, blockX[0] - LEADER_GUTTER - EDGE)
    return { x: EDGE, y, width, height }
  }
  const right = CANVAS.width - EDGE
  const width = Math.max(LEADER_MIN, right - (blockX[1] + blockW + LEADER_GUTTER))
  return { x: right - width, y, width, height }
}

export const HEADER = { height: HEADER_H }
export const FOOTER = { height: FOOTER_H, top: CANVAS.height - FOOTER_H }
