/** Cabeçalho comum das telas: título, descrição e ações à direita. */
export function ScreenHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <header className="screen-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="screen-head__actions">{children}</div>}
    </header>
  )
}
