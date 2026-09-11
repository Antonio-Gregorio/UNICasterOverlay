import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScreenHeader } from './ScreenHeader'
import { Toolbar } from '../components/Toolbar'
import { CopyIcon } from '../components/icons'
import { ANIM_STYLES, duplicateAnim, removeAnim, useAnims } from '../anim/store'
import type { ViewMode } from '../types'

/**
 * A lista de apresentações.
 *
 * O cartão não toca a animação: cinco cenas rodando em laço na mesma tela é uma
 * competição por atenção onde nenhuma se vê direito — e, com fundo, cinco
 * imagens grandes desenhando ao mesmo tempo. O que ele mostra é o que basta para
 * escolher: a coreografia, as cores e o tempo. Ver mesmo é no editor, onde ela
 * ocupa a tela e toca a cada ajuste.
 */
export function AnimListScreen() {
  const anims = useAnims()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('grid')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? anims.filter((a) => a.name.toLowerCase().includes(term)) : anims
  }, [anims, query])

  return (
    <>
      <ScreenHeader title="Animações" subtitle="Apresentação dos dois jogadores, para rodar no overlay.">
        <Link className="btn btn--primary" to="/animacoes/novo">
          + Animação
        </Link>
      </ScreenHeader>

      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${anims.length}`}
      />

      {anims.length === 0 ? (
        <p className="empty">
          Nenhuma animação. Use <strong>+ Animação</strong> para começar uma.
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhuma animação com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--anims' : 'list'}>
          {filtered.map((anim) => {
            const estilo = ANIM_STYLES.find((s) => s.value === anim.style)
            const fundo =
              anim.background.type === 'gradient'
                ? `linear-gradient(${anim.background.gradient.angle}deg, ${anim.background.gradient.stops.join(', ')})`
                : anim.background.type === 'solid'
                  ? anim.background.color
                  : 'repeating-linear-gradient(45deg, #17171f 0 10px, #1d1d27 10px 20px)'
            return (
              <article key={anim.id} className="anim-card">
                <header>
                  <h3>{anim.name}</h3>
                  <div className="player__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Editar"
                      onClick={() => navigate(`/animacoes/${anim.id}`)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Duplicar"
                      aria-label={`Duplicar ${anim.name}`}
                      onClick={() => duplicateAnim(anim.id)}
                    >
                      <CopyIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title="Remover"
                      onClick={() => {
                        if (confirm(`Remover ${anim.name}?`)) removeAnim(anim.id)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </header>
                <button
                  type="button"
                  className="anim-card__stage"
                  style={{ background: fundo }}
                  onClick={() => navigate(`/animacoes/${anim.id}`)}
                  title={`Abrir ${anim.name}`}
                >
                  <span className="anim-card__accent" style={{ background: anim.accentColor }} />
                  <strong>{estilo?.label ?? anim.style}</strong>
                  <span>{(anim.duration / 1000).toFixed(1)}s</span>
                </button>
                <p className="muted">{estilo?.hint}</p>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
