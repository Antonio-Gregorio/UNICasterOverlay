import type { Towers } from './types'

/**
 * O modo de times não tem confrontos: tem uma coluna de gente por time, e um
 * placar em cada vaga.
 *
 * São de 2 a 6 times. Dois é a guerra de sempre; mais que isso é o evento de
 * equipes de várias casas — e seis colunas é o que ainda cabe numa tela 1080p
 * com nome legível (ver o encaixe em TowersView).
 *
 * As funções são todas puras e devolvem uma cópia, como as da chave — quem grava
 * é o store, e o painel só descreve o que mudou. `entry` é **índice na lista de
 * participantes**, pelo mesmo motivo de `slots` na chave: a pessoa pode ser
 * renomeada sem que a torre precise saber.
 */
export const MIN_TEAMS = 2
export const MAX_TEAMS = 6

/** "Time A", "Time B"... — o nome de partida do time na posição `i`. */
export const teamName = (i: number) => `Time ${String.fromCharCode(65 + i)}`

const clampCount = (n: number) => Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, Math.round(n) || MIN_TEAMS))

export function blankTowers(count = MIN_TEAMS): Towers {
  const n = clampCount(count)
  return {
    names: Array.from({ length: n }, (_, i) => teamName(i)),
    sides: Array.from({ length: n }, () => []),
    touched: false,
  }
}

/**
 * Garante uma estrutura válida mesmo vinda de um torneio salvo antes dela.
 *
 * Quantos times há é o maior entre nomes e colunas gravados — um torneio de
 * antes desta mudança tem os dois com dois, e continua exatamente como era.
 */
export function towersOf(towers: Towers | undefined): Towers {
  if (!towers) return blankTowers()
  const n = clampCount(Math.max(towers.names?.length ?? 0, towers.sides?.length ?? 0))
  const sides = Array.from({ length: n }, (_, i) => towers.sides?.[i] ?? [])
  return {
    names: Array.from({ length: n }, (_, i) => towers.names?.[i] ?? teamName(i)),
    sides,
    // Torres gravadas antes deste campo existir já tinham escalação: são "mexidas".
    touched: towers.touched ?? sides.some((s) => s.length > 0),
  }
}

/**
 * Divide o elenco entre os times, em blocos na ordem de inscrição.
 *
 * É o que a cena usa quando ninguém foi escalado à mão: o modo de times com um
 * torneio cheio e as torres vazias ia ao ar como cabeçalhos e mais nada — "a
 * chave sem os jogadores". Um palpite óbvio vale mais que um quadro vazio, e
 * escalar à mão continua sobrescrevendo isto.
 */
export function autoSides(total: number, count = MIN_TEAMS): Towers['sides'] {
  const n = clampCount(count)
  // Tamanhos equilibrados, com a sobra nos primeiros: 8 em 6 times dá
  // 2-2-1-1-1-1, e não 2-2-2-2-0-0 — time vazio em cena parece erro.
  const base = Math.floor(total / n)
  const sobra = total % n
  let inicio = 0
  return Array.from({ length: n }, (_, lado) => {
    const tamanho = base + (lado < sobra ? 1 : 0)
    const lista = Array.from({ length: tamanho }, (_, i) => ({ entry: inicio + i, score: 0, dim: false }))
    inicio += tamanho
    return lista
  })
}

/**
 * A cena deve dividir o elenco sozinha?
 *
 * Só enquanto ninguém tocou nas torres. Depois do primeiro gesto — inclusive o
 * de esvaziar — o que está lá é decisão de quem opera, e vazio é uma decisão
 * como outra qualquer.
 */
export function shouldAutoSplit(towers: Towers | undefined): boolean {
  const t = towersOf(towers)
  return !t.touched && t.sides.every((s) => s.length === 0)
}

/**
 * Muda quantos times há.
 *
 * Os que entram chegam vazios e com o nome de partida; os que saem são sempre
 * os últimos, e levam a escalação junto — a pessoa continua inscrita e volta
 * por um clique.
 */
