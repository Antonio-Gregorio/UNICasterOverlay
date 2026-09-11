import { useMemo, useState } from 'react'
import { Toolbar } from './Toolbar'
import { PlayerForm } from './PlayerForm'
import { Flag } from '../Flag'
import { TeamLogo } from '../TeamLogo'
import { FaceCrop } from '../FaceCrop'
import { countryFlag, regionFlag } from '../flags'
import { addPlayers, removePlayer, usePlayers } from '../players'
import { teamOf, useTeams } from '../teams'
import type { MockPlayer } from '../topbar/mockPlayers'
import type { Character, FlagManifest, Player, Team, ViewMode } from '../types'

export function PlayersTab({
  characters,
  flags,
  mocks,
}: {
  characters: Character[]
  flags: FlagManifest
  mocks: MockPlayer[]
}) {
  const players = usePlayers()
  const teams = useTeams()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('grid')
  const [editing, setEditing] = useState<Player | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const bySlug = useMemo(() => new Map(characters.map((c) => [c.slug, c])), [characters])

  /**
   * Os players de exemplo que ainda não estão no cadastro.
   *
   * O filtro é por nome, e não por um id de importação: os exemplos vivem num
   * JSON editável à mão (public/mock-players.json) e, uma vez cadastrados, viram
   * players como os outros — dá para renomear, trocar de personagem e apagar.
   * Guardar procedência criaria uma segunda classe de player para manter viva o
   * resto do sistema todo.
   */
  const novosMocks = useMemo(() => {
    const jaTem = new Set(players.map((p) => p.name.trim().toLowerCase()))
    return mocks.filter((m) => !jaTem.has(m.name.trim().toLowerCase()))
  }, [mocks, players])

  function importarMocks() {
    addPlayers(
      novosMocks.map((m) => ({
        name: m.name,
        characterSlug: m.characterSlug,
        teamId: null,
        team: m.teamTag ?? null,
        // O JSON de exemplo é brasileiro de ponta a ponta; o `?? 'BR'` é para
        // quem for editá-lo à mão e esquecer o campo.
        countryCode: m.countryCode ?? 'BR',
        regionCode: m.regionCode ?? null,
      }))
    )
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return players
    // Um campo de busca só, casando nome, time ou personagem — digitar "wagner"
    // ou "ZETA" no meio de um torneio tem de achar, sem escolher a coluna antes.
    return players.filter((p) =>
      [p.name, teamOf(p, teams)?.label ?? '', bySlug.get(p.characterSlug)?.name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    )
  }, [players, query, bySlug, teams])

  return (
    <>
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome, time ou personagem..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${players.length}`}
      >
        <button
          type="button"
          className="btn btn--primary btn--add"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          title="Adicionar player"
        >
          <span aria-hidden="true">+</span> Player
        </button>
        <button
          type="button"
          className="btn btn--add"
          disabled={novosMocks.length === 0}
          onClick={importarMocks}
          title={
            novosMocks.length === 0
              ? 'Todos os players de exemplo já estão no cadastro'
              : `Cadastrar os ${novosMocks.length} players de exemplo`
          }
        >
          <span aria-hidden="true">+</span> Exemplos
          {novosMocks.length > 0 && <span className="count">{novosMocks.length}</span>}
        </button>
      </Toolbar>

      {players.length === 0 ? (
        <p className="empty">
          Nenhum player cadastrado ainda. Use <strong>+ Player</strong> para cadastrar um a
          um, ou <strong>+ Exemplos</strong> para trazer de uma vez os {mocks.length} do
          arquivo de exemplo.
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhum player com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--players' : 'list'}>
          {filtered.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              character={bySlug.get(player.characterSlug)}
              teams={teams}
              flags={flags}
              view={view}
              onEdit={() => {
                setEditing(player)
                setFormOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <PlayerForm characters={characters} flags={flags} player={editing} onClose={() => setFormOpen(false)} />
      )}
    </>
  )
}

function PlayerCard({
  player,
  character,
  teams,
  flags,
  view,
  onEdit,
}: {
  player: Player
  character: Character | undefined
  teams: Team[]
  flags: FlagManifest
  view: ViewMode
  onEdit: () => void
}) {
  const country = countryFlag(flags, player.countryCode)
  const region = regionFlag(flags, player.regionCode)
  const team = teamOf(player, teams)
  const [primary, secondary] = character?.colors ?? []

  const style = {
    ['--primary' as string]: primary?.hex ?? '#888',
    ['--secondary' as string]: secondary?.hex ?? '#666',
  } as React.CSSProperties

  // A logo do time fica junto das bandeiras, no mesmo tamanho: é a mesma
  // informação de "de onde vem esse player".
  const badges = (
    <div className="player__flags">
      {team?.logo && <TeamLogo logo={team.logo} label={team.label} />}
      {country && <Flag spec={country} />}
      {region && <Flag spec={region} />}
    </div>
  )

  const heading = (
    <h3>
      {team && <span className="team">{team.label}</span>}
      {player.name}
    </h3>
  )

  const actions = (
    <div className="player__actions">
      <button type="button" className="icon-btn" onClick={onEdit} title="Editar">
        ✎
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--danger"
        title="Remover"
        onClick={() => {
          if (confirm(`Remover ${player.name}?`)) removePlayer(player.id)
        }}
      >
        ✕
      </button>
    </div>
  )

  if (view === 'list') {
    return (
      <article className="row row--player" style={style}>
        {character && <FaceCrop character={character} />}
        <div className="row__main">
          {heading}
          <p className="muted">{character?.name ?? player.characterSlug}</p>
        </div>
        {badges}
        {actions}
      </article>
    )
  }

  return (
    <article className="card card--player" style={style}>
      {character?.assets.art && <img src={character.assets.art} alt="" loading="lazy" />}
      {heading}
      <p className="muted">{character?.name ?? player.characterSlug}</p>
      {badges}
      {actions}
    </article>
  )
}
