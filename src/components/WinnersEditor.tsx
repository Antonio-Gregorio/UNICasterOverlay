import { useEffect, useMemo, useRef, useState } from 'react'
import { Field } from './Field'
import { FontPicker } from './FontPicker'
import { Checkbox, ColorInput, Range, Section, Segmented } from './controls'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BadgeFlag,
  BadgeNone,
  BadgeRegion,
  BadgeTeam,
  BgPreset,
  BgUpload,
  CutBoth,
  CutBottom,
  CutNone,
  CutTop,
  FillGradient,
  FillSolid,
  ShapeCircle,
  ShapeHex,
  ShapeRect,
  ShapeRounded,
  DiceIcon,
} from './icons'
import { loadBackgrounds, type BackgroundPreset } from '../winners/backgrounds'
import { loadFlags } from '../flags'
import { WinnersPreview } from '../winners/WinnersPreview'
import { LAYOUTS } from '../winners/layouts'
import { addWinners, blankWinners, updateWinners } from '../winners/store'
import { fileToImage } from '../imageUpload'
import { loadMockPlayers, sampleMocks, useShuffleSeed, type MockPlayer } from '../topbar/mockPlayers'
import { emptyContent } from '../winners/types'
import type {
  Competitor,
  GraphicContent,
  GraphicLayout,
  TextStyle,
  WinnersTemplate,
} from '../winners/types'
import type { Character, FlagManifest } from '../types'

