import type { Entry, Match, Tournament } from './types'

/** Teto de participantes. 40 cabe numa chave de 64 com folga de byes. */
export const MAX_ENTRIES = 40

/**
 * Monta a chave de eliminatória simples a partir da ordem dos participantes.
 *
 * O tamanho é a próxima potência de dois, e as vagas que sobram viram **bye**:
 * quem cai num bye passa de rodada sem jogar, e o confronto já nasce decidido.
 * Com 40 pessoas a chave tem 64 vagas e 24 byes — o que é o normal de um
 * torneio, não um caso especial.
 *
 * A ordem de encaixe é a de sempre em chaveamento: 1 encara o último, 2 encara o
 * penúltimo, e assim por diante, de modo que os dois primeiros só se cruzem na
 * final. É o que `seedOrder` calcula.
 */
export function buildBracket(entries: Entry[]): Match[] {
  const n = entries.length
  if (n < 2) return []

  const size = 1 << Math.ceil(Math.log2(n))
  const ordem = seedOrder(size)
  const matches: Match[] = []

  // Primeira rodada: os pares saem da ordem de chaveamento, e quem cair numa
  // posição além da lista de participantes é bye.
  for (let i = 0; i < size / 2; i++) {
    const a = ordem[i * 2]
    const b = ordem[i * 2 + 1]
    matches.push({
      round: 0,
      order: i,
      slots: [a < n ? a : null, b < n ? b : null],
      score: [0, 0],
      winner: null,
    })
  }

  // As rodadas seguintes nascem vazias: quem as preenche é `advance`.
  for (let round = 1; round < Math.log2(size); round++) {
    for (let i = 0; i < size / 2 ** (round + 1); i++) {
      matches.push({ round, order: i, slots: [null, null], score: [0, 0], winner: null })
    }
  }

  // Os byes já resolvem sozinhos, em cascata: numa chave com muitos byes, o
  // primeiro confronto de verdade de alguém pode ser na terceira rodada.
  return resolveByes(matches)
}

/**
 * Posição de cada cabeça de chave no quadro, para `size` vagas.
 *
 * A construção é por espelhamento: uma chave de 2 é [0,1]; a de 4 intercala cada
 * posição com o seu complemento, virando [0,3,1,2]; a de 8 repete o processo.
 * É o mesmo desenho que se vê em qualquer chave de torneio, com o 1 em cima e o
 * 2 embaixo.
 */
export function seedOrder(size: number): number[] {
  let ordem = [0, 1]
  while (ordem.length < size) {
    const total = ordem.length * 2
    const proxima: number[] = []
    for (const i of ordem) {
      proxima.push(i, total - 1 - i)
    }
    ordem = proxima
  }
  return ordem
}

/**
 * Faz passar quem não tem adversário.
 *
 * Roda em laço porque um bye pode criar outro: se dois confrontos vizinhos são
 * byes, o da rodada seguinte também fica com um lado só. Sem o laço, a chave
 * ficava com buracos que só sumiam quando alguém clicava.
 */
export function resolveByes(matches: Match[]): Match[] {
  const out = matches.map((m) => ({ ...m, slots: [...m.slots] as [number | null, number | null] }))
  let mudou = true
  while (mudou) {
    mudou = false
    for (const m of out) {
      if (m.winner !== null) continue
      const [a, b] = m.slots
      // Só é bye quando um lado tem gente e o outro está vazio **e** não há mais
      // ninguém para chegar nele — o que na primeira rodada é sempre verdade, e
      // nas seguintes depende de o confronto de origem já estar decidido.
      const vazioDefinitivo = (lado: 0 | 1) => m.round === 0 || origemDecidida(out, m, lado)
      if (a !== null && b === null && vazioDefinitivo(1)) {
        m.winner = 0
        mudou = true
      } else if (b !== null && a === null && vazioDefinitivo(0)) {
        m.winner = 1
        mudou = true
      }
      if (m.winner !== null) propagar(out, m)
    }
  }
  return out
}

/** O confronto que alimenta um lado já acabou (ou não existe). */
function origemDecidida(matches: Match[], m: Match, lado: 0 | 1): boolean {
  if (m.round === 0) return true
  const origem = matches.find((x) => x.round === m.round - 1 && x.order === m.order * 2 + lado)
  return !origem || origem.winner !== null
}

/** Leva o vencedor de `m` para a vaga dele na rodada seguinte. */
function propagar(matches: Match[], m: Match) {
  if (m.winner === null) return
  const proximo = matches.find((x) => x.round === m.round + 1 && x.order === Math.floor(m.order / 2))
  if (!proximo) return
  proximo.slots[m.order % 2] = m.slots[m.winner]
}

