import { useMemo, useState } from 'react'
import { Toolbar } from './Toolbar'
import { LogoForm } from './LogoForm'
import { removeEvent, useEvents } from '../events'
import type { EventLogo, ViewMode } from '../types'

export function LogosTab() {
  const events = useEvents()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('grid')
  const [editing, setEditing] = useState<EventLogo | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return events
    return events.filter((e) => e.name.toLowerCase().includes(term))
  }, [events, query])

  function open(event: EventLogo | null) {
    setEditing(event)
    setFormOpen(true)
  }

  return (
    <>
      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${events.length}`}
      >
        <button type="button" className="btn btn--primary btn--add" onClick={() => open(null)}>
          <span aria-hidden="true">+</span> Logo
        </button>
      </Toolbar>

      {events.length === 0 ? (
        <p className="empty">
          Nenhuma logo cadastrada. Use o botão <strong>+ Logo</strong> para subir a do seu evento.
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhuma logo com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--logos' : 'list'}>
          {filtered.map((event) => (
            <LogoCard key={event.id} event={event} view={view} onEdit={() => open(event)} />
          ))}
        </div>
      )}

      {formOpen && <LogoForm event={editing} onClose={() => setFormOpen(false)} />}
    </>
  )
}

function LogoCard({
  event,
  view,
  onEdit,
}: {
  event: EventLogo
  view: ViewMode
  onEdit: () => void
}) {
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
          if (confirm(`Remover ${event.name}?`)) removeEvent(event.id)
        }}
      >
        ✕
      </button>
    </div>
  )

  if (view === 'list') {
    return (
      <article className="row row--logo">
        <div className="logo-thumb logo-thumb--small">
          <img src={event.image} alt="" />
        </div>
        <div className="row__main">
          <h3>{event.name}</h3>
          <p className="muted">
            {event.width}×{event.height}px
          </p>
        </div>
        {actions}
      </article>
    )
  }

  return (
    <article className="card card--logo">
      <div className="logo-thumb">
        <img src={event.image} alt={event.name} />
      </div>
      <h3>{event.name}</h3>
      <p className="muted">
        {event.width}×{event.height}px
      </p>
      {actions}
    </article>
  )
}
