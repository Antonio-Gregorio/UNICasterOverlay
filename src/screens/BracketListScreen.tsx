import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScreenHeader } from './ScreenHeader'
import { Toolbar } from '../components/Toolbar'
import { CopyIcon, DiceIcon } from '../components/icons'
import { useData } from '../data'
import { BracketView } from '../bracket/BracketView'
import { demoTournament, mockToPerson } from '../bracket/people'
import { duplicateTemplate, removeTemplate, useBracketTemplates } from '../bracket/store'
import { sampleMocks, useShuffleSeed } from '../topbar/mockPlayers'
import { SCENE } from '../overlay/channel'
import type { BracketPlay } from '../bracket/types'
import type { ViewMode } from '../types'

/** Nome de cada modo na etiqueta do cartão. */
const MODES: Record<string, string> = {
  solo: 'Confronto',
  duo: 'Duplas',
  times: 'Times',
}

/** Quantos entram na chave do cartão. Oito dão três rodadas e ainda cabem. */
const DEMO_SIZE = 8

/**
 * A lista de estilos de chave.
 *
 * Separada do editor pelo mesmo motivo da topbar e do gráfico: com meia dúzia de
 * estilos, achar um vira o trabalho, e um seletor dentro do editor esconde
 * justamente a diferença entre eles — que é visual. Aqui cada um aparece
 * desenhado, com gente de exemplo dentro.
 */
export function BracketListScreen() {
  const { characters, mocks } = useData()
  const templates = useBracketTemplates()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('grid')
  const [seed, reshuffle] = useShuffleSeed()

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? templates.filter((t) => t.name.toLowerCase().includes(term)) : templates
  }, [templates, query])

  /* Dois por participante: em duplas o segundo é o parceiro, e nos outros sobra. */
  const elenco = useMemo(() => sampleMocks(mocks, DEMO_SIZE * 2, seed), [mocks, seed])

  return (
    <>
      <ScreenHeader title="Chaves" subtitle="Estilos da tela de chave que vai ao ar.">
        <button type="button" className="btn btn--small" onClick={reshuffle} title="Sortear outros">
          <DiceIcon /> Sortear
        </button>
        <Link className="btn btn--primary" to="/chaves/novo">
          + Chave
        </Link>
      </ScreenHeader>

      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${templates.length}`}
      />

      {templates.length === 0 ? (
        <p className="empty">
          Nenhum estilo ainda. Use <strong>+ Chave</strong> para montar o primeiro.
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhum estilo com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--brackets' : 'list'}>
          {filtered.map((template) => {
            const titulares = elenco.filter((_, i) => i % 2 === 0)
            const parceiros = elenco.filter((_, i) => i % 2 === 1)
            const play =
              titulares.length === DEMO_SIZE
                ? {
                    template,
                    tournament: demoTournament(
                      titulares.map((m) => m.name),
                      template.mode
                    ),
                    people: titulares.map((m, i) =>
                      mockToPerson(m, characters, template.mode === 'duo' ? parceiros[i] : undefined)
                    ),
                  }
                : null

            return (
              <article key={template.id} className="topbar-card">
                <header>
                  <h3>
                    {template.name} <span className="count">{MODES[template.mode] ?? template.mode}</span>
                  </h3>
                  <div className="player__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Editar"
                      onClick={() => navigate(`/chaves/${template.id}`)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Duplicar"
                      aria-label={`Duplicar ${template.name}`}
                      onClick={() => duplicateTemplate(template.id)}
                    >
                      <CopyIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title="Remover"
                      onClick={() => {
                        if (confirm(`Remover ${template.name}?`)) removeTemplate(template.id)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </header>
                {play ? (
                  <BracketThumb play={play} />
                ) : (
                  <p className="muted">Sem players de exemplo.</p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

/**
 * A cena reduzida ao tamanho que o cartão tem.
 *
 * A escala sai da largura **medida**, e não de um número escolhido: a coluna do
 * grid muda de largura com a tela, e com a escala fixa a caixa sobrava dos dois
 * lados do desenho — um quadro de 16:9 dentro de outro maior, que era o que
 * parecia errado à primeira vista.
 */
function BracketThumb({ play }: { play: BracketPlay }) {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setLargura(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="bracket-card__stage" ref={ref}>
      {largura > 0 && <BracketView play={play} scale={largura / SCENE.width} />}
    </div>
  )
}
