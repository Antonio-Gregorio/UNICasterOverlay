import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ScreenHeader } from './ScreenHeader'
import { Field } from '../components/Field'
import { Select } from '../components/Select'
import { Checkbox, ColorInput, Range, Segmented } from '../components/controls'
import { WinnersPreview } from '../winners/WinnersPreview'
import { LAYOUTS } from '../winners/layouts'
import { useWinners } from '../winners/store'
import { downloadBlob, svgToPngBlob } from '../winners/exportImage'
import { emptyContent, type Competitor, type GraphicContent, type LeaderPlacement } from '../winners/types'
import { useData } from '../data'
import { useEvents } from '../events'
import { usePlayers } from '../players'
import { teamOf, useTeams } from '../teams'

/**
 * Onde o gráfico vira imagem: escolhe quem competiu, preenche evento e créditos,
 * e exporta em PNG.
 *
 * Estes campos vivem aqui e não no template porque mudam a cada torneio —
 * o template guarda só o visual, que é reaproveitado.
 */
export function WinnersGenerateScreen() {
  const { id } = useParams()
  const { characters, flags, backgrounds } = useData()
  const templates = useWinners()
  const events = useEvents()
  const players = usePlayers()
  const teams = useTeams()
  const stage = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const template = templates.find((t) => t.id === id)
  const [content, setContent] = useState<GraphicContent>(() => emptyContent())

  const slotCount = template?.slotCount ?? 0
  const isPair = template?.layout === 'top8-duo'

  const playerChoices = useMemo(
    () =>
      players.map((p) => ({
        value: p.id,
        label: p.name,
        hint: teamOf(p, teams)?.label,
        keywords: characters.find((c) => c.slug === p.characterSlug)?.name ?? '',
      })),
    [players, teams, characters]
  )

  const characterChoices = useMemo(
    () => characters.map((c) => ({ value: c.slug, label: c.name })),
    [characters]
  )

  if (!template) return <p className="empty">Template não encontrado.</p>

  function patch(value: Partial<GraphicContent>) {
    setContent((c) => ({ ...c, ...value }))
  }

  /** Preenche um lugar a partir de um player cadastrado. */
  function setCompetitor(index: number, playerId: string | null, partner = false) {
    const player = players.find((p) => p.id === playerId)
    const list: Competitor[] = [...content.competitors]
    while (list.length <= index) {
      list.push({ name: '', characterSlug: null })
    }
    const team = player ? teamOf(player, teams) : null
    const slot = { ...list[index] }
    if (partner) {
      slot.partnerName = player?.name
      slot.partnerCharacterSlug = player?.characterSlug ?? null
    } else {
      slot.name = player?.name ?? ''
      slot.characterSlug = player?.characterSlug ?? null
      slot.countryCode = player?.countryCode ?? null
      slot.regionCode = player?.regionCode ?? null
      slot.teamLogo = team?.logo ?? null
      slot.twitter = player?.twitter ?? null
    }
    list[index] = slot
    patch({ competitors: list })
  }

  /** Nome digitado à mão: jogador que não está no cadastro entra assim mesmo. */
  function setCustomName(index: number, text: string, partner = false) {
    const list: Competitor[] = [...content.competitors]
    while (list.length <= index) list.push({ name: '', characterSlug: null })
    const slot = { ...list[index] }
    if (partner) slot.partnerName = text
    else slot.name = text
    list[index] = slot
    patch({ competitors: list })
  }

  /** Troca só o personagem, preservando nome, bandeiras e time do jogador. */
  function setCharacter(index: number, slug: string | null) {
    const list: Competitor[] = [...content.competitors]
    while (list.length <= index) list.push({ name: '', characterSlug: null })
    list[index] = { ...list[index], characterSlug: slug }
    patch({ competitors: list })
  }

  /** Enquadramento de um líder só: os dois lados são independentes. */
  function patchLeader(side: 0 | 1, value: Partial<LeaderPlacement>) {
    const list: GraphicContent['leaderLayout'] = [content.leaderLayout[0], content.leaderLayout[1]]
    list[side] = { ...list[side], ...value }
    patch({ leaderLayout: list })
  }

  /** O líder é um jogador à parte, fora da lista de colocados. */
  function setLeader(side: 0 | 1, playerId: string | null) {
    const player = players.find((p) => p.id === playerId)
    const leaders: GraphicContent['leaders'] = [...content.leaders]
    leaders[side] = player
      ? {
          name: player.name,
          characterSlug: player.characterSlug,
          countryCode: player.countryCode,
          regionCode: player.regionCode,
          teamLogo: teamOf(player, teams)?.logo ?? null,
          twitter: player.twitter ?? null,
        }
      : null
    patch({ leaders })
  }

  async function exportPng() {
    const svg = stage.current?.querySelector('svg')
    if (!svg) return
    setExporting(true)
    try {
      const blob = await svgToPngBlob(svg)
      const slug = (content.eventName || template!.name || 'grafico')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      downloadBlob(blob, `${slug || 'grafico'}.png`)
    } catch (e) {
      alert(`Falha ao exportar: ${(e as Error).message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <ScreenHeader
        title={`Gerar: ${template.name}`}
        subtitle={`${LAYOUTS[template.layout].label} · ${slotCount} competidores`}
      >
        <Link className="btn" to="/winners">
          Voltar
        </Link>
        <button type="button" className="btn btn--primary" onClick={exportPng} disabled={exporting}>
          {exporting ? 'Exportando...' : 'Exportar PNG'}
        </button>
      </ScreenHeader>

      <div className="editor-screen__body">
        <div className="editor-screen__controls">
          <section className="editor-section">
            <h3>Competidores</h3>
            {players.length === 0 && (
              <p className="muted">
                Nenhum player cadastrado. Vá em <Link to="/players">Players</Link> para adicionar.
              </p>
            )}
            {Array.from({ length: slotCount }, (_, i) => (
              <div key={i} className="slot-row">
                <span className="slot-row__rank">{i + 1}º</span>
                <Select
                  id={`g-p${i}`}
                  options={choicesWith(playerChoices, content.competitors[i]?.name, players)}
                  value={valueFor(content.competitors[i]?.name, players)}
                  onChange={(v) => setCompetitor(i, v)}
                  onCustom={(text) => setCustomName(i, text)}
                  // Digitou, Enter, próximo: quem monta um top 8 preenche oito
                  // campos seguidos e não quer voltar ao mouse a cada um.
                  onCommit={() => focusSlot(isPair ? `g-d${i}` : `g-p${i + 1}`)}
                  placeholder="Selecione ou digite"
                  emptyLabel="Vazio"
                  searchPlaceholder="Buscar ou digitar..."
                />
                {isPair && (
                  <Select
                    id={`g-d${i}`}
                    options={choicesWith(playerChoices, content.competitors[i]?.partnerName, players)}
                    value={valueFor(content.competitors[i]?.partnerName, players)}
                    onChange={(v) => setCompetitor(i, v, true)}
                    onCustom={(text) => setCustomName(i, text, true)}
                    onCommit={() => focusSlot(`g-p${i + 1}`)}
                    placeholder="Dupla"
                    emptyLabel="Vazio"
                    searchPlaceholder="Buscar ou digitar..."
                  />
                )}
                {/* O personagem vem preenchido do cadastro, mas nem sempre o
                    player joga de main — aqui dá para trocar sem mexer no
                    cadastro dele. */}
                <Select
                  options={characterChoices}
                  value={content.competitors[i]?.characterSlug ?? null}
                  onChange={(v) => setCharacter(i, v)}
                  placeholder="Personagem"
                  emptyLabel="Sem personagem"
                  searchPlaceholder="Buscar personagem..."
                />
              </div>
            ))}
          </section>

          <section className="editor-section">
            <h3>Créditos</h3>
            <Checkbox
              checked={content.channels.twitch.show}
              onChange={(v) =>
                patch({ channels: { ...content.channels, twitch: { ...content.channels.twitch, show: v } } })
              }
            >
              Twitch
            </Checkbox>
            {content.channels.twitch.show && (
              <Field label="Canal" htmlFor="g-twitch">
                <input
                  id="g-twitch"
                  value={content.channels.twitch.handle}
                  placeholder="twitch.tv/seucanal"
                  onChange={(e) =>
                    patch({
                      channels: {
                        ...content.channels,
                        twitch: { ...content.channels.twitch, handle: e.target.value },
                      },
                    })
                  }
                />
              </Field>
            )}
            <Checkbox
              checked={content.channels.youtube.show}
              onChange={(v) =>
                patch({
                  channels: { ...content.channels, youtube: { ...content.channels.youtube, show: v } },
                })
              }
            >
              YouTube
            </Checkbox>
            {content.channels.youtube.show && (
              <Field label="Canal" htmlFor="g-youtube">
                <input
                  id="g-youtube"
                  value={content.channels.youtube.handle}
                  placeholder="@seucanal"
                  onChange={(e) =>
                    patch({
                      channels: {
                        ...content.channels,
                        youtube: { ...content.channels.youtube, handle: e.target.value },
                      },
                    })
                  }
                />
              </Field>
            )}

            <Field label="Casters" hint={`${content.casters.length}`}>
              <div className="stops">
                {content.casters.map((name, i) => (
                  <div key={i} className="stops__row">
                    <input
                      value={name}
                      placeholder={`Caster ${i + 1}`}
                      aria-label={`Caster ${i + 1}`}
                      onChange={(e) => {
                        const casters = [...content.casters]
                        casters[i] = e.target.value
                        patch({ casters })
                      }}
                    />
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      title="Remover caster"
                      onClick={() => patch({ casters: content.casters.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={content.casters.length >= 4}
                  onClick={() => patch({ casters: [...content.casters, ''] })}
                >
                  + caster
                </button>
              </div>
            </Field>
          </section>
        </div>

        <aside className="editor-screen__preview">
          <div className="winners-card__stage" ref={stage}>
            <WinnersPreview
              template={template}
              content={content}
              characters={characters}
              flags={flags}
              eventLogo={events.find((e) => e.id === content.logoId)?.image ?? null}
              backgroundUrl={
                backgrounds.find((b) => b.id === template.background.presetId)?.url ?? null
              }
              width={640}
            />
          </div>
          <p className="muted">Exporta em 1920×1080.</p>

          {/*
           * O que é do evento fica sob a prévia, e não no meio dos competidores:
           * nome, logo e os rótulos dos times valem para o gráfico inteiro, e é
           * o que se confere olhando a peça — não campo a campo.
           */}
          <div className="editor-screen__general">
            <section className="editor-section">
              <h3>Evento</h3>
              <Field label="Nome" htmlFor="g-event">
                <input
                  id="g-event"
                  value={content.eventName}
                  placeholder="Ex.: UNI Brasil Cup 2026"
                  onChange={(e) => patch({ eventName: e.target.value })}
                />
              </Field>
              <Field label="Logo" htmlFor="g-logo" hint={events.length ? undefined : 'nenhuma cadastrada'}>
                <Select
                  id="g-logo"
                  options={events.map((e) => ({ value: e.id, label: e.name }))}
                  value={content.logoId}
                  onChange={(v) => patch({ logoId: v })}
                  disabled={events.length === 0}
                  placeholder="Sem logo"
                  emptyLabel="Sem logo"
                  searchPlaceholder="Buscar logo..."
                />
              </Field>
              {template.layout === 'team-vs' && (
                <>
                  <Field label="Time vencedor" htmlFor="g-t0">
                    <input
                      id="g-t0"
                      value={content.teamNames[0]}
                      onChange={(e) => patch({ teamNames: [e.target.value, content.teamNames[1]] })}
                    />
                  </Field>
                  <Field label="Time perdedor" htmlFor="g-t1">
                    <input
                      id="g-t1"
                      value={content.teamNames[1]}
                      onChange={(e) => patch({ teamNames: [content.teamNames[0], e.target.value] })}
                    />
                  </Field>
                  {/* Quem venceu ganha a coroa; o outro lado sai dessaturado.
                      "Ainda não" serve para anunciar um jogo que não aconteceu:
                      sem coroa e com os dois lados coloridos. */}
                  <Field label="Venceu">
                    <Segmented
                      value={content.winner === null ? 'none' : String(content.winner)}
                      onChange={(v) => patch({ winner: v === 'none' ? null : v === '1' ? 1 : 0 })}
                      options={[
                        { value: '0', label: content.teamNames[0] || 'Esquerda' },
                        { value: '1', label: content.teamNames[1] || 'Direita' },
                        { value: 'none', label: 'Ainda não' },
                      ]}
                    />
                  </Field>
                  {template.leaders.show &&
                    ([0, 1] as const).map((side) => (
                      <div key={side} className="leader-block">
                        <Field
                          label={`Líder — ${content.teamNames[side] || (side === 0 ? 'vencedor' : 'perdedor')}`}
                          htmlFor={`g-leader-${side}`}
                          hint="aparece em pé na lateral"
                        >
                          <Select
                            id={`g-leader-${side}`}
                            options={playerChoices}
                            value={playerIdOf(content.leaders[side]?.name, players)}
                            onChange={(v) => setLeader(side, v)}
                            disabled={players.length === 0}
                            placeholder="Selecione"
                            emptyLabel="Sem líder"
                            searchPlaceholder="Buscar player..."
                          />
                        </Field>
                        {/* Cada lado tem os seus: o ajuste depende da pose de quem
                            foi escalado, não do template. */}
                        {content.leaders[side] && (
                          <>
                            <Checkbox
                              checked={content.leaderLayout[side].useSD}
                              onChange={(v) => patchLeader(side, { useSD: v })}
                            >
                              Usar sprite SD (chibi)
                            </Checkbox>
                            <Checkbox
                              checked={content.leaderLayout[side].highlight}
                              onChange={(v) => patchLeader(side, { highlight: v })}
                            >
                              Brilho atrás
                            </Checkbox>
                            {content.leaderLayout[side].highlight && (
                              <>
                                <Field label="Cor do brilho">
                                  <Segmented
                                    value={content.leaderLayout[side].colorMode}
                                    onChange={(v) => patchLeader(side, { colorMode: v })}
                                    options={[
                                      { value: 'character', label: 'Do personagem' },
                                      { value: 'fixed', label: 'Fixa' },
                                    ]}
                                  />
                                </Field>
                                {content.leaderLayout[side].colorMode === 'fixed' && (
                                  <Field label="Cor">
                                    <ColorInput
                                      value={content.leaderLayout[side].color}
                                      onChange={(v) => patchLeader(side, { color: v })}
                                    />
                                  </Field>
                                )}
                                <Field label="Intensidade do brilho">
                                  <Range
                                    value={content.leaderLayout[side].glow}
                                    onChange={(v) => patchLeader(side, { glow: v })}
                                    min={0}
                                    max={100}
                                    suffix="%"
                                  />
                                </Field>
                              </>
                            )}
                            <Field label="Tamanho">
                              <Range
                                value={Math.round(content.leaderLayout[side].scale * 100)}
                                onChange={(v) => patchLeader(side, { scale: v / 100 })}
                                min={40}
                                max={200}
                                suffix="%"
                              />
                            </Field>
                            <Field label="Largura">
                              <Range
                                value={Math.round(content.leaderLayout[side].widthScale * 100)}
                                onChange={(v) => patchLeader(side, { widthScale: v / 100 })}
                                min={60}
                                max={140}
                                suffix="%"
                              />
                            </Field>
                            <Field label="Altura">
                              <Range
                                value={Math.round(content.leaderLayout[side].heightScale * 100)}
                                onChange={(v) => patchLeader(side, { heightScale: v / 100 })}
                                min={60}
                                max={140}
                                suffix="%"
                              />
                            </Field>
                            <Field label="Posição ↔">
                              <Range
                                value={Math.round(content.leaderLayout[side].offsetX * 100)}
                                onChange={(v) => patchLeader(side, { offsetX: v / 100 })}
                                min={-100}
                                max={100}
                                suffix="%"
                              />
                            </Field>
                            <Field label="Posição ↕">
                              <Range
                                value={Math.round(content.leaderLayout[side].offsetY * 100)}
                                onChange={(v) => patchLeader(side, { offsetY: v / 100 })}
                                min={-60}
                                max={60}
                                suffix="%"
                              />
                            </Field>
                          </>
                        )}
                      </div>
                    ))}
                </>
              )}
            </section>

          </div>
        </aside>
      </div>
    </>
  )
}

/** Reencontra o player pelo nome — o conteúdo guarda o nome, não o id. */
function playerIdOf(name: string | undefined, players: { id: string; name: string }[]) {
  if (!name) return null
  return players.find((p) => p.name === name)?.id ?? null
}

/** Valor de um campo de player: o id do cadastrado, ou a marca de digitado. */
const CUSTOM = '__digitado'

function valueFor(name: string | undefined, players: { id: string; name: string }[]) {
  return playerIdOf(name, players) ?? (name ? CUSTOM : null)
}

/**
 * A lista ganha uma entrada com o nome digitado, senão o campo mostraria o
 * placeholder em cima de um nome que já está no gráfico.
 */
function choicesWith(
  choices: { value: string; label: string; hint?: string; keywords?: string }[],
  name: string | undefined,
  players: { id: string; name: string }[]
) {
  if (!name || playerIdOf(name, players)) return choices
  return [{ value: CUSTOM, label: name, group: 'Digitado' }, ...choices]
}

/** Leva o cursor para o próximo campo e já abre a lista dele. */
function focusSlot(id: string) {
  const el = document.getElementById(id)
  if (!(el instanceof HTMLElement)) return
  el.focus()
  el.click()
}
