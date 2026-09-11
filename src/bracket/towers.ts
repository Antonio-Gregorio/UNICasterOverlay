import type { Towers } from './types'

/**
 * O modo de times não tem confrontos: tem duas colunas de gente e um placar de
 * cada lado.
 *
 * As funções são todas puras e devolvem uma cópia, como as da chave — quem grava
 * é o store, e o painel só descreve o que mudou. `entry` é **índice na lista de
 * participantes**, pelo mesmo motivo de `slots` na chave: a pessoa pode ser
 * renomeada sem que a torre precise saber.
 */
export function blankTowers(): Towers {
  return { names: ['Time A', 'Time B'], sides: [[], []], touched: false }
}

/** Garante uma estrutura válida mesmo vinda de um torneio salvo antes dela. */
export function towersOf(towers: Towers | undefined): Towers {
  if (!towers) return blankTowers()
  return {
    names: towers.names ?? ['Time A', 'Time B'],
    sides: [towers.sides?.[0] ?? [], towers.sides?.[1] ?? []],
    // Torres gravadas antes deste campo existir já tinham escalação: são "mexidas".
    touched: towers.touched ?? (towers.sides?.[0]?.length ?? 0) + (towers.sides?.[1]?.length ?? 0) > 0,
  }
}

/**
 * Divide o elenco entre os dois lados, na ordem de inscrição.
 *
 * É o que a cena usa quando ninguém foi escalado à mão: o modo de times com um
 * torneio cheio e as torres vazias ia ao ar como dois cabeçalhos e mais nada —
 * "a chave sem os jogadores". Um palpite óbvio vale mais que um quadro vazio, e
 * escalar à mão continua sobrescrevendo isto.
 */
export function autoSides(total: number): Towers['sides'] {
  const metade = Math.ceil(total / 2)
  const slot = (entry: number) => ({ entry, score: 0, dim: false })
  return [
    Array.from({ length: metade }, (_, i) => slot(i)),
    Array.from({ length: Math.max(0, total - metade) }, (_, i) => slot(metade + i)),
  ]
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
  return !t.touched && t.sides[0].length === 0 && t.sides[1].length === 0
}

export function addToTower(towers: Towers, side: 0 | 1, entry: number): Towers {
  const sides = clone(towers.sides)
  // Sem repetir: a mesma pessoa nos dois lados de uma guerra não existe, e na
  // mesma torre duas vezes é sempre engano de clique.
  if (sides[0].some((s) => s.entry === entry) || sides[1].some((s) => s.entry === entry)) return towers
  sides[side] = [...sides[side], { entry, score: 0, dim: false }]
  return { ...towers, sides }
}

export function removeFromTower(towers: Towers, side: 0 | 1, index: number): Towers {
  const sides = clone(towers.sides)
  sides[side] = sides[side].filter((_, i) => i !== index)
  return { ...towers, sides }
}

export function scoreInTower(towers: Towers, side: 0 | 1, index: number, delta: number): Towers {
  const sides = clone(towers.sides)
  sides[side] = sides[side].map((s, i) => (i === index ? { ...s, score: Math.max(0, s.score + delta) } : s))
  return { ...towers, sides }
}

export function dimInTower(towers: Towers, side: 0 | 1, index: number): Towers {
  const sides = clone(towers.sides)
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
export function putInTower(towers: Towers, side: 0 | 1, index: number, entry: number): Towers {
  const sides = clone(towers.sides)
  if (sides[side][index]) {
    sides[side] = sides[side].map((s, i) => (i === index ? { ...s, entry } : s))
  } else {
    sides[side] = [...sides[side], { entry, score: 0, dim: false }]
  }
  return { ...towers, sides }
}

export function renameTeam(towers: Towers, side: 0 | 1, name: string): Towers {
  const names: [string, string] = [...towers.names]
  names[side] = name
  return { ...towers, names }
}

function clone(sides: Towers['sides']): Towers['sides'] {
  return [sides[0].map((s) => ({ ...s })), sides[1].map((s) => ({ ...s }))]
}
