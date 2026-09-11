import { useMemo, useState } from 'react'
import { Toolbar } from './Toolbar'
import { TeamForm } from './TeamForm'
import { TeamLogo } from '../TeamLogo'
import { BADGE_HEIGHT_LG } from '../Flag'
import { removeTeam, useTeams } from '../teams'
import { usePlayers } from '../players'
import type { Team, ViewMode } from '../types'

export function TeamsTab() {
  const teams = useTeams()
  const players = usePlayers()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('grid')
  const [editing, setEditing] = useState<Team | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return teams
    return teams.filter((t) => `${t.name} ${t.tag}`.toLowerCase().includes(term))
  }, [teams, query])

  /** Quantos players cada time tem, para avisar antes de remover. */
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of players) {
      if (p.teamId) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1)
    }
    return counts
  }, [players])

  return (
    <>
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome ou sigla..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${teams.length}`}
      >
        <button
          type="button"
          className="btn btn--primary btn--add"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          title="Adicionar time"
        >
          <span aria-hidden="true">+</span> Time
        </button>
      </Toolbar>

      {teams.length === 0 ? (
        <p className="empty">
          Nenhum time cadastrado. Use o botão <strong>+ Time</strong> — depois eles ficam
          disponíveis no cadastro de player.
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhum time com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--teams' : 'list'}>
          {filtered.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              players={usage.get(team.id) ?? 0}
              view={view}
              onEdit={() => {
                setEditing(team)
                setFormOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {formOpen && <TeamForm team={editing} onClose={() => setFormOpen(false)} />}
    </>
  )
}

function TeamCard({
  team,
  players,
  view,
  onEdit,
}: {
  team: Team
  players: number
  view: ViewMode
  onEdit: () => void
}) {
  function confirmRemove() {
    const warning = players
      ? `Remover ${team.name}? ${players} player(es) ficarão sem time.`
      : `Remover ${team.name}?`
    if (confirm(warning)) removeTeam(team.id)
  }

  // Mesma caixa 4:3 das bandeiras, só que ampliada: aqui a logo é o assunto do
  // cartão. O destaque de verdade fica para o formulário, onde ela é editada.
  const logo = (
    <TeamLogo
      logo={team.logo}
      label={team.tag || team.name}
      height={view === 'grid' ? BADGE_HEIGHT_LG * 1.5 : BADGE_HEIGHT_LG}
    />
  )

  const actions = (
    <div className="player__actions">
      <button type="button" className="icon-btn" onClick={onEdit} title="Editar">
        ✎
      </button>
      <button type="button" className="icon-btn icon-btn--danger" onClick={confirmRemove} title="Remover">
        ✕
      </button>
    </div>
  )

  if (view === 'list') {
    return (
      <article className="row row--team">
        {logo}
        <div className="row__main">
          <h3>{team.name}</h3>
          <p className="muted">
            {team.tag} · {players} player{players === 1 ? '' : 's'}
          </p>
        </div>
        {actions}
      </article>
    )
  }

  return (
    <article className="card card--team">
      {logo}
      <h3>{team.tag}</h3>
      <p className="muted">{team.name}</p>
      <p className="muted">
        {players} player{players === 1 ? '' : 's'}
      </p>
      {actions}
    </article>
  )
}
