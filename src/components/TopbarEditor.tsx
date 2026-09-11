import { useEffect, useMemo, useState } from 'react'
import { Field } from './Field'
import { Select } from './Select'
import { FontPicker } from './FontPicker'
import { Checkbox, ColorInput, Range, Section, Segmented } from './controls'
import {
  ArrowDown,
  ArrowUp,
  BorderDashDot,
  BorderDashed,
  BorderDotted,
  BorderNone,
  BorderSolid,
  EdgeRounded,
  EdgeSquare,
  EdgeTaper,
  FillGradient,
  FillSolid,
  ShapeNotch,
  ShapeStraight,
} from './icons'
import { TopbarPreview } from '../topbar/TopbarPreview'
import { addTopbar, blankTemplate, updateTopbar } from '../topbar/store'
import { usePlayers } from '../players'
import { teamOf, useTeams } from '../teams'
import { TeamLogo } from '../TeamLogo'
import type { TopbarData, TopbarTemplate } from '../topbar/types'
import type { Character, FlagManifest, Player, Team } from '../types'

type PreviewSource = 'character' | 'player'

/** Um lado do preview: quem aparece na barra e com quantos pontos. */
interface SideState {
  slug: string | null
  name: string
  tag: string
  playerId: string | null
  score: number
}

/** Editor de template de topbar. `template` preenchido = edição; nulo = novo. */
export function TopbarEditor({
  characters,
  flags,
  template,
  onClose,
}: {
  characters: Character[]
  flags: FlagManifest
  template: TopbarTemplate | null
  onClose: () => void
}) {
  const players = usePlayers()
  const teams = useTeams()
  const [draft, setDraft] = useState(() => (template ? stripMeta(template) : blankTemplate()))
  const [touched, setTouched] = useState(false)

  // Uma topbar é a peça dos dois jogadores, então o preview mostra os dois: é
  // aí que se vê se a barra fecha bem no meio.
  const [source, setSource] = useState<PreviewSource>('character')
  const [p1, setP1] = useState<SideState>({
    slug: characters[0]?.slug ?? null,
    name: 'Kanoe',
    tag: 'ZETA',
    playerId: players[0]?.id ?? null,
    score: 2,
  })
  const [p2, setP2] = useState<SideState>({
    slug: characters[1]?.slug ?? null,
    name: 'Rikuto',
    tag: 'NB',
    playerId: players[1]?.id ?? players[0]?.id ?? null,
    score: 1,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  /** Atualiza um ramo do template sem perder o resto. */
  function patch<K extends keyof ReturnType<typeof blankTemplate>>(
    key: K,
    value: Partial<ReturnType<typeof blankTemplate>[K]>
  ) {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as object), ...value } }))
  }

  const characterChoices = useMemo(
    () => characters.map((c) => ({ value: c.slug, label: c.name, keywords: c.slug })),
    [characters]
  )
  const playerChoices = useMemo(
    () =>
      players.map((p) => {
        const team = teamOf(p, teams)
        return {
          value: p.id,
          label: p.name,
          hint: team?.label,
          keywords: `${team?.label ?? ''} ${characters.find((c) => c.slug === p.characterSlug)?.name ?? ''}`,
          icon: team?.logo ? <TeamLogo logo={team.logo} label={team.label} /> : undefined,
        }
      }),
    [players, teams, characters]
  )

  const data1 = sideData(source, p1, players, teams)
  const data2 = sideData(source, p2, players, teams)

  const nameError = draft.name.trim() ? null : 'Dê um nome ao template.'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (nameError) return
    const input = { ...draft, name: draft.name.trim() }
    if (template) updateTopbar(template.id, input)
    else addTopbar(input)
    onClose()
  }

  return (
    <form className="editor-screen" onSubmit={submit}>
      <header className="screen-head editor-screen__head">
        <div>
          <h1>{template ? 'Editar topbar' : 'Nova topbar'}</h1>
          <p>A barra que fica na tela durante a stream.</p>
        </div>
      </header>

      <div className="editor-screen__body">
          <div className="editor-screen__controls">
              <Section title="Formato">
                <Field label="Silhueta">
                  <Segmented
                    value={draft.shape.style}
                    onChange={(v) => patch('shape', { style: v })}
                    options={[
                      { value: 'straight', label: 'Reta', icon: <ShapeStraight /> },
                      { value: 'center-notch', label: 'Vazamento', icon: <ShapeNotch /> },
                    ]}
                  />
                </Field>
                {draft.shape.style === 'center-notch' && (
                  <>
                    <Field label="Direção">
                      <Segmented
                        value={draft.shape.notchDirection}
                        onChange={(v) => patch('shape', { notchDirection: v })}
                        options={[
                          { value: 'up', label: 'Cima', icon: <ArrowUp /> },
                          { value: 'down', label: 'Baixo', icon: <ArrowDown /> },
                        ]}
                      />
                    </Field>
                    <Field label="Profundidade">
                      <Range
                        value={draft.shape.notchDepth}
                        onChange={(v) => patch('shape', { notchDepth: v })}
                        min={0}
                        max={90}
                        suffix="px"
                      />
                    </Field>
                    <Field label="Largura">
                      <Range
                        value={draft.shape.notchWidth}
                        onChange={(v) => patch('shape', { notchWidth: v })}
                        min={80}
                        max={800}
                        step={10}
                        suffix="px"
                      />
                    </Field>
                    <Field label="Inclinação" hint="0 = degrau reto">
                      <Range
                        value={draft.shape.notchSlant}
                        onChange={(v) => patch('shape', { notchSlant: v })}
                        min={0}
                        max={160}
                        suffix="px"
                      />
                    </Field>
                  </>
                )}
                <Field label="Altura da barra">
                  <Range
                    value={draft.barHeight}
                    onChange={(v) => setDraft((d) => ({ ...d, barHeight: v }))}
                    min={48}
                    max={180}
                    suffix="px"
                  />
                </Field>
              </Section>

              <Section title="Bordas">
                <Field label="Estilo">
                  <Segmented
                    value={draft.edges.style}
                    onChange={(v) => patch('edges', { style: v })}
                    options={[
                      { value: 'square', label: 'Retas', icon: <EdgeSquare /> },
                      { value: 'rounded', label: 'Redondas', icon: <EdgeRounded /> },
                      { value: 'taper', label: 'Corte', icon: <EdgeTaper /> },
                    ]}
                  />
                </Field>
                {draft.edges.style === 'rounded' && (
                  <Field label="Raio">
                    <Range
                      value={draft.edges.radius}
                      onChange={(v) => patch('edges', { radius: v })}
                      min={0}
                      max={60}
                      suffix="px"
                    />
                  </Field>
                )}
                {draft.edges.style === 'taper' && (
                  <>
                    <Field label="Afunila para" hint="na ponta do placar">
                      <Segmented
                        value={draft.edges.taperDirection}
                        onChange={(v) => patch('edges', { taperDirection: v })}
                        options={[
                          { value: 'up', label: 'Cima', icon: <ArrowUp /> },
                          { value: 'down', label: 'Baixo', icon: <ArrowDown /> },
                        ]}
                      />
                    </Field>
                    <Field label="Corte">
                      <Range
                        value={draft.edges.taper}
                        onChange={(v) => patch('edges', { taper: v })}
                        min={0}
                        max={200}
                        suffix="px"
                      />
                    </Field>
                  </>
                )}
              </Section>
              <Section title="Cor da barra">
                <Field label="Preenchimento">
                  <Segmented
                    value={draft.fill.type}
                    onChange={(v) => patch('fill', { type: v })}
                    options={[
                      { value: 'solid', label: 'Sólida', icon: <FillSolid /> },
                      { value: 'gradient', label: 'Degradê', icon: <FillGradient /> },
                    ]}
                  />
                </Field>
                {draft.fill.type === 'solid' ? (
                  <Field label="Cor">
                    <ColorInput value={draft.fill.color} onChange={(v) => patch('fill', { color: v })} />
                  </Field>
                ) : (
                  <>
                    <Field label="Direção">
                      <Range
                        value={draft.fill.gradient.angle}
                        onChange={(v) => patch('fill', { gradient: { ...draft.fill.gradient, angle: v } })}
                        min={0}
                        max={360}
                        suffix="°"
                      />
                    </Field>
                    <Checkbox
                      checked={draft.fill.gradient.mirror ?? false}
                      onChange={(v) => patch('fill', { gradient: { ...draft.fill.gradient, mirror: v } })}
                    >
                      Espelhar no player 2
                    </Checkbox>
                    <Field label="Cores" hint={`${draft.fill.gradient.stops.length}`}>
                      <div className="stops">
                        {draft.fill.gradient.stops.map((stop, i) => (
                          <div key={i} className="stops__row">
                            <ColorInput
                              value={stop}
                              onChange={(v) => {
                                const stops = [...draft.fill.gradient.stops]
                                stops[i] = v
                                patch('fill', { gradient: { ...draft.fill.gradient, stops } })
                              }}
                            />
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              title="Remover cor"
                              disabled={draft.fill.gradient.stops.length <= 2}
                              onClick={() =>
                                patch('fill', {
                                  gradient: {
                                    ...draft.fill.gradient,
                                    stops: draft.fill.gradient.stops.filter((_, j) => j !== i),
                                  },
                                })
                              }
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn--small"
                          disabled={draft.fill.gradient.stops.length >= 6}
                          onClick={() =>
                            patch('fill', {
                              gradient: {
                                ...draft.fill.gradient,
                                stops: [...draft.fill.gradient.stops, '#ffffff'],
                              },
                            })
                          }
                        >
                          + cor
                        </button>
                      </div>
                    </Field>
                  </>
                )}
              </Section>

              <Section title="Contorno">
                <Field label="Traço">
                  <Segmented
                    value={draft.border.style}
                    onChange={(v) => patch('border', { style: v })}
                    options={[
                      { value: 'none', label: 'Sem', icon: <BorderNone /> },
                      { value: 'solid', label: 'Reto', icon: <BorderSolid /> },
                      { value: 'dotted', label: 'Pontilhado', icon: <BorderDotted /> },
                      { value: 'dashed', label: 'Tracejado', icon: <BorderDashed /> },
                      { value: 'dash-dot', label: 'Traço-ponto', icon: <BorderDashDot /> },
                    ]}
                  />
                </Field>
                {draft.border.style !== 'none' && (
                  <>
                    <Field label="Cor">
                      <ColorInput value={draft.border.color} onChange={(v) => patch('border', { color: v })} />
                    </Field>
                    <Field label="Espessura">
                      <Range
                        value={draft.border.width}
                        onChange={(v) => patch('border', { width: v })}
                        min={1}
                        max={12}
                        suffix="px"
                      />
                    </Field>
                  </>
                )}
              </Section>

              <Section title="Highlight">
                <Checkbox
                  checked={draft.highlight.enabled}
                  onChange={(v) => patch('highlight', { enabled: v })}
                >
                  Brilho por trás da barra
                </Checkbox>
                {draft.highlight.enabled && (
                  <>
                    <Checkbox
                      checked={draft.highlight.useCharacterColor}
                      onChange={(v) => patch('highlight', { useCharacterColor: v })}
                    >
                      Usar a cor do personagem
                    </Checkbox>
                    <Field
                      label="Cor"
                      hint={draft.highlight.useCharacterColor ? 'ignorada' : undefined}
                    >
                      <ColorInput
                        value={draft.highlight.color}
                        onChange={(v) => patch('highlight', { color: v })}
                      />
                    </Field>
                    <Field label="Intensidade">
                      <Range
                        value={draft.highlight.intensity}
                        onChange={(v) => patch('highlight', { intensity: v })}
                        min={0}
                        max={100}
                        suffix="%"
                      />
                    </Field>
                    <Field label="Blur">
                      <Range
                        value={draft.highlight.blur}
                        onChange={(v) => patch('highlight', { blur: v })}
                        min={0}
                        max={60}
                        suffix="px"
                      />
                    </Field>
                  </>
                )}
              </Section>
              <Section title="Textos">
                <Field label="Fonte" htmlFor="tb-font">
                  <FontPicker
                    id="tb-font"
                    value={draft.typography.fontFamily}
                    onChange={(v) => patch('typography', { fontFamily: v })}
                  />
                </Field>
                <Field label="Cor do nome">
                  <ColorInput
                    value={draft.typography.nameColor}
                    onChange={(v) => patch('typography', { nameColor: v })}
                  />
                </Field>
                <Field label="Cor do time">
                  <ColorInput
                    value={draft.typography.teamColor}
                    onChange={(v) => patch('typography', { teamColor: v })}
                  />
                </Field>
                <Field label="Cor do placar">
                  <ColorInput
                    value={draft.typography.scoreColor}
                    onChange={(v) => patch('typography', { scoreColor: v })}
                  />
                </Field>
              </Section>

              <Section title="O que aparece">
                <div className="checkbox-list">
                  <Checkbox
                    checked={draft.show.characterArt}
                    onChange={(v) => patch('show', { characterArt: v })}
                  >
                    Imagem do boneco
                  </Checkbox>
                  {draft.show.characterArt && (
                    <>
                      <Checkbox
                        checked={draft.show.useSD}
                        onChange={(v) => patch('show', { useSD: v })}
                      >
                        Usar sprite SD (chibi)
                      </Checkbox>
                      <Checkbox
                        checked={draft.show.useAnchor}
                        onChange={(v) => patch('show', { useAnchor: v })}
                      >
                        Alinhar pelos olhos
                      </Checkbox>
                    </>
                  )}
                  <Checkbox checked={draft.show.teamTag} onChange={(v) => patch('show', { teamTag: v })}>
                    Tag do time
                  </Checkbox>
                  <Checkbox checked={draft.show.teamFlag} onChange={(v) => patch('show', { teamFlag: v })}>
                    Bandeira do time
                  </Checkbox>
                  <Checkbox
                    checked={draft.show.countryFlag}
                    onChange={(v) => patch('show', { countryFlag: v })}
                  >
                    Bandeira do país
                  </Checkbox>
                  <Checkbox
                    checked={draft.show.regionFlag}
                    onChange={(v) => patch('show', { regionFlag: v })}
                  >
                    Bandeira do estado
                  </Checkbox>
                </div>
              </Section>
          </div>

        <aside className="editor-screen__preview">
          <section className="topbar-editor__preview">
            <div className="topbar-editor__stage">
              <div className="topbar-pair">
                <TopbarPreview template={asTemplate(draft)} data={data1} characters={characters} flags={flags} width={340} />
                <TopbarPreview
                  template={asTemplate(draft)}
                  data={data2}
                  characters={characters}
                  flags={flags}
                  width={340}
                  mirrored
                />
              </div>
            </div>

            <div className="topbar-editor__source">
              <nav className="tabs tabs--inline" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={`tab${source === 'character' ? ' is-active' : ''}`}
                  aria-selected={source === 'character'}
                  onClick={() => setSource('character')}
                >
                  Personagem
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`tab${source === 'player' ? ' is-active' : ''}`}
                  aria-selected={source === 'player'}
                  onClick={() => setSource('player')}
                >
                  Player
                </button>
              </nav>

              <div className="topbar-editor__sides">
                <SideFields
                  label="Player 1"
                  idPrefix="p1"
                  source={source}
                  state={p1}
                  onChange={(patchState) => setP1((s) => ({ ...s, ...patchState }))}
                  characterChoices={characterChoices}
                  playerChoices={playerChoices}
                  hasPlayers={players.length > 0}
                />
                <SideFields
                  label="Player 2"
                  idPrefix="p2"
                  source={source}
                  state={p2}
                  onChange={(patchState) => setP2((s) => ({ ...s, ...patchState }))}
                  characterChoices={characterChoices}
                  playerChoices={playerChoices}
                  hasPlayers={players.length > 0}
                />
              </div>
            </div>
          </section>

          {/* Nome e salvar embaixo da prévia: é o que se toca uma vez, no fim, e
              no topo eles disputavam espaço com o que se ajusta o tempo todo. */}
          <div className="editor-screen__general">
            <Field label="Nome do template" htmlFor="tb-name">
              <input
                id="tb-name"
                value={draft.name}
                autoFocus
                placeholder="Ex.: Barra das finais"
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </Field>
            {touched && nameError && <span className="field__error">{nameError}</span>}
            <div className="editor-screen__actions">
              <button type="button" className="btn" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary">
                {template ? 'Salvar' : 'Criar template'}
              </button>
            </div>
          </div>
        </aside>
      </div>


    </form>
  )
}

/** Campos que alimentam um lado do preview. */
function SideFields({
  label,
  idPrefix,
  source,
  state,
  onChange,
  characterChoices,
  playerChoices,
  hasPlayers,
}: {
  label: string
  idPrefix: string
  source: PreviewSource
  state: SideState
  onChange: (patch: Partial<SideState>) => void
  characterChoices: { value: string; label: string; keywords?: string }[]
  playerChoices: { value: string; label: string }[]
  hasPlayers: boolean
}) {
  return (
    <fieldset className="side-fields">
      <legend>{label}</legend>
      {source === 'character' ? (
        <>
          <Field label="Personagem" htmlFor={`${idPrefix}-char`}>
            <Select
              id={`${idPrefix}-char`}
              options={characterChoices}
              value={state.slug}
              onChange={(v) => onChange({ slug: v })}
              placeholder="Selecione"
              searchPlaceholder="Buscar personagem..."
            />
          </Field>
          <Field label="Nome" htmlFor={`${idPrefix}-name`}>
            <input
              id={`${idPrefix}-name`}
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>
          <Field label="Sigla" htmlFor={`${idPrefix}-tag`}>
            <input
              id={`${idPrefix}-tag`}
              value={state.tag}
              onChange={(e) => onChange({ tag: e.target.value })}
            />
          </Field>
        </>
      ) : (
        <Field
          label="Player"
          htmlFor={`${idPrefix}-player`}
          hint={hasPlayers ? undefined : 'nenhum cadastrado'}
        >
          <Select
            id={`${idPrefix}-player`}
            options={playerChoices}
            value={state.playerId}
            onChange={(v) => onChange({ playerId: v })}
            disabled={!hasPlayers}
            placeholder="Selecione"
            searchPlaceholder="Buscar player..."
          />
        </Field>
      )}
      <Field label="Placar" htmlFor={`${idPrefix}-score`}>
        <input
          id={`${idPrefix}-score`}
          type="number"
          min={0}
          max={99}
          value={state.score}
          onChange={(e) => onChange({ score: Number(e.target.value) })}
        />
      </Field>
    </fieldset>
  )
}

function sideData(source: PreviewSource, side: SideState, players: Player[], teams: Team[]): TopbarData {
  if (source === 'player') {
    const player = players.find((p) => p.id === side.playerId)
    if (!player) {
      return {
        name: '',
        teamTag: null,
        teamLogo: null,
        characterSlug: null,
        countryCode: null,
        regionCode: null,
        score: side.score,
      }
    }
    const team = teamOf(player, teams)
    return {
      name: player.name,
      teamTag: team?.label ?? null,
      teamLogo: team?.logo ?? null,
      characterSlug: player.characterSlug,
      countryCode: player.countryCode,
      regionCode: player.regionCode,
      score: side.score,
    }
  }
  return {
    name: side.name,
    teamTag: side.tag || null,
    teamLogo: null,
    characterSlug: side.slug,
    // Sem player escolhido não há de onde tirar bandeira; estas entram só para
    // que as opções de bandeira tenham o que mostrar no preview.
    countryCode: 'BR',
    regionCode: 'BR-SP',
    score: side.score,
  }
}

const asTemplate = (draft: ReturnType<typeof blankTemplate>): TopbarTemplate => ({
  ...draft,
  id: 'preview',
  createdAt: '',
})

/** Tira id e createdAt: o rascunho não deve carregar a identidade do original. */
function stripMeta(template: TopbarTemplate) {
  const { id: _id, createdAt: _createdAt, ...rest } = template
  return rest
}
