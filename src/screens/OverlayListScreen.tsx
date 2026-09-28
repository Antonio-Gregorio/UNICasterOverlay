import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScreenHeader } from './ScreenHeader'
import { Toolbar } from '../components/Toolbar'
import { CopyIcon } from '../components/icons'
import { TransferButtons } from '../components/TransferButtons'
import {
  importTemplates,
  importTournaments,
  useBracketTemplates,
  useTournaments,
} from '../bracket/store'
import { importAnims, useAnims } from '../anim/store'
import { importTopbars, useTopbars } from '../topbar/store'
import { importEvents, useEvents } from '../events'
import { importPlayers, usePlayers } from '../players'
import { importTeams, useTeams } from '../teams'
import {
  duplicatePreset,
  exportablePreset,
  importPresets,
  removePreset,
  useOverlayPresets,
  type OverlayPreset,
} from '../overlay/presets'
import { obsLink, useObsConnection } from '../overlay/obs'
import type { AnimTemplate } from '../anim/types'
import type { BracketTemplate, Tournament } from '../bracket/types'
import type { TopbarTemplate } from '../topbar/types'
import type { EventLogo, Player, Team, ViewMode } from '../types'

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
  const events = useEvents()
  const players = usePlayers()
  const teams = useTeams()
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
      >
        {/* O overlay vai com tudo que ele usa — topbar, animação, chave, logo,
            torneio e quem joga —, para abrir pronto na outra máquina. */}
        <TransferButtons
          kind="overlays"
          items={presets}
          prepare={exportablePreset}
          related={(escolhidos) => dependenciasDe(escolhidos, {
            topbars,
            anims,
            brackets: bracketTemplates,
            tournaments,
            events,
            players,
            teams,
          })}
          onImport={(items, related) => {
            // As dependências antes: quando o overlay chega, o que ele aponta
            // já está no lugar.
            importTopbars(soItens(related.topbars) as TopbarTemplate[])
            importAnims(soItens(related.anims) as AnimTemplate[])
            importTemplates(soItens(related.brackets) as BracketTemplate[])
            importTournaments(soItens(related.tournaments) as Tournament[])
            importEvents(soItens(related.events) as EventLogo[])
            importTeams(soItens(related.teams) as Team[])
            importPlayers(soItens(related.players) as Player[])
            return importPresets(items)
          }}
        />
      </Toolbar>

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
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn--small btn--primary"
                    onClick={() => navigate(`/overlay/${preset.id}`)}
                  >
                    Abrir painel
                  </button>
                  {/* Conecta com o acesso deste overlay e já abre o painel dele. */}
                  {!conectado && (
                    <button
                      type="button"
                      className="btn btn--small"
                      disabled={conn.estado === 'conectando'}
                      onClick={() => {
                        obsLink().connect(preset.obs.host, preset.obs.port, preset.obs.password)
                        navigate(`/overlay/${preset.id}`)
                      }}
                    >
                      Conectar e abrir
                    </button>
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

/**
 * Tudo que os overlays escolhidos usam, pelo id guardado no preset.
 *
 * O preset guarda ids, e não os objetos — ver presets.ts. Sozinho, ele chegaria
 * na outra máquina apontando para topbars e torneios que lá não existem.
 */
function dependenciasDe(
  escolhidos: OverlayPreset[],
  todos: {
    topbars: TopbarTemplate[]
    anims: AnimTemplate[]
    brackets: BracketTemplate[]
    tournaments: Tournament[]
    events: EventLogo[]
    players: Player[]
    teams: Team[]
  }
): Record<string, unknown[]> {
  const ids = (fn: (p: OverlayPreset) => (string | null | undefined)[]) =>
    new Set(escolhidos.flatMap(fn).filter(Boolean) as string[])

  const tournaments = todos.tournaments.filter((t) => ids((p) => [p.tournamentId]).has(t.id))
  // Quem joga: os dois lados da barra e todo mundo inscrito nos torneios.
  const playerIds = new Set([
    ...ids((p) => p.sides.map((s) => s.playerId)),
    ...tournaments.flatMap((t) => t.entries.flatMap((e) => [e.playerId, e.partner?.playerId])),
  ])
  const players = todos.players.filter((p) => playerIds.has(p.id))

  return {
    topbars: todos.topbars.filter((t) => ids((p) => [p.templateId]).has(t.id)),
    anims: todos.anims.filter((a) => ids((p) => [p.animId]).has(a.id)),
    brackets: todos.brackets.filter((b) => ids((p) => [p.bracketTemplateId]).has(b.id)),
    tournaments,
    events: todos.events.filter((e) => ids((p) => [p.logo.eventId]).has(e.id)),
    players,
    teams: todos.teams.filter((t) => players.some((p) => p.teamId === t.id)),
  }
}

/** Só o que tem cara de item — id e nome —, para um `related` mexido à mão. */
function soItens(lista: unknown[] | undefined): unknown[] {
  return (lista ?? []).filter(
    (x) =>
      typeof x === 'object' &&
      x !== null &&
      typeof (x as { id?: unknown }).id === 'string' &&
      typeof (x as { name?: unknown }).name === 'string'
  )
}
