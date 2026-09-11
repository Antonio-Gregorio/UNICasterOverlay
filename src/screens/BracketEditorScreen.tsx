import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Field } from '../components/Field'
import { Select } from '../components/Select'
import { Checkbox, ColorInput, Range, Segmented } from '../components/controls'
import { FontPicker } from '../components/FontPicker'
import { useData } from '../data'
import { fileToImage } from '../imageUpload'
import { sampleMocks } from '../topbar/mockPlayers'
import { SCENE } from '../overlay/channel'
import { BracketStage } from '../bracket/BracketStage'
import { demoTournament, mockToPerson } from '../bracket/people'
import { addTemplate, blankTemplate, updateTemplate, useBracketTemplates } from '../bracket/store'
import type {
  BracketAlign,
  BracketBgType,
  BracketFxStyle,
  BracketMode,
  BracketPlay,
  BracketTemplate,
  BracketTransition,
} from '../bracket/types'

type Draft = Omit<BracketTemplate, 'id' | 'createdAt'>

const MODES: { value: BracketMode; label: string; hint: string }[] = [
  { value: 'solo', label: 'Confronto', hint: 'um contra um' },
  { value: 'duo', label: 'Duplas', hint: 'dois por vaga' },
  { value: 'times', label: 'Times', hint: 'duas torres' },
]

const BG_TYPES: { value: BracketBgType; label: string }[] = [
  { value: 'none', label: 'Sem fundo' },
  { value: 'solid', label: 'Cor' },
  { value: 'gradient', label: 'Degradê' },
  { value: 'image', label: 'Imagem' },
  { value: 'scenery', label: 'Cenário desfocado' },
]

/** Os efeitos, com o nome que descreve o que se vê — ver Frame em BracketView. */
const FX_STYLES: { value: BracketFxStyle; label: string }[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'pulso', label: 'Pulso' },
  { value: 'corrida', label: 'Luz correndo' },
  { value: 'tracejado', label: 'Tracejado' },
  { value: 'faiscas', label: 'Faíscas' },
  { value: 'varredura', label: 'Varredura' },
]

const TRANSITIONS: { value: BracketTransition; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'barra', label: 'Barra' },
]

