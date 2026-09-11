import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScreenHeader } from './ScreenHeader'
import { Toolbar } from '../components/Toolbar'
import { CopyIcon } from '../components/icons'
import { useBracketTemplates, useTournaments } from '../bracket/store'
import { useAnims } from '../anim/store'
import { useTopbars } from '../topbar/store'
import { duplicatePreset, removePreset, useOverlayPresets } from '../overlay/presets'
import { useObsConnection } from '../overlay/obs'
import type { ViewMode } from '../types'

/**
 * A lista de overlays.
 *
 * Um overlay é uma cena montada por inteiro — barras, logo, apresentação, chave
 * e a chave do OBS —, e num evento existem vários: o das oitavas, o da grand
 * finals, o do showmatch. Guardar cada um e trocar num clique é o que evita
 * remontar a tela entre um set e outro, que é onde o erro acontece.
 *
 * Trocar de overlay **não derruba a conexão**: ela vive fora do React (ver
 * `obsLink`), e por isso o ponto no cabeçalho continua aceso ao navegar por aqui.
 */
export function OverlayListScreen() {
  const presets = useOverlayPresets()
  const topbars = useTopbars()
  const anims = useAnims()
  const bracketTemplates = useBracketTemplates()
  const tournaments = useTournaments()
  const conn = useObsConnection()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [view, setView] = useState<ViewMode>('list')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? presets.filter((p) => p.name.toLowerCase().includes(term)) : presets
  }, [presets, query])

  const conectado = conn.estado === 'conectado'

  return (
    <>
      <ScreenHeader title="Overlay" subtitle="Cenas prontas para a fonte de navegador do OBS.">
        <p className="overlay-status">
          <span className={`overlay-dot${conectado ? ' is-on' : ''}`} aria-hidden="true" />
          {conectado ? 'no ar' : (conn.detalhe ?? 'desconectado')}
        </p>
        <Link className="btn btn--primary" to="/overlay/novo">
          + Overlay
        </Link>
      </ScreenHeader>

      <Toolbar
        query={query}
        onQuery={setQuery}
        placeholder="Filtrar por nome..."
        view={view}
        onView={setView}
        count={`${filtered.length} de ${presets.length}`}
      />

      {presets.length === 0 ? (
        <p className="empty">
          Nenhum overlay salvo. Use <strong>+ Overlay</strong> para montar a primeira cena.
        </p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nenhum overlay com "{query}".</p>
      ) : (
        <div className={view === 'grid' ? 'grid grid--overlays' : 'list'}>
          {filtered.map((preset) => {
            const partes = [
              topbars.find((t) => t.id === preset.templateId)?.name,
              anims.find((a) => a.id === preset.animId)?.name,
              bracketTemplates.find((b) => b.id === preset.bracketTemplateId)?.name,
              tournaments.find((t) => t.id === preset.tournamentId)?.name,
            ].filter(Boolean)

            return (
              <article key={preset.id} className="overlay-card">
                <header>
                  <h3>{preset.name}</h3>
                  <div className="player__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Abrir"
                      onClick={() => navigate(`/overlay/${preset.id}`)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Duplicar"
                      aria-label={`Duplicar ${preset.name}`}
                      onClick={() => duplicatePreset(preset.id)}
                    >
                      <CopyIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title="Remover"
                      onClick={() => {
                        if (confirm(`Remover ${preset.name}?`)) removePreset(preset.id)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </header>
                <p className="muted">
                  {partes.length ? partes.join(' · ') : 'Cena vazia'}
                </p>
                <p className="muted">
                  OBS em {preset.obs.host}:{preset.obs.port}
                  {preset.obs.password ? ' · com senha' : ''}
                </p>
                <button
                  type="button"
                  className="btn btn--small btn--primary"
                  onClick={() => navigate(`/overlay/${preset.id}`)}
                >
                  Abrir painel
                </button>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
