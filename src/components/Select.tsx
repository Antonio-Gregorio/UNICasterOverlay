import { useMemo } from 'react'
import { Dropdown } from './Dropdown'

export interface SelectOption {
  value: string
  label: string
  /** Cabeçalho da seção onde a opção aparece. */
  group?: string
  /** Bandeira, logo, amostra de cor — o que ajudar a reconhecer a opção. */
  icon?: React.ReactNode
  /** Texto secundário à direita do rótulo. */
  hint?: string
  /** Termos extras que a busca também casa (sigla, nome alternativo). */
  keywords?: string
}

/**
 * O dropdown do projeto. Todo campo de escolha usa este componente — inclusive
 * os que caberiam num `<select>` nativo — porque o nativo não tem busca, e
 * listas como o roster de 28 personagens ou 55 países são inviáveis sem ela.
 */
export function Select({
  id,
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  emptyIcon,
  disabled,
  searchPlaceholder,
  onCustom,
  onCommit,
}: {
  id?: string
  options: SelectOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
  /** Rótulo da opção que limpa a seleção. Omitido = seleção obrigatória. */
  emptyLabel?: string
  emptyIcon?: React.ReactNode
  disabled?: boolean
  searchPlaceholder?: string
  /**
   * Aceita texto que não está na lista. Com isto, o campo passa a oferecer
   * "Usar «texto»" e o Enter cria em vez de não fazer nada.
   */
  onCustom?: (text: string) => void
  /** Chamado depois de escolher — serve para pular para o campo seguinte. */
  onCommit?: () => void
}) {
  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value])

  const trigger = selected ? (
    <>
      {selected.icon}
      <span className="picker__label">{selected.label}</span>
    </>
  ) : (
    <span className="picker__label picker__label--empty">{placeholder}</span>
  )

  return (
    <Dropdown
      id={id}
      disabled={disabled}
      trigger={trigger}
      searchPlaceholder={searchPlaceholder}
      onEnter={(text) => {
        const query = text.toLowerCase()
        const match = options.find((o) => `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(query))
        // Casou na lista: vale o primeiro da busca. Não casou e o campo aceita
        // texto livre: vale o que foi digitado.
        if (match) onChange(match.value)
        else if (onCustom && text) onCustom(text)
        else return false
        onCommit?.()
        return true
      }}
    >
      {(query, close) => {
        const matches = query
          ? options.filter((o) => `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(query))
          : options

        // Agrupa preservando a ordem em que os grupos aparecem nas opções.
        const groups: { label?: string; items: SelectOption[] }[] = []
        for (const option of matches) {
          const last = groups[groups.length - 1]
          if (last && last.label === option.group) last.items.push(option)
          else groups.push({ label: option.group, items: [option] })
        }

        return (
          <>
            {emptyLabel && !query && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === null}
                  className={`picker__option picker__option--empty${value === null ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(null)
                    close()
                    onCommit?.()
                  }}
                >
                  {emptyIcon}
                  <span>{emptyLabel}</span>
                </button>
              </li>
            )}
            {matches.length === 0 && !(onCustom && query) && (
              <li className="picker__none">Nada encontrado.</li>
            )}
            {onCustom && query && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="picker__option picker__option--custom"
                  onClick={() => {
                    onCustom(query)
                    close()
                    onCommit?.()
                  }}
                >
                  <span className="picker__label">Usar «{query}»</span>
                </button>
              </li>
            )}
            {groups.map((group, i) => (
              <li key={group.label ?? `_${i}`}>
                {group.label && <p className="picker__group">{group.label}</p>}
                <ul>
                  {group.items.map((option) => (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={option.value === value}
                        className={`picker__option${option.value === value ? ' is-selected' : ''}`}
                        onClick={() => {
                          onChange(option.value)
                          close()
                          onCommit?.()
                        }}
                      >
                        {option.icon}
                        <span className="picker__label">{option.label}</span>
                        {option.hint && <span className="picker__hint">{option.hint}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </>
        )
      }}
    </Dropdown>
  )
}
