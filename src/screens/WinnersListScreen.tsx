import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScreenHeader } from './ScreenHeader'
import { Toolbar } from '../components/Toolbar'
import { CopyIcon, DiceIcon } from '../components/icons'
import { competitorsFromMocks } from '../components/WinnersEditor'
import { WinnersPreview } from '../winners/WinnersPreview'
import { LAYOUTS } from '../winners/layouts'
import { duplicateWinners, removeWinners, useWinners } from '../winners/store'
import { emptyContent, type GraphicLayout } from '../winners/types'
import { useShuffleSeed } from '../topbar/mockPlayers'
import { useData } from '../data'
import type { ViewMode } from '../types'

export function WinnersListScreen() {
  const { characters, flags, backgrounds, mocks } = useData()
  const templates = useWinners()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('grid')
  const [seed, reshuffle] = useShuffleSeed()

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return templates
    return templates.filter((t) => `${t.name} ${LAYOUTS[t.layout].label}`.toLowerCase().includes(term))
  }, [templates, query])

  return (
    <>
      <ScreenHeader title="Winners" subtitle="Gráficos de resultado: top 8, duplas, pódio e times.">
        <Link className="btn btn--primary" to="/winners/novo">
          + Gráfico
        </Link>
      </ScreenHeader>

      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome ou modelo..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${templates.length}`}
      >
        <button type="button" className="btn btn--small" onClick={reshuffle} title="Sortear outros">
          <DiceIcon /> Sortear
        </button>
      </Toolbar>

      {/* Os arranjos prontos são atalhos de criação: já abrem o editor montado. */}
      <div className="preset-row">
        <span className="muted">Começar de um modelo:</span>
        {(Object.keys(LAYOUTS) as GraphicLayout[]).map((key) => (
          <Link key={key} className="btn btn--small" to={`/winners/novo?modelo=${key}`}>
            {LAYOUTS[key].label}
          </Link>
        ))}
      </div>

      {templates.length === 0 ? (
        <p className="empty">
          Nenhum gráfico ainda. Escolha um modelo acima para começar com o arranjo pronto.
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhum gráfico com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--winners' : 'list'}>
          {filtered.map((template) => (
            <article key={template.id} className="topbar-card">
              <header>
                <h3>{template.name}</h3>
                <span className="muted">{LAYOUTS[template.layout].label}</span>
                <div className="player__actions">
                  <Link className="btn btn--small" to={`/winners/${template.id}/gerar`}>
                    Gerar imagem
                  </Link>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Editar"
                    onClick={() => navigate(`/winners/${template.id}`)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Duplicar"
                    aria-label={`Duplicar ${template.name}`}
                    onClick={() => duplicateWinners(template.id)}
                  >
                    <CopyIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    title="Remover"
                    onClick={() => {
                      if (confirm(`Remover ${template.name}?`)) removeWinners(template.id)
                    }}
                  >
                    ✕
                  </button>
                </div>
              </header>
              <div className="winners-card__stage">
                <WinnersPreview
                  template={template}
                  content={{
                    ...emptyContent(),
                    eventName: 'Nome do evento',
                    // Sorteado com semente presa ao template: ninguém repete
                    // dentro da peça, e dois cartões vizinhos mostram gente
                    // diferente.
                    competitors: competitorsFromMocks(
                      mocks,
                      template.slotCount,
                      template.layout === 'top8-duo',
                      template.id + seed
                    ),
                  }}
                  characters={characters}
                  flags={flags}
                  eventLogo={null}
                  backgroundUrl={
                    backgrounds.find((b) => b.id === template.background.presetId)?.url ?? null
                  }
                  width={view === 'grid' ? 460 : 720}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
