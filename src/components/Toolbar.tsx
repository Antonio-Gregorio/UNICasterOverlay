import type { ViewMode } from '../types'

/** Barra de filtro + alternador de visualização, comum às duas abas. */
export function Toolbar({
  query,
  onQuery,
  placeholder,
  view,
  onView,
  count,
  children,
}: {
  query: string
  onQuery: (value: string) => void
  placeholder: string
  view: ViewMode
  onView: (value: ViewMode) => void
  count: string
  children?: React.ReactNode
}) {
  return (
    <div className="toolbar">
      <input
        type="search"
        className="search"
        value={query}
        placeholder={placeholder}
        onChange={(e) => onQuery(e.target.value)}
      />
      <span className="count">{count}</span>
      {children}
      <div className="view-toggle" role="group" aria-label="Visualização">
        <button
          type="button"
          className={view === 'grid' ? 'active' : ''}
          onClick={() => onView('grid')}
          aria-pressed={view === 'grid'}
          title="Grade"
        >
          <GridIcon />
        </button>
        <button
          type="button"
          className={view === 'list' ? 'active' : ''}
          onClick={() => onView('list')}
          aria-pressed={view === 'list'}
          title="Lista"
        >
          <ListIcon />
        </button>
      </div>
    </div>
  )
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="0" y="0" width="6" height="6" rx="1" />
      <rect x="8" y="0" width="6" height="6" rx="1" />
      <rect x="0" y="8" width="6" height="6" rx="1" />
      <rect x="8" y="8" width="6" height="6" rx="1" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="0" y="1" width="14" height="2.4" rx="1.2" />
      <rect x="0" y="5.8" width="14" height="2.4" rx="1.2" />
      <rect x="0" y="10.6" width="14" height="2.4" rx="1.2" />
    </svg>
  )
}
