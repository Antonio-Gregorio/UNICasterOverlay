/**
 * Ícones dos controles do editor de topbar.
 *
 * Cada um desenha em miniatura o que a opção faz — a silhueta da barra, o corte
 * da ponta, o traço do contorno. Ler a forma é mais rápido do que ler o rótulo,
 * e o rótulo continua ali para quem usa leitor de tela.
 */

const box = { width: 34, height: 18, viewBox: '0 0 34 18', fill: 'none' } as const
const stroke = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' } as const

export function ShapeStraight() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="1" y="5" width="32" height="8" {...stroke} />
    </svg>
  )
}

export function ShapeNotch() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M1 5h9l3-4h8l3 4h9v8H1z" {...stroke} />
    </svg>
  )
}

export function EdgeSquare() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="3" y="4" width="28" height="10" {...stroke} />
    </svg>
  )
}

export function EdgeRounded() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="3" y="4" width="28" height="10" rx="4" {...stroke} />
    </svg>
  )
}

export function EdgeTaper() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M3 4h28l-5 10H3z" {...stroke} />
    </svg>
  )
}

export function ArrowUp() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M17 14V4m0 0-5 5m5-5 5 5" {...stroke} strokeLinecap="round" />
    </svg>
  )
}

export function ArrowDown() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M17 4v10m0 0 5-5m-5 5-5-5" {...stroke} strokeLinecap="round" />
    </svg>
  )
}

export function FillSolid() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="3" y="4" width="28" height="10" rx="2" fill="currentColor" opacity="0.75" />
    </svg>
  )
}

export function FillGradient() {
  return (
    <svg {...box} aria-hidden="true">
      <defs>
        <linearGradient id="ic-grad" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <rect x="3" y="4" width="28" height="10" rx="2" fill="url(#ic-grad)" />
    </svg>
  )
}

/** Amostra do traço de cada estilo de contorno. */
function Stroke({ dash, cap = 'butt' }: { dash?: string; cap?: 'butt' | 'round' }) {
  return (
    <svg {...box} aria-hidden="true">
      <line
        x1="3"
        y1="9"
        x2="31"
        y2="9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeDasharray={dash}
        strokeLinecap={cap}
      />
    </svg>
  )
}

export const BorderNone = () => (
  <svg {...box} aria-hidden="true">
    <line x1="3" y1="9" x2="31" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    <line x1="8" y1="14" x2="26" y2="4" stroke="currentColor" strokeWidth="1.4" />
  </svg>
)
export const BorderSolid = () => <Stroke />
export const BorderDotted = () => <Stroke dash="0 5" cap="round" />
export const BorderDashed = () => <Stroke dash="7 5" />
export const BorderDashDot = () => <Stroke dash="7 4 0 4" cap="round" />

/** Duas folhas sobrepostas: duplicar. */
export function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 13h6A2.5 2.5 0 0 0 13 10.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/* --- ícones do editor de gráficos --- */

export function ShapeRect() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="10" y="2" width="14" height="14" {...stroke} />
    </svg>
  )
}
export function ShapeRounded() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="10" y="2" width="14" height="14" rx="4" {...stroke} />
    </svg>
  )
}
export function ShapeCircle() {
  return (
    <svg {...box} aria-hidden="true">
      <circle cx="17" cy="9" r="7" {...stroke} />
    </svg>
  )
}
export function ShapeHex() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M17 2l6 3.5v7L17 16l-6-3.5v-7L17 2z" {...stroke} />
    </svg>
  )
}

/** Chanfro no topo, na base, nos dois, ou nenhum. */
export function CutNone() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="10" y="2" width="14" height="14" {...stroke} />
    </svg>
  )
}
export function CutTop() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M10 6l14-4v14H10z" {...stroke} />
    </svg>
  )
}
export function CutBottom() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M10 2h14v10l-14 4z" {...stroke} />
    </svg>
  )
}
export function CutBoth() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M10 6l14-4v10l-14 4z" {...stroke} />
    </svg>
  )
}

/** Alinhamento do título no topo. */
function AlignIcon({ at }: { at: 'left' | 'center' | 'right' }) {
  const x = at === 'left' ? 4 : at === 'center' ? 11 : 18
  return (
    <svg {...box} aria-hidden="true">
      <rect x="1" y="1" width="32" height="16" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <rect x={x} y="6" width="12" height="6" rx="1" fill="currentColor" />
    </svg>
  )
}
export const AlignLeft = () => <AlignIcon at="left" />
export const AlignCenter = () => <AlignIcon at="center" />
export const AlignRight = () => <AlignIcon at="right" />

/** Origem do fundo: preset, cor, degradê ou upload. */
export function BgPreset() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="3" y="2" width="28" height="14" rx="2" {...stroke} />
      <path d="M3 13l7-6 5 5 4-3 12 7H3z" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="6" r="1.8" fill="currentColor" />
    </svg>
  )
}
export function BgUpload() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M17 14V4m0 0-4 4m4-4 4 4" {...stroke} strokeLinecap="round" />
      <path d="M8 16h18" {...stroke} strokeLinecap="round" />
    </svg>
  )
}

/** Insígnia exibida no retrato. */
export function BadgeNone() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="11" y="4" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <line x1="10" y1="15" x2="24" y2="2" {...stroke} />
    </svg>
  )
}
export function BadgeFlag() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="11" y="4" width="12" height="9" rx="1" {...stroke} />
      <path d="M11 8h12" {...stroke} />
    </svg>
  )
}
export function BadgeRegion() {
  return (
    <svg {...box} aria-hidden="true">
      <rect x="11" y="4" width="12" height="9" rx="1" {...stroke} />
      <path d="M14 4v9M20 4v9" {...stroke} />
    </svg>
  )
}
export function BadgeTeam() {
  return (
    <svg {...box} aria-hidden="true">
      <path d="M17 3l6 2.5v4c0 3-2.6 5.5-6 6.5-3.4-1-6-3.5-6-6.5v-4L17 3z" {...stroke} />
    </svg>
  )
}

