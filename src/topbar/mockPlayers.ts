import { useState } from 'react'
import { assetUrl } from '../assetUrl'
import type { TopbarData } from './types'

/**
 * Players de exemplo para as miniaturas.
 *
 * As barras e os gráficos precisam de nome, personagem e bandeira para dizerem
 * alguma coisa — uma peça vazia não deixa comparar dois modelos. Estes não
 * entram no cadastro de players: vivem em public/mock-players.json, editável à
 * mão.
 */
export interface MockPlayer {
  name: string
  characterSlug: string
  countryCode: string
  regionCode?: string
  teamTag?: string
}

let cache: Promise<MockPlayer[]> | null = null

export function loadMockPlayers(): Promise<MockPlayer[]> {
  cache ??= fetch(assetUrl('/mock-players.json'))
    .then((res) => (res.ok ? res.json() : { players: [] }))
    .then((json: { players?: MockPlayer[] }) => json.players ?? [])
    .catch(() => [])
  return cache
}

/** PRNG com semente: o mesmo template sorteia sempre os mesmos jogadores. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Sorteia `count` jogadores distintos para um template.
 *
 * Embaralha em vez de fatiar a lista em ordem: assim dois templates seguidos
 * não mostram a mesma dupla, e ninguém aparece duas vezes na mesma peça. A
 * semente vem do id do template, então a escolha não muda a cada render.
 */
export function sampleMocks(mocks: MockPlayer[], count: number, seed: string): MockPlayer[] {
  if (mocks.length === 0) return []
  const rand = mulberry32(seedFrom(seed))
  const pool = [...mocks]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  // Se pedirem mais do que existe, repete o baralho em vez de devolver menos.
  const out: MockPlayer[] = []
  while (out.length < count) out.push(...pool.slice(0, Math.min(count - out.length, pool.length)))
  return out
}

/** Converte um player de exemplo nos dados que a topbar espera. */
export function mockToTopbarData(mock: MockPlayer, score: number): TopbarData {
  return {
    name: mock.name,
    teamTag: mock.teamTag ?? null,
    teamLogo: null,
    characterSlug: mock.characterSlug,
    countryCode: mock.countryCode,
    regionCode: mock.regionCode ?? null,
    score,
  }
}

/**
 * Semente de sorteio que nasce diferente a cada visita e muda quando o usuário
 * pede outra rodada.
 *
 * Antes a semente vinha do id do template: estável demais — abrir a tela dez
 * vezes mostrava sempre os mesmos jogadores.
 */
export function useShuffleSeed(): [string, () => void] {
  const [seed, setSeed] = useState(newSeed)
  return [seed, () => setSeed(newSeed())]
}

const newSeed = () => Math.random().toString(36).slice(2)