const ALIGNS: { value: BracketAlign; label: string }[] = [
  { value: 'left', label: 'Esq.' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Dir.' },
]

/** Quantos entram na chave de demonstração. Oito cabem na tela e dão três rodadas. */
const DEMO_SIZE = 8

/**
 * O editor do visual da chave. Sem `id` na rota, é um estilo novo.
 *
 * Só o visual: quem joga, o placar e quem passou são decididos no painel do
 * **Overlay**, durante a transmissão. O estilo é reaproveitado de evento em
 * evento e não guarda ninguém — guardar amarraria a cara da chave ao torneio que
 * estava aberto quando ela foi desenhada.
 *
 * A prévia usa os players de exemplo, como as miniaturas da topbar, e a chave vem
 * já jogada pela metade: sem vencedor não dá para conferir o selo, sem perdedor
 * não dá para conferir o cinza, sem vaga vazia não dá para ver a rodada seguinte.
 */
export function BracketEditorScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { characters, backgrounds, mocks } = useData()
  const templates = useBracketTemplates()
  const salvo = id ? (templates.find((t) => t.id === id) ?? null) : null

  const [draft, setDraft] = useState<Draft>(() => (salvo ? semMeta(salvo) : blankTemplate()))
  /** Trocar este número remonta a cena, e remontar é o que faz a entrada tocar. */
  const [run, setRun] = useState(0)

  const bgInput = useRef<HTMLInputElement>(null)
  const fit = useFitScale()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && navigate('/chaves')
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate])

  /*
   * Dois por participante, sempre: no modo de duplas o segundo é o parceiro, e
   * nos outros ele simplesmente não é usado. Sortear a mesma lista nos três
   * modos é o que faz trocar de modo não trocar o elenco da prévia junto.
   */
  const elenco = useMemo(() => {
    const escolhidos = sampleMocks(mocks, DEMO_SIZE * 2, 'chaves')
    // Sem o arquivo de exemplo (fetch falhou, lista vazia), nomes genéricos: a
    // prévia precisa existir para o editor abrir.
    if (escolhidos.length < DEMO_SIZE * 2) {
      return Array.from({ length: DEMO_SIZE * 2 }, (_, i) => ({
        name: `Player ${i + 1}`,
        characterSlug: '',
        countryCode: 'BR',
      }))
    }
    return escolhidos
  }, [mocks])

  const template = useMemo<BracketTemplate>(
    () => ({ ...draft, id: id ?? 'previa', createdAt: salvo?.createdAt ?? '' }),
    [draft, id, salvo]
  )

  const play: BracketPlay = useMemo(() => {
    const titulares = elenco.filter((_, i) => i % 2 === 0)
    const parceiros = elenco.filter((_, i) => i % 2 === 1)
    return {
      template,
      tournament: demoTournament(
        titulares.map((m) => m.name),
        template.mode
      ),
      people: titulares.map((m, i) =>
        mockToPerson(m, characters, template.mode === 'duo' ? parceiros[i] : undefined)
      ),
    }
  }, [template, elenco, characters])

  function patch(input: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...input }))
  }
  const patchBg = (input: Partial<Draft['background']>) =>
    patch({ background: { ...draft.background, ...input } })
  const patchFrame = (input: Partial<Draft['frame']>) => patch({ frame: { ...draft.frame, ...input } })
  const patchInfo = (input: Partial<Draft['info']>) => patch({ info: { ...draft.info, ...input } })
  const patchTransition = (input: Partial<Draft['transition']>) =>
    patch({ transition: { ...draft.transition, ...input } })
  const patchTeam = (lado: 0 | 1, input: Partial<Draft['teams'][0]>) => {
    const teams: Draft['teams'] = [{ ...draft.teams[0] }, { ...draft.teams[1] }]
    teams[lado] = { ...teams[lado], ...input }
    patch({ teams })
  }

  async function pickImage(file: File | undefined) {
    if (!file) return
    const img = await fileToImage(file, { maxSize: 1600 })
    patchBg({ image: img.dataUrl })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const input = { ...draft, name: draft.name.trim() || 'Sem nome' }
    if (salvo) updateTemplate(salvo.id, input)
    else addTemplate(input)
    navigate('/chaves')
  }

  if (id && !salvo) return <p className="empty">Estilo não encontrado.</p>

  return (
    <form className="editor-screen" onSubmit={submit}>
      <header className="screen-head editor-screen__head">
        <div>
          <h1>{salvo ? 'Editar chave' : 'Nova chave'}</h1>
          <p>O visual da tela de chave que vai ao ar.</p>
        </div>
      </header>

      <div className="editor-screen__body">
        <div className="editor-screen__controls">
          <section className="editor-section">
            <h3>Modo</h3>
            <Field label="O que a chave desenha" htmlFor="br-mode">
              <Select
                id="br-mode"
                options={MODES.map((m) => ({ value: m.value, label: m.label, hint: m.hint }))}
                value={draft.mode}
                onChange={(mode) => mode && patch({ mode: mode as BracketMode })}
                placeholder="Selecione"
              />
            </Field>
            <p className="overlay-note">
              {draft.mode === 'duo'
                ? 'Cada vaga leva dois: os dois bonecos lado a lado, os dois nomes e a bandeira de cada. O anel da vaga vai da cor de um à cor do outro.'
                : draft.mode === 'times'
                  ? 'Duas torres, uma por time. Quem já caiu fica em cinza e o placar sobe pela prévia do painel do Overlay.'
                  : 'Um contra um, do jeito de sempre.'}
            </p>
          </section>

          {/* Só no modo de times: nos outros a cor da vaga é a do personagem. */}
          {draft.mode === 'times' && (
            <section className="editor-section">
              <h3>Cores dos times</h3>
              {([0, 1] as const).map((lado) => (
                <div key={lado}>
                  <Field label={`Time ${lado + 1} — barra`} htmlFor={`br-time-${lado}`}>
                    <ColorInput
                      id={`br-time-${lado}`}
                      value={draft.teams[lado].color}
                      onChange={(color) => patchTeam(lado, { color })}
                    />
                  </Field>
                  <Field label={`Time ${lado + 1} — texto`} htmlFor={`br-time-txt-${lado}`}>
                    <ColorInput
                      id={`br-time-txt-${lado}`}
                      value={draft.teams[lado].textColor}
                      onChange={(textColor) => patchTeam(lado, { textColor })}
                    />
                  </Field>
                </div>
              ))}
              <p className="overlay-note">
                A barra identifica o lado de relance; o texto é o nome do time escrito
                sobre ela. Os nomes em si são do torneio, no painel do <strong>Overlay</strong>.
              </p>
            </section>
          )}

          <section className="editor-section">
            <h3>Entrada e saída</h3>
            <Field label="Como entra" htmlFor="br-troca">
              <Select
                id="br-troca"
                options={TRANSITIONS}
                value={draft.transition.style}
                onChange={(style) => style && patchTransition({ style: style as BracketTransition })}
                placeholder="Selecione"
              />
            </Field>
            <Field label="Duração" hint="vale para as duas pontas">
              <Range
                value={draft.transition.duration}
                onChange={(duration) => patchTransition({ duration })}
                min={0}
                max={2000}
                step={50}
                suffix="ms"
              />
            </Field>
            {draft.transition.style === 'barra' && (
              <Field label="Inclinação" hint="0 = barra reta">
                <Range
                  value={draft.transition.angle}
                  onChange={(angle) => patchTransition({ angle })}
                  min={-45}
                  max={45}
                  suffix="°"
                />
              </Field>
            )}
            <p className="overlay-note">
              A barra entra pela direita trazendo a tela atrás dela, e sai do mesmo jeito
              levando-a embora — com o feixe nas duas pontas. Zero na duração é corte seco.
            </p>
          </section>

          <section className="editor-section">
            <h3>O que aparece</h3>
            {(
              [
                ['characterArt', 'Boneco do personagem'],
                ['countryFlag', 'Bandeira do país'],
                ['teamTag', 'Sigla do time'],
                ['score', 'Placar'],
                ['winnerMark', 'Selo de quem passou'],
              ] as const
            ).map(([k, label]) => (
              <Checkbox
                key={k}
                checked={draft.show[k]}
                onChange={(v) => patch({ show: { ...draft.show, [k]: v } })}
              >
                {label}
              </Checkbox>
            ))}
            <p className="overlay-note">
              Cada peça carrega o próprio respiro à esquerda: desligar o boneco não cola a
              bandeira na borda.
            </p>
          </section>

          <section className="editor-section">
            <h3>Fundo</h3>
            <Field label="Origem" htmlFor="br-bg" hint="cobre a cena inteira">
              <Select
                id="br-bg"
                options={BG_TYPES}
                value={draft.background.type}
                onChange={(type) => type && patchBg({ type: type as BracketBgType })}
                placeholder="Selecione"
              />
            </Field>

            {draft.background.type === 'solid' && (
              <Field label="Cor" htmlFor="br-bg-color">
                <ColorInput
                  id="br-bg-color"
                  value={draft.background.color}
                  onChange={(color) => patchBg({ color })}
                />
              </Field>
            )}

            {draft.background.type === 'gradient' && (
              <>
                <Field label="Ângulo">
                  <Range
                    value={draft.background.gradient.angle}
                    onChange={(angle) => patchBg({ gradient: { ...draft.background.gradient, angle } })}
                    min={0}
                    max={360}
                    suffix="°"
                  />
                </Field>
                {[0, 1].map((i) => (
                  <Field key={i} label={i === 0 ? 'Cor inicial' : 'Cor final'}>
                    <ColorInput
                      value={draft.background.gradient.stops[i] ?? '#0f0f18'}
                      onChange={(c) => {
                        const stops = [...draft.background.gradient.stops]
                        stops[i] = c
                        patchBg({ gradient: { ...draft.background.gradient, stops } })
                      }}
                    />
                  </Field>
                ))}
              </>
            )}

            {draft.background.type === 'scenery' && (
              <Field label="Cenário" htmlFor="br-bg-preset">
                <Select
                  id="br-bg-preset"
                  options={backgrounds.map((b) => ({
                    value: b.id,
                    label: b.label,
                    icon: <img className="picker__thumb" src={b.thumb} alt="" />,
                  }))}
                  value={draft.background.presetId}
                  onChange={(presetId) => patchBg({ presetId })}
                  placeholder="Selecione o cenário"
                  searchPlaceholder="Buscar cenário..."
                />
              </Field>
            )}

            {draft.background.type === 'image' && (
              <Field label="Imagem" hint="reduzida para no máximo 1600px">
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
                  onChange={(e) => pickImage(e.target.files?.[0])}
                />
              </Field>
            )}

            {(draft.background.type === 'scenery' || draft.background.type === 'image') && (
              <Field label="Desfoque" hint="é o que vira fundo">
                <Range
                  value={draft.background.blur}
                  onChange={(blur) => patchBg({ blur })}
                  min={0}
                  max={40}
                  suffix="px"
                />
              </Field>
            )}

            {draft.background.type !== 'none' && (
              <Field label="Escurecer" hint="para os nomes continuarem legíveis">
                <Range
                  value={draft.background.dim}
                  onChange={(dim) => patchBg({ dim })}
                  min={0}
                  max={85}
                  suffix="%"
                />
              </Field>
            )}

            <Field label="Respiro" hint="entre a borda da tela e o conteúdo">
              <Range
                value={draft.background.padding}
                onChange={(padding) => patchBg({ padding })}
                min={0}
                max={200}
                suffix="px"
              />
            </Field>
            <Field label="Canto" hint="numa tela cheia, costuma ser zero">
              <Range
                value={draft.background.radius}
                onChange={(radius) => patchBg({ radius })}
                min={0}
                max={60}
                suffix="px"
              />
            </Field>
          </section>

          <section className="editor-section">
            <h3>Efeito ao redor</h3>
            <Field label="Estilo" htmlFor="br-fx">
              <Select
                id="br-fx"
                options={FX_STYLES}
                value={draft.frame.style}
                onChange={(style) => style && patchFrame({ style: style as BracketFxStyle })}
                placeholder="Selecione"
              />
            </Field>
            <Field label="Cor" htmlFor="br-fx-color" hint="vale também para a barra">
              <ColorInput
                id="br-fx-color"
                value={draft.frame.color}
                onChange={(color) => patchFrame({ color })}
              />
            </Field>
            {draft.frame.style !== 'none' && (
              <>
                <Field label="Intensidade">
                  <Range
                    value={draft.frame.intensity}
                    onChange={(intensity) => patchFrame({ intensity })}
                    min={0}
                    max={100}
                    suffix="%"
                  />
                </Field>
                <Field label="Espessura">
                  <Range
                    value={draft.frame.thickness}
                    onChange={(thickness) => patchFrame({ thickness })}
                    min={1}
                    max={12}
                    suffix="px"
                  />
                </Field>
                <Field label="Velocidade" hint="tempo de uma volta">
                  <Range
                    value={draft.frame.speed}
                    onChange={(speed) => patchFrame({ speed })}
                    min={600}
                    max={12000}
                    step={100}
                    suffix="ms"
                  />
                </Field>
                <p className="overlay-note">
                  Roda em laço enquanto a chave estiver em cena. Numa chave grande, efeito
                  lento cansa menos quem está assistindo ao set.
                </p>
              </>
            )}
          </section>

          <section className="editor-section">
            <h3>Infos</h3>
            <Checkbox checked={draft.info.showTitle} onChange={(showTitle) => patchInfo({ showTitle })}>
              Título no topo da tela
            </Checkbox>
            {draft.info.showTitle && (
              <>
                <Field label="Título" htmlFor="br-title" hint="vazio = o nome do torneio">
                  <input
                    id="br-title"
                    value={draft.info.title}
                    placeholder="Nome do torneio"
                    onChange={(e) => patchInfo({ title: e.target.value })}
                  />
                </Field>
                <Field label="Subtítulo" htmlFor="br-subtitle">
                  <input
                    id="br-subtitle"
                    value={draft.info.subtitle}
                    placeholder="Ex.: Eliminatória simples · Bo3"
                    onChange={(e) => patchInfo({ subtitle: e.target.value })}
                  />
                </Field>
                <Field label="Alinhamento">
                  <Segmented
                    value={draft.info.align}
                    onChange={(align) => patchInfo({ align })}
                    options={ALIGNS}
                    ariaLabel="Alinhamento do título"
                  />
                </Field>
                <Field label="Cor" htmlFor="br-title-color">
                  <ColorInput
                    id="br-title-color"
                    value={draft.info.color}
                    onChange={(color) => patchInfo({ color })}
                  />
                </Field>
                <Field label="Tamanho">
                  <Range
                    value={draft.info.size}
                    onChange={(size) => patchInfo({ size })}
                    min={16}
                    max={80}
                    suffix="px"
                  />
                </Field>
              </>
            )}
            <Checkbox
              checked={draft.info.showRounds}
              onChange={(showRounds) => patchInfo({ showRounds })}
            >
              Nome da rodada
            </Checkbox>
            {draft.info.showRounds && (
              <>
                <Field label="Cor da rodada" htmlFor="br-round-color">
                  <ColorInput
                    id="br-round-color"
                    value={draft.info.roundColor}
                    onChange={(roundColor) => patchInfo({ roundColor })}
                  />
                </Field>
                <Field label="Tamanho da rodada">
                  <Range
                    value={draft.info.roundSize}
                    onChange={(roundSize) => patchInfo({ roundSize })}
                    min={8}
                    max={40}
                    suffix="px"
                  />
                </Field>
              </>
            )}
          </section>

          <section className="editor-section">
            <h3>Texto</h3>
            <Field label="Fonte" htmlFor="br-font">
              <FontPicker
                id="br-font"
                value={draft.typography.fontFamily}
                onChange={(fontFamily) => patch({ typography: { ...draft.typography, fontFamily } })}
              />
            </Field>
            <Field label="Cor do nome" htmlFor="br-name-color">
              <ColorInput
                id="br-name-color"
                value={draft.typography.nameColor}
                onChange={(nameColor) => patch({ typography: { ...draft.typography, nameColor } })}
              />
            </Field>
            <Field label="Cor do placar" htmlFor="br-score-color">
              <ColorInput
                id="br-score-color"
                value={draft.typography.scoreColor}
                onChange={(scoreColor) => patch({ typography: { ...draft.typography, scoreColor } })}
              />
            </Field>
          </section>

          <section className="editor-section">
            <h3>Realce</h3>
            <Checkbox
              checked={draft.highlight.enabled}
              onChange={(enabled) => patch({ highlight: { ...draft.highlight, enabled } })}
            >
              Acender a vaga
            </Checkbox>
            <Checkbox
              checked={draft.highlight.useCharacterColor}
              onChange={(useCharacterColor) =>
                patch({ highlight: { ...draft.highlight, useCharacterColor } })
              }
            >
              Usar a cor do personagem
            </Checkbox>
            {!draft.highlight.useCharacterColor && (
              <Field label="Cor" htmlFor="br-hl">
                <ColorInput
                  id="br-hl"
                  value={draft.highlight.color}
                  onChange={(color) => patch({ highlight: { ...draft.highlight, color } })}
                />
              </Field>
            )}
            <Field label="Intensidade">
              <Range
                value={draft.highlight.intensity}
                onChange={(intensity) => patch({ highlight: { ...draft.highlight, intensity } })}
                min={0}
                max={100}
                suffix="%"
              />
            </Field>
          </section>

          <section className="editor-section">
            <h3>Perdedores</h3>
            <Checkbox checked={draft.dimLosers} onChange={(dimLosers) => patch({ dimLosers })}>
              Deixar em cinza
            </Checkbox>
            {draft.dimLosers && (
              <Field label="Quanto apagar">
                <Range
                  value={draft.dimAmount}
                  onChange={(dimAmount) => patch({ dimAmount })}
                  min={0}
                  max={100}
                  suffix="%"
                />
              </Field>
            )}
          </section>

          <section className="editor-section">
            <h3>Tamanho da vaga</h3>
            <Field label="Largura">
              <Range
                value={draft.slot.width}
                onChange={(width) => patch({ slot: { ...draft.slot, width } })}
                min={160}
                max={480}
                suffix="px"
              />
            </Field>
            <Field label="Altura">
              <Range
                value={draft.slot.height}
                onChange={(height) => patch({ slot: { ...draft.slot, height } })}
                min={32}
                max={96}
                suffix="px"
              />
            </Field>
            <Field label={draft.mode === 'times' ? 'Espaço entre as torres' : 'Espaço entre rodadas'}>
              <Range
                value={draft.slot.columnGap}
                onChange={(columnGap) => patch({ slot: { ...draft.slot, columnGap } })}
                min={16}
                max={160}
                suffix="px"
              />
            </Field>
          </section>
        </div>

        <aside className="editor-screen__preview">
          <div className="bracket-preview" ref={fit.ref}>
            <BracketStage key={run} play={play} scale={fit.scale} />
          </div>

          {/* Nome, salvar e o que mais é do estilo inteiro ficam sob a prévia:
              é o que se mexe uma vez, no fim, e não a cada ajuste. */}
          <div className="editor-screen__general">
            <Field label="Nome do estilo" htmlFor="br-name">
              <input
                id="br-name"
                value={draft.name}
                autoFocus
                placeholder="Ex.: Chave principal"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <p className="overlay-note">
              Prévia com os players de exemplo. Quem joga de verdade, o placar e quem passou
              saem do painel do <strong>Overlay</strong>.
            </p>
            <div className="editor-screen__actions">
              <button type="button" className="btn btn--small" onClick={() => setRun((n) => n + 1)}>
                Testar entrada
              </button>
              <button type="button" className="btn" onClick={() => navigate('/chaves')}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary">
                {salvo ? 'Salvar' : 'Criar estilo'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  )
}

/** Tira id e data — o editor mexe só no que é conteúdo do estilo. */
function semMeta(t: BracketTemplate): Draft {
  const { id: _id, createdAt: _createdAt, ...rest } = t
  return structuredClone(rest)
}

/** Escala que faz a cena de 1920x1080 caber na faixa da prévia. */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setBox(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, scale: box ? box / SCENE.width : 0.4 }
}
