/** Rótulo + dica + mensagem de erro em volta de um controle de formulário. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}
        {hint && <span className="field__hint">{hint}</span>}
      </label>
      {children}
      {error && <p className="field__error">{error}</p>}
    </div>
  )
}