/** Dado: sortear outra vez os jogadores de exemplo. */
export function DiceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5.2" cy="5.2" r="1.3" fill="currentColor" />
      <circle cx="10.8" cy="10.8" r="1.3" fill="currentColor" />
      <circle cx="10.8" cy="5.2" r="1.3" fill="currentColor" />
      <circle cx="5.2" cy="10.8" r="1.3" fill="currentColor" />
    </svg>
  )
}

/* --- ícones do menu lateral --- */

const nav = { width: 17, height: 17, viewBox: '0 0 20 20', fill: 'none' } as const
const navStroke = {
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Personagem: silhueta de meio-corpo. */
export function NavCharacters() {
  return (
    <svg {...nav} aria-hidden="true">
      <circle cx="10" cy="6.5" r="3.2" {...navStroke} />
      <path d="M3.8 17c0-3.2 2.8-5.2 6.2-5.2s6.2 2 6.2 5.2" {...navStroke} />
    </svg>
  )
}

/** Player: controle de arcade. */
export function NavPlayers() {
  return (
    <svg {...nav} aria-hidden="true">
      <rect x="1.8" y="6" width="16.4" height="9.4" rx="4.2" {...navStroke} />
      <path d="M5.6 9.2v3M4.1 10.7h3M13.4 10.2h.01M15.6 12.2h.01" {...navStroke} />
    </svg>
  )
}

/** Time: escudo. */
export function NavTeams() {
  return (
    <svg {...nav} aria-hidden="true">
      <path d="M10 2.2 16.4 4.6v5c0 4.1-2.8 7-6.4 8.2-3.6-1.2-6.4-4.1-6.4-8.2v-5L10 2.2z" {...navStroke} />
    </svg>
  )
}

/** Logo: moldura com montanha. */
export function NavLogos() {
  return (
    <svg {...nav} aria-hidden="true">
      <rect x="2.2" y="3.6" width="15.6" height="12.8" rx="2.4" {...navStroke} />
      <circle cx="7" cy="8" r="1.4" {...navStroke} />
      <path d="M3.4 14.2 8 9.8l3.2 3 2.4-2.2 3 3" {...navStroke} />
    </svg>
  )
}

/** Topbar: a barra com o nome e o placar. */
export function NavTopbar() {
  return (
    <svg {...nav} aria-hidden="true">
      <rect x="1.6" y="6.4" width="16.8" height="7.2" rx="2.4" {...navStroke} />
      <path d="M5 10h5" {...navStroke} />
      <path d="M14.4 8.6v2.8" {...navStroke} />
    </svg>
  )
}

/** Winners: troféu. */
export function NavWinners() {
  return (
    <svg {...nav} aria-hidden="true">
      <path d="M6.2 2.8h7.6v4.4a3.8 3.8 0 0 1-7.6 0V2.8z" {...navStroke} />
      <path d="M6.2 4.2H3.8v1.2A2.6 2.6 0 0 0 6.4 8M13.8 4.2h2.4v1.2A2.6 2.6 0 0 1 13.6 8" {...navStroke} />
      <path d="M10 11v3.2M7 17.2h6M8.4 14.2h3.2l.6 3H7.8l.6-3z" {...navStroke} />
    </svg>
  )
}

/** Setas de passar item, no formato quadrado dos botões de ícone. */
const chevron = { width: 18, height: 18, viewBox: '0 0 18 18', fill: 'none' } as const

export function ChevronLeft() {
  return (
    <svg {...chevron} aria-hidden="true">
      <path d="M11 4 6 9l5 5" {...stroke} strokeLinecap="round" />
    </svg>
  )
}

export function ChevronRight() {
  return (
    <svg {...chevron} aria-hidden="true">
      <path d="M7 4l5 5-5 5" {...stroke} strokeLinecap="round" />
    </svg>
  )
}

/** Overlay: uma tela com sinal saindo dela. */
export function NavOverlay() {
  return (
    <svg {...nav} aria-hidden="true">
      <rect x="2.6" y="4.4" width="14.8" height="9.6" rx="1.6" {...navStroke} />
      <path d="M7 17.4h6" {...navStroke} />
      <path d="M6.6 9.2a3.4 3.4 0 0 1 3.4-3.4M6.6 11.6a5.8 5.8 0 0 1 5.8-5.8" {...navStroke} />
    </svg>
  )
}

/** Animações: fotograma com o rastro dos quadros seguintes atrás. */
export function NavAnimation() {
  return (
    <svg {...nav} aria-hidden="true">
      <rect x="2.4" y="5" width="10.4" height="10" rx="1.6" {...navStroke} />
      <path d="M15.2 6.8v6.4M17.6 8.4v3.2" {...navStroke} strokeLinecap="round" />
      <path d="M6.6 8.8l3.4 1.9-3.4 1.9z" {...navStroke} strokeLinejoin="round" />
    </svg>
  )
}

/** Chaves: dois pares que se juntam num confronto seguinte. */
export function NavBracket() {
  return (
    <svg {...nav} aria-hidden="true">
      <path d="M3 4.5h4v4h4M3 11h4v4h4" {...navStroke} strokeLinecap="round" />
      <path d="M11 8.5v3h4" {...navStroke} strokeLinecap="round" />
      <path d="M15 9.8h2.6" {...navStroke} strokeLinecap="round" />
    </svg>
  )
}
