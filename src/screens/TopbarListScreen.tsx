import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScreenHeader } from './ScreenHeader'
import { Toolbar } from '../components/Toolbar'
import { CopyIcon, DiceIcon } from '../components/icons'
import { TopbarPreview } from '../topbar/TopbarPreview'
import { duplicateTopbar, removeTopbar, useTopbars } from '../topbar/store'
import { mockToTopbarData, sampleMocks, useShuffleSeed } from '../topbar/mockPlayers'
import { useData } from '../data'
import type { ViewMode } from '../types'

export function TopbarListScreen() {
  const { characters, flags, mocks } = useData()
  const templates = useTopbars()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('list')
  const [seed, reshuffle] = useShuffleSeed()

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? templates.filter((t) => t.name.toLowerCase().includes(term)) : templates
  }, [templates, query])

  // Cada barra fica menor no grid, mas o par continua inteiro: ver só um lado
  // esconde justamente o que o espelhamento faz.
  const barWidth = view === 'grid' ? 300 : 520

  return (
    <>
      <ScreenHeader title="Topbar" subtitle="Templates da barra que fica na tela durante a stream.">
        <Link className="btn btn--primary" to="/topbar/novo">
          + Topbar
        </Link>
      </ScreenHeader>

      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${templates.length}`}
      >
        <button type="button" className="btn btn--small" onClick={reshuffle} title="Sortear outros">
          <DiceIcon /> Sortear
        </button>
      </Toolbar>

      {templates.length === 0 ? (
        <p className="empty">
          Nenhum template ainda. Use <strong>+ Topbar</strong> para montar o primeiro.
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhum template com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--topbars' : 'list'}>
          {filtered.map((template) => {
            // Sorteia dois jogadores distintos, com semente presa ao template:
            // a escolha não muda a cada render, e dois templates seguidos não
            // mostram a mesma dupla.
            const pair = sampleMocks(mocks, 2, template.id + seed)
            return (
              <article key={template.id} className="topbar-card">
                <header>
                  <h3>{template.name}</h3>
                  <div className="player__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Editar"
                      onClick={() => navigate(`/topbar/${template.id}`)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Duplicar"
                      aria-label={`Duplicar ${template.name}`}
                      onClick={() => duplicateTopbar(template.id)}
                    >
                      <CopyIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title="Remover"
                      onClick={() => {
                        if (confirm(`Remover ${template.name}?`)) removeTopbar(template.id)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </header>
                <div className="topbar-card__stage">
                  {pair.length === 2 ? (
                    <div className="topbar-pair">
                      <TopbarPreview
                        template={template}
                        data={mockToTopbarData(pair[0], 2)}
                        characters={characters}
                        flags={flags}
                        width={barWidth}
                      />
                      <TopbarPreview
                        template={template}
                        data={mockToTopbarData(pair[1], 1)}
                        characters={characters}
                        flags={flags}
                        width={barWidth}
                        mirrored
                      />
                    </div>
                  ) : (
                    <p className="muted">Sem players de exemplo.</p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