/** Editor de gráfico de vencedores. `template` preenchido = edição; nulo = novo. */
export function WinnersEditor({
  characters,
  template,
  initialLayout,
  onClose,
}: {
  characters: Character[]
  template: WinnersTemplate | null
  /** Layout escolhido no atalho de criação. */
  initialLayout?: GraphicLayout
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() =>
    template ? stripMeta(template) : blankWinners(initialLayout ?? 'top8')
  )
  const [touched, setTouched] = useState(false)
  const [mocks, setMocks] = useState<MockPlayer[]>([])
  const [seed, reshuffle] = useShuffleSeed()
  const bgInput = useRef<HTMLInputElement>(null)
  const [presets, setPresets] = useState<BackgroundPreset[]>([])
  const [flags, setFlags] = useState<FlagManifest | null>(null)

  useEffect(() => {
    loadMockPlayers().then(setMocks)
    loadBackgrounds().then(setPresets)
    loadFlags().then(setFlags, () => setFlags(null))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function patch<K extends keyof ReturnType<typeof blankWinners>>(
    key: K,
    value: Partial<ReturnType<typeof blankWinners>[K]>
  ) {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as object), ...value } }))
  }

  /** Estilo de texto é a mesma forma em dois lugares; este ajuda os dois. */
  function patchStyle(target: 'nameStyle' | 'event', value: Partial<TextStyle>) {
    if (target === 'nameStyle') patch('nameStyle', value)
    else setDraft((d) => ({ ...d, event: { ...d.event, style: { ...d.event.style, ...value } } }))
  }

  const spec = LAYOUTS[draft.layout]
  /**
   * Conteúdo de exemplo só para o preview. O que vale de verdade é definido na
   * hora de gerar a imagem — aqui o assunto é o visual.
   */
  const previewContent: GraphicContent = useMemo(() => {
    const withLeaders = draft.layout === 'team-vs' && draft.leaders.show
    // Os líderes saem de um sorteio à parte: eles não competem nos slots, e o
    // preview precisa mostrar como o brilho e o alinhamento ficam.
    const picked = withLeaders ? competitorsFromMocks(mocks, 2, false, `${seed}-lider`) : []
    return {
      ...emptyContent(),
      eventName: 'Nome do evento',
      casters: ['Caster'],
      competitors: competitorsFromMocks(mocks, draft.slotCount, draft.layout === 'top8-duo', seed),
      leaders: [picked[0] ?? null, picked[1] ?? null],
    }
  }, [mocks, draft.slotCount, draft.layout, draft.leaders.show, seed])

  async function pickBackground(file: File | undefined) {
    if (!file) return
    // O fundo é a imagem maior do template: 1600px cobre 1920 de tela sem
    // estourar a cota do localStorage.
    const img = await fileToImage(file, { maxSize: 1600 })
    patch('background', { image: img.dataUrl, type: 'image' })
  }

  const nameError = draft.name.trim() ? null : 'Dê um nome ao template.'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (nameError) return
    const input = { ...draft, name: draft.name.trim() }
    if (template) updateWinners(template.id, input)
    else addWinners(input)
    onClose()
  }

  return (
    <form className="editor-screen" onSubmit={submit}>
      <header className="screen-head editor-screen__head">
        <div>
          <h1>{template ? 'Editar gráfico' : 'Novo gráfico'}</h1>
          <p>O arranjo do gráfico de vencedores. O evento e quem competiu entram na geração.</p>
        </div>
      </header>

      <div className="editor-screen__body">
          <div className="editor-screen__controls">
            <Section title="Arranjo">
              <Field label="Modelo">
                <Segmented
                  value={draft.layout}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, layout: v, slotCount: LAYOUTS[v].defaultSlots }))
                  }
                  options={(Object.keys(LAYOUTS) as GraphicLayout[]).map((key) => ({
                    value: key,
                    label: LAYOUTS[key].label,
                  }))}
                />
              </Field>
              <Field label="Competidores" hint={`até ${spec.maxSlots}`}>
                <Range
                  value={Math.min(draft.slotCount, spec.maxSlots)}
                  onChange={(v) => setDraft((d) => ({ ...d, slotCount: v }))}
                  min={1}
                  max={spec.maxSlots}
                />
              </Field>
              <Field label="Espaço entre colunas">
                <Range
                  value={draft.grid.gapX}
                  onChange={(v) => patch('grid', { gapX: v })}
                  min={0}
                  max={120}
                />
              </Field>
              <Field label="Espaço entre fileiras">
                <Range
                  value={draft.grid.gapY}
                  onChange={(v) => patch('grid', { gapY: v })}
                  min={0}
                  max={120}
                />
              </Field>
              {draft.layout === 'team-vs' && (
                <>
                  <Field label="Largura do bloco">
                    <Range
                      value={Math.round(draft.grid.spread * 100)}
                      onChange={(v) => patch('grid', { spread: v / 100 })}
                      min={70}
                      max={160}
                      suffix="%"
                    />
                  </Field>
                  {/* Uma linha só: o resto do líder é decidido na geração. */}
                  <Checkbox
                    checked={draft.leaders.show}
                    onChange={(v) => patch('leaders', { show: v })}
                  >
                    Líder nas laterais
                  </Checkbox>
                </>
              )}
            </Section>

            <Section title="Fundo">
              <Field label="Tipo">
                <Segmented
                  value={draft.background.type}
                  onChange={(v) => patch('background', { type: v })}
                  options={[
                    { value: 'preset', label: 'Do jogo', icon: <BgPreset /> },
                    { value: 'solid', label: 'Cor', icon: <FillSolid /> },
                    { value: 'gradient', label: 'Degradê', icon: <FillGradient /> },
                    { value: 'image', label: 'Upload', icon: <BgUpload /> },
                  ]}
                />
              </Field>
              {draft.background.type === 'preset' && (
                <Field label="Cenário">
                  <div className="preset-grid">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.label}
                        aria-label={preset.label}
                        aria-pressed={draft.background.presetId === preset.id}
                        className={`preset-thumb${draft.background.presetId === preset.id ? ' is-active' : ''}`}
                        onClick={() => patch('background', { presetId: preset.id })}
                      >
                        <img src={preset.thumb} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              {(draft.background.type === 'preset' || draft.background.type === 'image') && (
                <>
                  <Field label="Véu">
                    <ColorInput
                      value={draft.background.overlayColor}
                      onChange={(v) => patch('background', { overlayColor: v })}
                    />
                  </Field>
                  <Field label="Opacidade">
                    <Range
                      value={draft.background.overlayOpacity}
                      onChange={(v) => patch('background', { overlayOpacity: v })}
                      min={0}
                      max={90}
                      suffix="%"
                    />
                  </Field>
                </>
              )}
              {draft.background.type === 'solid' && (
                <Field label="Cor">
                  <ColorInput
                    value={draft.background.color}
                    onChange={(v) => patch('background', { color: v })}
                  />
                </Field>
              )}
              {draft.background.type === 'gradient' && (
                <>
                  <Field label="Direção">
                    <Range
                      value={draft.background.gradient.angle}
                      onChange={(v) =>
                        patch('background', { gradient: { ...draft.background.gradient, angle: v } })
                      }
                      min={0}
                      max={360}
                      suffix="°"
                    />
                  </Field>
                  <StopList
                    stops={draft.background.gradient.stops}
                    onChange={(stops) => patch('background', { gradient: { ...draft.background.gradient, stops } })}
                  />
                </>
              )}
              {draft.background.type === 'image' && (
                <Field label="Imagem">
                  <button
                    type="button"
                    className="logo-drop logo-drop--wide"
                    onClick={() => bgInput.current?.click()}
                  >
                    {draft.background.image ? (
                      <img src={draft.background.image} alt="" />
                    ) : (
                      <span>Escolher imagem</span>
                    )}
                  </button>
                  <input
                    ref={bgInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => pickBackground(e.target.files?.[0])}
                  />
                </Field>
              )}
            </Section>

            <Section title="Moldura">
              <Field label="Formato da borda">
                <Segmented
                  value={draft.portrait.shape}
                  onChange={(v) => patch('portrait', { shape: v })}
                  options={[
                    { value: 'rect', label: 'Reta', icon: <ShapeRect /> },
                    { value: 'rounded', label: 'Redonda', icon: <ShapeRounded /> },
                    { value: 'circle', label: 'Círculo', icon: <ShapeCircle /> },
                    { value: 'hex', label: 'Hexágono', icon: <ShapeHex /> },
                  ]}
                />
              </Field>
              <Field label="Largura">
                <Range
                  value={Math.round(draft.portrait.widthScale * 100)}
                  onChange={(v) => patch('portrait', { widthScale: v / 100 })}
                  min={50}
                  max={160}
                  suffix="%"
                />
              </Field>
              <Field label="Altura">
                <Range
                  value={Math.round(draft.portrait.heightScale * 100)}
                  onChange={(v) => patch('portrait', { heightScale: v / 100 })}
                  min={50}
                  max={160}
                  suffix="%"
                />
              </Field>
              <Field label="Corte">
                <Segmented
                  value={draft.portrait.cut}
                  onChange={(v) => patch('portrait', { cut: v })}
                  options={[
                    { value: 'none', label: 'Sem', icon: <CutNone /> },
                    { value: 'top', label: 'Topo', icon: <CutTop /> },
                    { value: 'bottom', label: 'Base', icon: <CutBottom /> },
                    { value: 'both', label: 'Ambos', icon: <CutBoth /> },
                  ]}
                />
              </Field>
              {draft.portrait.cut !== 'none' && (
                <Field label="Ângulo do corte">
                  <Range
                    value={draft.portrait.cutAngle}
                    onChange={(v) => patch('portrait', { cutAngle: v })}
                    min={0}
                    max={35}
                    suffix="°"
                  />
                </Field>
              )}
              {draft.portrait.shape === 'rounded' && (
                <Field label="Raio">
                  <Range
                    value={draft.portrait.radius}
                    onChange={(v) => patch('portrait', { radius: v })}
                    min={0}
                    max={60}
                    suffix="px"
                  />
                </Field>
              )}
              <Field label="Cor da borda">
                <ColorInput
                  value={draft.portrait.borderColor}
                  onChange={(v) => patch('portrait', { borderColor: v })}
                />
              </Field>
              <Checkbox
                checked={draft.portrait.borderGradient}
                onChange={(v) => patch('portrait', { borderGradient: v })}
              >
                Borda em degradê
              </Checkbox>
              {draft.portrait.borderGradient && (
                <Field label="Segunda cor">
                  <ColorInput
                    value={draft.portrait.borderColor2}
                    onChange={(v) => patch('portrait', { borderColor2: v })}
                  />
                </Field>
              )}
              <Field label="Espessura">
                <Range
                  value={draft.portrait.borderWidth}
                  onChange={(v) => patch('portrait', { borderWidth: v })}
                  min={0}
                  max={16}
                  suffix="px"
                />
              </Field>
              <Field label="Sombra">
                <Segmented
                  value={draft.portrait.shadow}
                  onChange={(v) => patch('portrait', { shadow: v })}
                  options={[
                    { value: 'none', label: 'Sem' },
                    { value: 'soft', label: 'Leve' },
                    { value: 'medium', label: 'Média' },
                    { value: 'strong', label: 'Forte' },
                  ]}
                />
              </Field>
            </Section>

            <Section title="Personagem">
              <Checkbox
                checked={draft.portrait.useSD}
                onChange={(v) => patch('portrait', { useSD: v })}
              >
                Usar sprite SD (chibi)
              </Checkbox>
              <Checkbox
                checked={draft.portrait.useAnchor}
                onChange={(v) => patch('portrait', { useAnchor: v })}
              >
                Alinhar pelos olhos
              </Checkbox>
              <Field label="Zoom" hint="100% = inteiro">
                <Range
                  value={Math.round(draft.portrait.imageZoom * 100)}
                  onChange={(v) => patch('portrait', { imageZoom: v / 100 })}
                  min={50}
                  max={400}
                  suffix="%"
                />
              </Field>
              {/* O deslocamento acompanha o zoom: com o boneco bem maior que a
                  moldura, meia moldura de curso não chega no que se quer ver. */}
              <Field label="Deslocar ↔">
                <Range
                  value={Math.round(draft.portrait.imageOffsetX * 100)}
                  onChange={(v) => patch('portrait', { imageOffsetX: v / 100 })}
                  min={-150}
                  max={150}
                  suffix="%"
                />
              </Field>
              <Field label="Deslocar ↕">
                <Range
                  value={Math.round(draft.portrait.imageOffsetY * 100)}
                  onChange={(v) => patch('portrait', { imageOffsetY: v / 100 })}
                  min={-150}
                  max={150}
                  suffix="%"
                />
              </Field>
              <Field label="Insígnia">
                <Segmented
                  value={draft.flag}
                  onChange={(v) => setDraft((d) => ({ ...d, flag: v }))}
                  options={[
                    { value: 'none', label: 'Sem', icon: <BadgeNone /> },
                    { value: 'country', label: 'País', icon: <BadgeFlag /> },
                    { value: 'region', label: 'Estado', icon: <BadgeRegion /> },
                    { value: 'team', label: 'Time', icon: <BadgeTeam /> },
                  ]}
                />
              </Field>
            </Section>

            <Section title="Nome">
              <TextStyleFields
                style={draft.nameStyle}
                idPrefix="wn"
                onChange={(v) => patchStyle('nameStyle', v)}
              />
            </Section>

            <Section title="Arroba do X">
              <TextStyleFields
                style={draft.handleStyle}
                idPrefix="wh"
                onChange={(v) => patch('handleStyle', v)}
              />
            </Section>

            <Section title="Título do evento">
              <Checkbox checked={draft.event.show} onChange={(v) => patch('event', { show: v })}>
                Mostrar cabeçalho
              </Checkbox>
              {draft.event.show && (
                <>
                  <Field label="Canto">
                    <Segmented
                      value={draft.event.align}
                      onChange={(v) => patch('event', { align: v })}
                      options={[
                        { value: 'left', label: 'Esquerda', icon: <AlignLeft /> },
                        { value: 'center', label: 'Centro', icon: <AlignCenter /> },
                        { value: 'right', label: 'Direita', icon: <AlignRight /> },
                      ]}
                    />
                  </Field>
                  {/* O canto resolve o caso comum; estes desviam de uma logo ou
                      de um detalhe do fundo sem trocar de canto. */}
                  <Field label="Deslocar ↔">
                    <Range
                      value={Math.round(draft.event.offsetX * 100)}
                      onChange={(v) => patch('event', { offsetX: v / 100 })}
                      min={-40}
                      max={40}
                      suffix="%"
                    />
                  </Field>
                  <Field label="Deslocar ↕">
                    <Range
                      value={Math.round(draft.event.offsetY * 100)}
                      onChange={(v) => patch('event', { offsetY: v / 100 })}
                      min={-60}
                      max={200}
                      suffix="%"
                    />
                  </Field>
                  <Field label="Tamanho">
                    <Range
                      value={draft.event.size}
                      onChange={(v) => patch('event', { size: v })}
                      min={40}
                      max={160}
                    />
                  </Field>
                  <TextStyleFields
                    style={draft.event.style}
                    idPrefix="we"
                    onChange={(v) => patchStyle('event', v)}
                  />
                  <Checkbox
                    checked={draft.event.gradient}
                    onChange={(v) => patch('event', { gradient: v })}
                  >
                    Título em degradê
                  </Checkbox>
                  {draft.event.gradient && (
                    <Field label="Segunda cor">
                      <ColorInput
                        value={draft.event.gradientColor2}
                        onChange={(v) => patch('event', { gradientColor2: v })}
                      />
                    </Field>
                  )}
                </>
              )}
            </Section>

          </div>

        <aside className="editor-screen__preview">
          <div className="preview-toolbar">
            <button type="button" className="btn btn--small" onClick={reshuffle}>
              <DiceIcon /> Sortear jogadores
            </button>
          </div>
          <div className="winners-editor__stage">
            <WinnersPreview
              template={{ ...draft, id: 'preview', createdAt: '' }}
              content={previewContent}
              characters={characters}
              flags={flags}
              eventLogo={null}
              backgroundUrl={presets.find((p) => p.id === draft.background.presetId)?.url ?? null}
              width={660}
            />
          </div>

          {/* Nome e salvar embaixo da prévia — a mesma forma dos outros
              editores: o que se ajusta fica de um lado, o que se conclui do outro. */}
          <div className="editor-screen__general">
            <Field label="Nome do template" htmlFor="wn-name">
              <input
                id="wn-name"
                value={draft.name}
                autoFocus
                placeholder="Ex.: Top 8 do circuito"
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

/** Fonte, cor e contorno — o mesmo bloco serve para nome e para título. */
function TextStyleFields({
  style,
  idPrefix,
  onChange,
}: {
  style: TextStyle
  idPrefix: string
  onChange: (value: Partial<TextStyle>) => void
}) {
  return (
    <>
      <Field label="Fonte" htmlFor={`${idPrefix}-font`}>
        <FontPicker
          id={`${idPrefix}-font`}
          value={style.fontFamily}
          onChange={(v) => onChange({ fontFamily: v })}
        />
      </Field>
      <Field label="Cor">
        <ColorInput value={style.color} onChange={(v) => onChange({ color: v })} />
      </Field>
      <Field label="Contorno">
        <Range
          value={style.strokeWidth}
          onChange={(v) => onChange({ strokeWidth: v })}
          min={0}
          max={12}
          suffix="px"
        />
      </Field>
      {style.strokeWidth > 0 && (
        <Field label="Cor do contorno">
          <ColorInput value={style.strokeColor} onChange={(v) => onChange({ strokeColor: v })} />
        </Field>
      )}
    </>
  )
}

function StopList({ stops, onChange }: { stops: string[]; onChange: (stops: string[]) => void }) {
  return (
    <Field label="Cores" hint={`${stops.length}`}>
      <div className="stops">
        {stops.map((stop, i) => (
          <div key={i} className="stops__row">
            <ColorInput
              value={stop}
              onChange={(v) => {
                const next = [...stops]
                next[i] = v
                onChange(next)
              }}
            />
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              title="Remover cor"
              disabled={stops.length <= 2}
              onClick={() => onChange(stops.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn--small"
          disabled={stops.length >= 6}
          onClick={() => onChange([...stops, '#ffffff'])}
        >
          + cor
        </button>
      </div>
    </Field>
  )
}

/** Preenche os slots com os players de exemplo; duplas consomem dois por vez. */
export function competitorsFromMocks(
  mocks: MockPlayer[],
  count: number,
  pair: boolean,
  seed: string
): Competitor[] {
  if (mocks.length === 0) return []
  // Sorteia sem repetir: um jogador não aparece duas vezes na mesma peça.
  const picked = sampleMocks(mocks, pair ? count * 2 : count, seed)
  const out: Competitor[] = []
  for (let i = 0; i < count; i++) {
    const a = picked[pair ? i * 2 : i]
    const b = pair ? picked[i * 2 + 1] : null
    out.push({
      name: a.name,
      characterSlug: a.characterSlug,
      countryCode: a.countryCode,
      regionCode: a.regionCode ?? null,
      partnerName: b?.name,
      partnerCharacterSlug: b?.characterSlug ?? null,
    })
  }
  return out
}

function stripMeta(template: WinnersTemplate) {
  const { id: _id, createdAt: _createdAt, ...rest } = template
  return rest
}
