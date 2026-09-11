import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Field } from '../components/Field'
import { Select } from '../components/Select'
import { Checkbox, ColorInput, Range } from '../components/controls'
import { FontPicker } from '../components/FontPicker'
import { DiceIcon } from '../components/icons'
import { useData } from '../data'
import { fileToImage } from '../imageUpload'
import { sampleMocks, useShuffleSeed } from '../topbar/mockPlayers'
import { AnimStage, SCENE } from '../anim/AnimStage'
import { ANIM_STYLES, addAnim, blankAnimation, updateAnim, useAnims } from '../anim/store'
import type { AnimBgType, AnimPlay, AnimSide, AnimTemplate } from '../anim/types'

/** De onde o fundo sai. Rótulos curtos: é um seletor, não uma explicação. */
const BG_TYPES: { value: AnimBgType; label: string }[] = [
  { value: 'none', label: 'Sem fundo (transparente)' },
  { value: 'solid', label: 'Cor sólida' },
  { value: 'gradient', label: 'Degradê' },
  { value: 'scenery', label: 'Cenário desfocado' },
  { value: 'image', label: 'Imagem própria' },
]

type Draft = Omit<AnimTemplate, 'id' | 'createdAt'>

/**
 * O editor de uma apresentação. Sem `id` na rota, é uma animação nova.
 *
 * A prévia toca sozinha a cada ajuste: o efeito de uma mudança em animação não
 * se vê parado, e apertar "testar" a cada slider seria o trabalho todo.
 */
