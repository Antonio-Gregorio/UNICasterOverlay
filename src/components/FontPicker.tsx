import { Select } from './Select'
import { ChevronLeft, ChevronRight } from './icons'
import { FONT_STACKS } from '../topbar/store'

/**
 * Seletor de fonte com setas ao lado.
 *
 * Escolher fonte é comparar, não procurar: com a lista em 26 opções, abrir o
 * seletor a cada tentativa para ver como fica no preview é caro. As setas passam
 * de uma para a outra e o gráfico redesenha a cada clique. O "Aa" ao lado mostra
 * a fonte atual sem precisar olhar para a peça.
 */
export function FontPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const index = FONT_STACKS.findIndex((f) => f.value === value)
  const step = (delta: number) => {
    // Fonte de fora da lista (template antigo) cai no começo em vez de travar.
    const from = index < 0 ? 0 : index
    const next = (from + delta + FONT_STACKS.length) % FONT_STACKS.length
    onChange(FONT_STACKS[next].value)
  }

  return (
    <div className="font-picker">
      <Select
        id={id}
        options={FONT_STACKS.map((f) => ({ value: f.value, label: f.label }))}
        value={value}
        onChange={(v) => v && onChange(v)}
        placeholder="Selecione a fonte"
        searchPlaceholder="Buscar fonte..."
      />
      <span className="font-picker__sample" style={{ fontFamily: value }} aria-hidden="true">
        Aa
      </span>
      <button
        type="button"
        className="icon-btn"
        onClick={() => step(-1)}
        aria-label="Fonte anterior"
        title="Fonte anterior"
      >
        <ChevronLeft />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => step(1)}
        aria-label="Próxima fonte"
        title="Próxima fonte"
      >
        <ChevronRight />
      </button>
    </div>
  )
}
