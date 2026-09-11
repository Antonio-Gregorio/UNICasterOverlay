import { BADGE_HEIGHT, FLAG_ASPECT } from './Flag'

/**
 * Logo do time desenhada na mesma caixa de uma bandeira — mesma altura, mesma
 * proporção 4:3, encaixada por `contain`.
 *
 * Logo e bandeira aparecem lado a lado e dizem a mesma coisa ("de onde vem esse
 * player"), então precisam ler como insígnias irmãs. O único lugar que foge
 * disso é o formulário de time, onde a imagem é o objeto sendo editado e ganha
 * um preview grande.
 */
export function TeamLogo({
  logo,
  label,
  height = BADGE_HEIGHT,
}: {
  logo: string | null
  label: string
  height?: number
}) {
  const size = { width: height * FLAG_ASPECT, height }

  if (!logo) {
    return (
      <span
        className="team-logo team-logo--empty"
        style={{ ...size, fontSize: Math.max(8, Math.round(height * 0.4)) }}
        title={label}
      >
        {label.slice(0, 3).toUpperCase()}
      </span>
    )
  }
  return <img className="team-logo" style={size} src={logo} alt={label} title={label} />
}