export function setTeamCount(towers: Towers, count: number): Towers {
  const n = clampCount(count)
  return {
    ...towers,
    names: Array.from({ length: n }, (_, i) => towers.names[i] ?? teamName(i)),
    sides: Array.from({ length: n }, (_, i) => (towers.sides[i] ?? []).map((s) => ({ ...s }))),
  }
}

export function addToTower(towers: Towers, side: number, entry: number): Towers {
  // Sem repetir: a mesma pessoa em dois times de uma guerra não existe, e na
  // mesma torre duas vezes é sempre engano de clique.
  if (towers.sides.some((lista) => lista.some((s) => s.entry === entry))) return towers
  if (!towers.sides[side]) return towers
  const sides = clone(towers.sides)
  sides[side] = [...sides[side], { entry, score: 0, dim: false }]
  return { ...towers, sides }
}

export function removeFromTower(towers: Towers, side: number, index: number): Towers {
  const sides = clone(towers.sides)
  if (!sides[side]) return towers
  sides[side] = sides[side].filter((_, i) => i !== index)
  return { ...towers, sides }
}

export function scoreInTower(towers: Towers, side: number, index: number, delta: number): Towers {
  const sides = clone(towers.sides)
  if (!sides[side]) return towers
  sides[side] = sides[side].map((s, i) => (i === index ? { ...s, score: Math.max(0, s.score + delta) } : s))
  return { ...towers, sides }
}

/** Placar digitado: o valor inteiro, e não um passo a partir do atual. */
export function setScoreInTower(towers: Towers, side: number, index: number, score: number): Towers {
  const sides = clone(towers.sides)
  if (!sides[side]?.[index]) return towers
  sides[side] = sides[side].map((s, i) => (i === index ? { ...s, score: Math.max(0, score) } : s))
  return { ...towers, sides }
}

export function dimInTower(towers: Towers, side: number, index: number): Towers {
  const sides = clone(towers.sides)
  if (!sides[side]) return towers
  sides[side] = sides[side].map((s, i) => (i === index ? { ...s, dim: !s.dim } : s))
  return { ...towers, sides }
}

/**
 * Põe alguém numa posição da torre — é onde o arrasto da prévia termina.
 *
 * Cai em cima de quem estava na posição: arrastar para uma casa ocupada é trocar
 * quem está nela, e não empurrar a coluna inteira para baixo. O placar e o cinza
 * ficam com a casa, e não com a pessoa: a casa é o lugar na escalação, e quem
 * ocupa o terceiro lugar de um time herda o que já foi anotado nele.
 */
export function putInTower(towers: Towers, side: number, index: number, entry: number): Towers {
  const sides = clone(towers.sides)
  if (!sides[side]) return towers
  if (sides[side][index]) {
    sides[side] = sides[side].map((s, i) => (i === index ? { ...s, entry } : s))
  } else {
    sides[side] = [...sides[side], { entry, score: 0, dim: false }]
  }
  return { ...towers, sides }
}

/**
 * Sobe ou desce alguém dentro da própria torre.
 *
 * A casa inteira vai junto — placar e cinza incluídos —, ao contrário de
 * `putInTower`: aqui não se está trocando quem ocupa a vaga, e sim a ordem de
 * entrada de quem já foi escalado.
 */
export function moveInTower(towers: Towers, side: number, index: number, delta: -1 | 1): Towers {
  const alvo = index + delta
  const lista = towers.sides[side]
  if (!lista || alvo < 0 || alvo >= lista.length) return towers
  const sides = clone(towers.sides)
  ;[sides[side][index], sides[side][alvo]] = [sides[side][alvo], sides[side][index]]
  return { ...towers, sides }
}

export function renameTeam(towers: Towers, side: number, name: string): Towers {
  const names = [...towers.names]
  names[side] = name
  return { ...towers, names }
}

function clone(sides: Towers['sides']): Towers['sides'] {
  return sides.map((lista) => lista.map((s) => ({ ...s })))
}
