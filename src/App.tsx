import { NavLink, Outlet } from 'react-router-dom'
import {
  NavCharacters,
  NavLogos,
  NavPlayers,
  NavTeams,
  NavAnimation,
  NavBracket,
  NavOverlay,
  NavTopbar,
  NavWinners,
} from './components/icons'
import { DataProvider } from './data'

const SECTIONS = [
  {
    title: 'Cadastros',
    items: [
      { to: '/personagens', label: 'Personagens', icon: <NavCharacters /> },
      { to: '/players', label: 'Players', icon: <NavPlayers /> },
      { to: '/times', label: 'Times', icon: <NavTeams /> },
      { to: '/logos', label: 'Logos', icon: <NavLogos /> },
    ],
  },
  {
    title: 'Arte',
    items: [
      { to: '/topbar', label: 'Topbar', icon: <NavTopbar /> },
      { to: '/winners', label: 'Winners', icon: <NavWinners /> },
      { to: '/animacoes', label: 'Animações', icon: <NavAnimation /> },
      // A tela de chaves virou editor de visual como as outras três: o torneio e
      // quem joga nele passaram para o painel do overlay, que é onde se está
      // durante a transmissão.
      { to: '/chaves', label: 'Chaves', icon: <NavBracket /> },
    ],
  },
  {
    title: 'Transmissão',
    items: [
      { to: '/overlay', label: 'Overlay', icon: <NavOverlay /> },
    ],
  },
]

/** Casca do sistema: menu lateral fixo e a tela corrente ao lado. */
export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <strong>UNICompSlide</strong>
          <span>UNDER NIGHT IN-BIRTH II</span>
        </div>
        {SECTIONS.map((section) => (
          <nav key={section.title} className="sidebar__group">
            <p className="sidebar__title">{section.title}</p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              >
                <span className="sidebar__icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        ))}
      </aside>

      <main className="content">
        <DataProvider>
          <Outlet />
        </DataProvider>
      </main>
    </div>
  )
}
