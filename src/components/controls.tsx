import { useEffect, useRef } from 'react'

/** Controles de formulário reutilizados pelo editor de topbar. */

/**
 * Escolha entre poucas opções mutuamente exclusivas. Deliberadamente não é um
 * dropdown: com duas ou três alternativas, ver todas de uma vez é mais rápido
 * do que abrir uma lista para escolher uma.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon?: React.ReactNode }[]
  ariaLabel?: string
}) {
  const withIcons = options.some((o) => o.icon)
  return (
    <div className={`segmented${withIcons ? ' segmented--icons' : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : ''}
          aria-pressed={value === option.value}
          title={option.label}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Seletor de cor com o hex ao lado, editável nos dois sentidos. */
export function ColorInput({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="color-input">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Cor"
      />
      <input
        type="text"
        className="color-input__hex"
        value={value}
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value.trim()
          // Só propaga quando já é um hex válido: caso contrário, digitar o
          // segundo caractere jogaria uma cor inválida no template.
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next)
        }}
      />
    </div>
  )
}

/** Slider com o valor corrente à direita. */
export function Range({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
}: {
  id?: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="range">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="range__value">
        {value}
        {suffix}
      </span>
    </div>
  )
}

/**
 * Dois botões que andam com o valor enquanto estiverem pressionados.
 *
 * No lugar de um slider para o ajuste fino: no slider, um pixel de mouse vale
 * dezenas de px de cena, e acertar a altura exata vira sorte. Segurando, o valor
 * anda de `step` em `step` no mesmo ritmo — e uma batidinha move um passo só.
 *
 * O valor corrente é clicável e volta a zero: com o slider fora, voltar ao ponto
 * de partida exigiria contar os cliques de volta.
 */
export function HoldNudge({
  value,
  onChange,
  step = 8,
  min = -Number.MAX_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  suffix = '',
  labels = ['↑', '↓'],
  invert = false,
}: {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
  /** [primeiro botão, segundo botão]. */
  labels?: [string, string]
  /** O primeiro botão diminui, e não aumenta — é o caso de "para cima". */
  invert?: boolean
}) {
  // Ref porque o intervalo dispara fora do render: o `value` que ele veria seria
  // sempre o do primeiro quadro, e o valor andaria um passo só.
  const atual = useRef(value)
  atual.current = value
  /* Dois tempos: a espera antes de embalar e a repetição em si. */
  const atraso = useRef<number | null>(null)
  const repeticao = useRef<number | null>(null)

  const parar = () => {
    if (atraso.current !== null) {
      clearTimeout(atraso.current)
      atraso.current = null
    }
    if (repeticao.current !== null) {
      clearInterval(repeticao.current)
      repeticao.current = null
    }
  }
  useEffect(() => parar, [])

  const andar = (sentido: 1 | -1) => {
    const passo = () => {
      const proximo = Math.min(max, Math.max(min, atual.current + sentido * step))
      if (proximo === atual.current) return parar()
      atual.current = proximo
      onChange(proximo)
    }
    parar()
    passo()
    // A pausa antes de embalar é o que separa a batidinha de um passo do arrasto
    // contínuo: sem ela, um clique curto já andava dois.
    atraso.current = window.setTimeout(() => {
      repeticao.current = window.setInterval(passo, 60)
    }, 300)
  }

  const primeiro = invert ? -1 : 1
  return (
    <div className="nudge">
      <button
        type="button"
        className="btn btn--small"
        onPointerDown={() => andar(primeiro as 1 | -1)}
        onPointerUp={parar}
        onPointerLeave={parar}
        onPointerCancel={parar}
      >
        {labels[0]}
      </button>
      <button
        type="button"
        className="nudge__value"
        title="Voltar ao centro"
        onClick={() => {
          parar()
          onChange(0)
        }}
      >
        {value}
        {suffix}
      </button>
      <button
        type="button"
        className="btn btn--small"
        onPointerDown={() => andar((invert ? 1 : -1) as 1 | -1)}
        onPointerUp={parar}
        onPointerLeave={parar}
        onPointerCancel={parar}
      >
        {labels[1]}
      </button>
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

/** Bloco de controles com título — dá âncoras visuais num formulário longo. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="editor-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}
