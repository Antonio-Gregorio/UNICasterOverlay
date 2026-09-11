import { teamOf } from '../teams'
import { addScore, buildBracket, setWinner } from './seed'
import { blankTowers } from './towers'
import type { MockPlayer } from '../topbar/mockPlayers'
import type { Character, Player, Team } from '../types'
import type { BracketMode, Entry, Person, Tournament } from './types'

/**
 * Resolve um participante em tudo que a vaga precisa desenhar.
 *
 * Fica fora das telas porque as duas precisam dele pelo mesmo motivo e em
 * momentos diferentes: o painel do overlay monta o `people` que viaja no
 * payload, e o editor de template monta o da prévia.
 */
export function resolvePerson(
  entry: Entry,
  players: Player[],
  teams: Team[],
  characters: Character[]
): Person {
  const pessoa = umaPessoa(entry.playerId, entry.name, players, teams, characters)
  // A dupla vai pendurada na primeira, e não como um segundo participante: ela
  // avança junta e ocupa uma vaga só — ver Entry.partner.
  const parceiro = entry.partner
    ? umaPessoa(entry.partner.playerId, entry.partner.name, players, teams, characters)
    : null
  return { ...pessoa, partner: parceiro }
}

function umaPessoa(
  playerId: string | null,
  nome: string,
  players: Player[],
  teams: Team[],
  characters: Character[]
): Person {
  const player = players.find((p) => p.id === playerId)
  if (!player) return { name: nome, teamTag: null, characterSlug: null, countryCode: null, color: null }
  const character = characters.find((c) => c.slug === player.characterSlug)
  return {
    name: player.name,
    teamTag: teamOf(player, teams)?.label ?? null,
    characterSlug: player.characterSlug,
    countryCode: player.countryCode,
    color: character?.colors?.[0]?.hex ?? null,
  }
}

/** O mesmo, para um player de exemplo — que não passa pelo cadastro. */
export function mockToPerson(mock: MockPlayer, characters: Character[], partner?: MockPlayer): Person {
  const character = characters.find((c) => c.slug === mock.characterSlug)
  return {
    name: mock.name,
    teamTag: mock.teamTag ?? null,
    characterSlug: mock.characterSlug,
    countryCode: mock.countryCode,
    color: character?.colors?.[0]?.hex ?? null,
    partner: partner ? mockToPerson(partner, characters) : null,
  }
}

/**
 * Um torneio já jogado pela metade, para a prévia do editor.
 *
 * O template não guarda ninguém — quem joga é decidido no painel do overlay —,
 * mas um editor de visual sem gente na tela não deixa ver nada: é preciso um
 * vencedor para conferir o selo, um perdedor para conferir o cinza e uma vaga
 * vazia para ver como a rodada seguinte fica.
 *
 * No modo de times não há chave: o que a prévia precisa mostrar são as duas
 * torres com gente de pé, gente apagada e placar.
 */
export function demoTournament(nomes: string[], mode: BracketMode = 'solo'): Tournament {
  const entries: Entry[] = nomes.map((name) => ({ playerId: null, name }))
  const base = {
    id: 'demo',
    name: 'Torneio de exemplo',
    entries,
    createdAt: new Date(0).toISOString(),
  }

  if (mode === 'times') {
    const towers = blankTowers()
    const metade = Math.ceil(entries.length / 2)
    towers.sides = [
      entries.slice(0, metade).map((_, i) => ({ entry: i, score: i === 0 ? 2 : 0, dim: i > 1 })),
      entries.slice(metade).map((_, i) => ({ entry: metade + i, score: i === 0 ? 1 : 0, dim: i > 2 })),
    ]
    return { ...base, matches: [], towers }
  }

  let matches = buildBracket(entries)
  if (matches.length) {
    matches = setWinner(matches, 0, 0, 0)
    matches = addScore(matches, 0, 0, 0, 2)
    matches = addScore(matches, 0, 0, 1, 1)
    matches = setWinner(matches, 0, 1, 1)
    matches = addScore(matches, 0, 1, 1, 2)
    matches = addScore(matches, 0, 1, 0, 1)
    matches = setWinner(matches, 0, 2, 0)
    matches = addScore(matches, 0, 2, 0, 2)
    matches = setWinner(matches, 1, 0, 0)
    matches = addScore(matches, 1, 0, 0, 3)
    matches = addScore(matches, 1, 0, 1, 2)
  }
  return { ...base, matches }
}