export function AnimEditorScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { mocks, backgrounds, characters } = useData()
  const anims = useAnims()
  const salvo = id ? (anims.find((a) => a.id === id) ?? null) : null

  const [draft, setDraft] = useState<Draft>(() => (salvo ? semMeta(salvo) : blankAnimation()))
  const [seed, reshuffle] = useShuffleSeed()
  /**
   * Personagem fixado em cada lado da prévia. Nulo = o sorteado.
   *
   * A régua iguala a cabeça, mas o resto é pose e enquadramento da ilustração —
   * e isso só dá para conferir olhando um por um. Com o sorteio sozinho, achar um
   * personagem específico é insistir no dado até ele aparecer.
   */
  const [picks, setPicks] = useState<[string | null, string | null]>([null, null])

  // A cena desenha um template inteiro; o rascunho ganha id e data de mentira
  // só para caber no formato — nada aqui os lê.
  const template = useMemo<AnimTemplate>(
    () => ({ ...draft, id: id ?? 'previa', createdAt: salvo?.createdAt ?? '' }),
    [draft, id, salvo]
  )

  /**
   * Cada disparo é um id novo, e a cena é remontada por `key`.
   *
   * Reiniciar animação de CSS no lugar exige tirar a classe, forçar reflow e
   * repor — três linhas de gambiarra que remontar o componente resolve de
   * graça.
   */
  const [run, setRun] = useState(0)
  /** Terminou de tocar: a cena fica parada na pose de sustentação. */
  const [parado, setParado] = useState(false)
  const anterior = useRef<string | null>(null)
  const bgInput = useRef<HTMLInputElement>(null)

  function tocar() {
    setParado(false)
    setRun((n) => n + 1)
  }

  /**
   * Mexeu no template, a prévia toca de novo — o efeito de um ajuste em
   * animação não se vê parado.
   *
   * Com um atraso, e não na hora: arrastar o slider da duração dispara uma
   * mudança por quadro, e sem a espera a prévia reiniciava trinta vezes por
   * segundo em vez de mostrar o resultado.
   */
  useEffect(() => {
    const assinatura = JSON.stringify(draft)
    if (anterior.current === assinatura) return
    anterior.current = assinatura
    const timer = setTimeout(tocar, 400)
    return () => clearTimeout(timer)
  }, [draft])

  const sides = useMemo<[AnimSide, AnimSide]>(() => {
    const pair = sampleMocks(mocks, 2, (id ?? 'novo') + seed)
    const toSide = (i: number): AnimSide => {
      // Fixado ganha do sorteio, e o nome vira o do personagem: numa conferência
      // de enquadramento, saber quem está ali importa mais que um nome de exemplo.
      const fixo = picks[i]
      if (fixo) {
        const c = characters.find((x) => x.slug === fixo)
        return { name: c?.name ?? '', teamTag: null, characterSlug: fixo }
      }
      return pair[i]
        ? { name: pair[i].name, teamTag: pair[i].teamTag ?? null, characterSlug: pair[i].characterSlug }
        : { name: '', teamTag: null, characterSlug: null }
    }
    return [toSide(0), toSide(1)]
  }, [mocks, id, seed, picks, characters])

  const fit = useFitScale()

  function patch(input: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...input }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const input = { ...draft, name: draft.name.trim() || 'Sem nome' }
    if (salvo) updateAnim(salvo.id, input)
    else addAnim(input)
    navigate('/animacoes')
  }

  // O cenário vai resolvido em URL: quem desenha não tem por que conhecer o
  // índice de fundos, e no OBS ele nem estaria disponível.
  const sceneryUrl = backgrounds.find((b) => b.id === draft.background.presetId)?.url ?? null

  const play: AnimPlay = { template, sides, runId: `${id ?? 'novo'}-${run}`, sceneryUrl }

  function patchBg(input: Partial<Draft['background']>) {
    patch({ background: { ...draft.background, ...input } })
  }

  async function pickImage(file: File | undefined) {
    if (!file) return
    const img = await fileToImage(file, { maxSize: 1600 })
    patchBg({ image: img.dataUrl })
  }

  if (id && !salvo) return <p className="empty">Animação não encontrada.</p>

  return (
    <form className="editor-screen" onSubmit={submit}>
      <header className="screen-head editor-screen__head">
        <div>
          <h1>{salvo ? 'Editar animação' : 'Nova animação'}</h1>
          <p>Apresentação dos dois jogadores, para rodar no overlay.</p>
        </div>
      </header>

      <div className="editor-screen__body">
        <div className="editor-screen__controls">

            <section className="editor-section">
              <h3>Prévia</h3>
              {([0, 1] as const).map((i) => (
                <Field
                  key={i}
                  label={i === 0 ? 'Esquerda' : 'Direita'}
                  htmlFor={`an-pick-${i}`}
                  hint={picks[i] ? undefined : 'sorteado'}
                >
                  <Select
                    id={`an-pick-${i}`}
                    options={characters.map((c) => ({ value: c.slug, label: c.name }))}
                    value={picks[i]}
                    onChange={(v) =>
                      setPicks((p) => {
                        const next: [string | null, string | null] = [p[0], p[1]]
                        next[i] = v
                        return next
                      })
                    }
                    placeholder="Sortear"
                    emptyLabel="Sortear"
                    searchPlaceholder="Buscar personagem..."
                  />
                </Field>
              ))}
              <p className="overlay-note">
                Fixe os dois lados para comparar quem está grande demais ou pequeno
                demais. O tamanho de cada um se ajusta em{' '}
                <code>scripts/scale-overrides.json</code>, na chave <code>anim</code>.
              </p>
            </section>

            <section className="editor-section">
              <h3>Coreografia</h3>
              {/* Select e não Segmented: com doze opções a fileira de botões
                  viraria uma parede de rótulos truncados.

                  A lista mostra só o nome. A descrição de cada coreografia tem uma
                  linha inteira, e como dica de campo ou de opção ela empurrava o
                  nome para fora — o seletor virava uma parede de texto onde não
                  dava para achar "Neon". Ela desceu para a nota. */}
              <Field label="Efeito" htmlFor="an-style">
                <Select
                  id="an-style"
                  options={ANIM_STYLES.map((s) => ({ value: s.value, label: s.label }))}
                  value={draft.style}
                  onChange={(style) => style && patch({ style: style as AnimTemplate['style'] })}
                  placeholder="Selecione o efeito"
                  searchPlaceholder="Buscar efeito..."
                />
              </Field>
              <p className="overlay-note">
                {ANIM_STYLES.find((s) => s.value === draft.style)?.hint}
              </p>
              <Field label="Duração">
                <Range
                  value={draft.duration}
                  onChange={(duration) => patch({ duration })}
                  min={2500}
                  max={12000}
                  step={250}
                  suffix="ms"
                />
              </Field>
            </section>

            <section className="editor-section">
              <h3>Personagem</h3>
              <Checkbox checked={draft.useSD} onChange={(useSD) => patch({ useSD })}>
                Chibi (SD) no lugar da arte
              </Checkbox>
              <Checkbox
                checked={draft.useCharacterColor}
                onChange={(useCharacterColor) => patch({ useCharacterColor })}
              >
                Acender cada lado com a cor do personagem
              </Checkbox>
              {/* Com a cor do personagem ligada, este campo ainda vale para o
                  efeito, que é um só para os dois lados. */}
              <Field
                label="Cor do efeito"
                htmlFor="an-accent"
                hint={draft.useCharacterColor ? 'só o efeito' : undefined}
              >
                <ColorInput
                  id="an-accent"
                  value={draft.accentColor}
                  onChange={(accentColor) => patch({ accentColor })}
                />
              </Field>
            </section>

            <section className="editor-section">
              <h3>Fundo</h3>
              <Field label="Origem" htmlFor="an-bg">
                <Select
                  id="an-bg"
                  options={BG_TYPES}
                  value={draft.background.type}
                  onChange={(type) => type && patchBg({ type: type as AnimBgType })}
                  placeholder="Selecione"
                />
              </Field>

              {draft.background.type === 'solid' && (
                <Field label="Cor" htmlFor="an-bg-color">
                  <ColorInput
                    id="an-bg-color"
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
                      onChange={(angle) =>
                        patchBg({ gradient: { ...draft.background.gradient, angle } })
                      }
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
                <Field label="Cenário" htmlFor="an-bg-preset">
                  <Select
                    id="an-bg-preset"
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

              {/* Só com fundo: sem ele a cena já é transparente e cada peça entra
                  e sai por conta própria — o fade não teria o que fazer. */}
              {draft.background.type !== 'none' && (
                <>
                  <Field label="Entrada (fade in)" hint="0 = corte seco">
                    <Range
                      value={draft.fadeIn ?? 0}
                      onChange={(fadeIn) => patch({ fadeIn })}
                      min={0}
                      max={1500}
                      step={50}
                      suffix="ms"
                    />
                  </Field>
                  <Field label="Saída (fade out)" hint="descontada da duração">
                    <Range
                      value={draft.fadeOut ?? 0}
                      onChange={(fadeOut) => patch({ fadeOut })}
                      min={0}
                      max={1500}
                      step={50}
                      suffix="ms"
                    />
                  </Field>
                </>
              )}

              {draft.background.type !== 'none' && (
                <Field label="Escurecer" hint="para o nome continuar legível">
                  <Range
                    value={draft.background.dim}
                    onChange={(dim) => patchBg({ dim })}
                    min={0}
                    max={85}
                    suffix="%"
                  />
                </Field>
              )}
            </section>

            <section className="editor-section">
              <h3>Nome</h3>
              <Field label="Fonte" htmlFor="an-font">
                <FontPicker
                  id="an-font"
                  value={draft.typography.fontFamily}
                  onChange={(fontFamily) =>
                    patch({ typography: { ...draft.typography, fontFamily } })
                  }
                />
              </Field>
              <Field label="Cor do nome" htmlFor="an-name-color">
                <ColorInput
                  id="an-name-color"
                  value={draft.typography.nameColor}
                  onChange={(nameColor) => patch({ typography: { ...draft.typography, nameColor } })}
                />
              </Field>
              <Checkbox checked={draft.showTeam} onChange={(showTeam) => patch({ showTeam })}>
                Mostrar a sigla do time
              </Checkbox>
              {draft.showTeam && (
                <Field label="Cor do time" htmlFor="an-team-color">
                  <ColorInput
                    id="an-team-color"
                    value={draft.typography.teamColor}
                    onChange={(teamColor) =>
                      patch({ typography: { ...draft.typography, teamColor } })
                    }
                  />
                </Field>
              )}
            </section>
        </div>

        <aside className="editor-screen__preview">
          <div className="anim-preview" ref={fit.ref}>
            {/*
             * A pose congelada entra na `key`, e não só numa classe: o atraso
             * negativo só reposiciona uma animação que ainda vai começar. Numa que
             * já terminou, o tempo corrente continua no fim e o quadro congelava
             * justamente na saída — a tela vazia que a pose existe para evitar.
             */}
            <AnimStage
              key={`${play.runId}-${parado ? 'parado' : 'tocando'}`}
              play={play}
              scale={fit.scale}
              held={parado}
              onDone={() => setParado(true)}
            />
          </div>

          <div className="editor-screen__general">
            <Field label="Nome da animação" htmlFor="an-name">
              <input
                id="an-name"
                value={draft.name}
                autoFocus
                placeholder="Ex.: Abertura das finais"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <p className="overlay-note">
              O tamanho e a altura das figuras são ajustados no painel do{' '}
              <strong>Overlay</strong>, com os dois já escalados.
            </p>
            <div className="editor-screen__actions">
              <button type="button" className="btn btn--small" onClick={reshuffle} title="Sortear outros">
                <DiceIcon /> Sortear
              </button>
              <button type="button" className="btn btn--small" onClick={tocar}>
                Testar
              </button>
              <button type="button" className="btn" onClick={() => navigate('/animacoes')}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary">
                {salvo ? 'Salvar' : 'Criar animação'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  )
}

/** Tira id e data — o editor mexe só no que é conteúdo da animação. */
function semMeta(t: AnimTemplate): Draft {
  const { id: _id, createdAt: _createdAt, ...rest } = t
  return structuredClone(rest)
}

/**
 * Escala que faz a cena de 1920x1080 caber na largura do painel.
 *
 * A mesma ideia da prévia do overlay, com a diferença de que aqui a altura
 * também importa: a cena é uma tela inteira, e a caixa precisa reservar o
 * espaço dela para os controles não pularem quando a animação entra.
 */
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

  return { ref, scale: box ? box / SCENE.width : 0.5 }
}