/**
 * Marca o vencedor de um confronto e refaz tudo que depende dele.
 *
 * Refazer é mais barato que corrigir: mudar de ideia sobre um confronto da
 * primeira rodada invalida um caminho inteiro, e apagar esse caminho à mão dá
 * mais chance de deixar rastro do que recalcular do zero as vagas seguintes.
 */
export function setWinner(matches: Match[], round: number, order: number, winner: 0 | 1 | null): Match[] {
  const out = matches.map((m) => ({ ...m, slots: [...m.slots] as [number | null, number | null] }))
  const alvo = out.find((m) => m.round === round && m.order === order)
  if (!alvo) return out
  alvo.winner = winner

  // Limpa tudo daqui para a frente e reconstrói.
  for (const m of out) if (m.round > round) m.slots = [null, null]
  for (const m of out) if (m.round > round) m.winner = null
  for (const m of out.filter((x) => x.round >= round).sort((a, b) => a.round - b.round)) propagar(out, m)

  return resolveByes(out)
}

/**
 * Põe alguém numa vaga, ou esvazia a vaga.
 *
 * Não passa por `resolveByes` nem propaga nada: é uma correção à mão, e a
 * cascata desfaria justamente o que a mão acabou de fazer. Some sozinha se um
 * resultado anterior for mudado depois — `setWinner` refaz o caminho todo dali
 * para a frente, e é assim que tem de ser.
 */
export function setSlot(
  matches: Match[],
  round: number,
  order: number,
  lado: 0 | 1,
  entry: number | null
): Match[] {
  return matches.map((m) => {
    if (m.round !== round || m.order !== order) return m
    const slots: [number | null, number | null] = [...m.slots]
    slots[lado] = entry
    // Tirar alguém tira também o resultado que dependia dele: um vencedor
    // apontando para uma vaga vazia é pior que confronto em aberto.
    const winner = entry === null && m.winner === lado ? null : m.winner
    return { ...m, slots, winner }
  })
}

/** Liga e desliga o cinza manual de um lado do confronto. */
export function toggleDim(matches: Match[], round: number, order: number, lado: 0 | 1): Match[] {
  return matches.map((m) => {
    if (m.round !== round || m.order !== order) return m
    const dim: [boolean, boolean] = [...(m.dim ?? [false, false])]
    dim[lado] = !dim[lado]
    return { ...m, dim }
  })
}

/** Soma no placar, sem deixar negativo. */
export function addScore(matches: Match[], round: number, order: number, lado: 0 | 1, delta: number): Match[] {
  return matches.map((m) => {
    if (m.round !== round || m.order !== order) return m
    const score: [number, number] = [...m.score]
    score[lado] = Math.max(0, score[lado] + delta)
    return { ...m, score }
  })
}

/**
 * Embaralha os participantes e refaz a chave.
 *
 * Sorteia com Fisher-Yates sobre uma cópia: sortear "trocando dois ao acaso N
 * vezes" não dá distribuição uniforme, e num sorteio de torneio isso importa.
 */
export function shuffle(t: Tournament): Tournament {
  const entries = [...t.entries]
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[entries[i], entries[j]] = [entries[j], entries[i]]
  }
  return { ...t, entries, matches: buildBracket(entries) }
}

/**
 * Troca duas pessoas de posição na chave.
 *
 * Refaz os confrontos: mexer na ordem muda quem encara quem, e manter placar de
 * um confronto que deixou de existir seria pior que perdê-lo.
 */
export function swap(t: Tournament, a: number, b: number): Tournament {
  const entries = [...t.entries]
  if (a < 0 || b < 0 || a >= entries.length || b >= entries.length) return t
  ;[entries[a], entries[b]] = [entries[b], entries[a]]
  return { ...t, entries, matches: buildBracket(entries) }
}

/** Nome de cada rodada, contando da final para trás. */
export function roundName(round: number, total: number): string {
  const faltam = total - round - 1
  if (faltam === 0) return 'Final'
  if (faltam === 1) return 'Semifinal'
  if (faltam === 2) return 'Quartas'
  if (faltam === 3) return 'Oitavas'
  return `Rodada ${round + 1}`
}

/** Quantas rodadas a chave tem. */
export function roundCount(matches: Match[]): number {
  return matches.length ? Math.max(...matches.map((m) => m.round)) + 1 : 0
}
