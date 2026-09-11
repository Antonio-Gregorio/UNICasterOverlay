import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import App from './App'
import { DataProvider } from './data'
import { CharactersScreen } from './screens/CharactersScreen'
import { PlayersScreen } from './screens/PlayersScreen'
import { TeamsScreen } from './screens/TeamsScreen'
import { LogosScreen } from './screens/LogosScreen'
import { TopbarListScreen } from './screens/TopbarListScreen'
import { TopbarEditorScreen } from './screens/TopbarEditorScreen'
import { WinnersListScreen } from './screens/WinnersListScreen'
import { WinnersEditorScreen } from './screens/WinnersEditorScreen'
import { WinnersGenerateScreen } from './screens/WinnersGenerateScreen'
import { AnimListScreen } from './screens/AnimListScreen'
import { AnimEditorScreen } from './screens/AnimEditorScreen'
import { BracketListScreen } from './screens/BracketListScreen'
import { BracketEditorScreen } from './screens/BracketEditorScreen'
import { OverlayListScreen } from './screens/OverlayListScreen'
import { OverlayScreen } from './screens/OverlayScreen'
import { OverlayLiveScreen } from './screens/OverlayLiveScreen'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/personagens" replace /> },
      { path: 'personagens', element: <CharactersScreen /> },
      { path: 'players', element: <PlayersScreen /> },
      { path: 'times', element: <TeamsScreen /> },
      { path: 'logos', element: <LogosScreen /> },
      { path: 'topbar', element: <TopbarListScreen /> },
      { path: 'topbar/novo', element: <TopbarEditorScreen /> },
      { path: 'topbar/:id', element: <TopbarEditorScreen /> },
      { path: 'winners', element: <WinnersListScreen /> },
      { path: 'winners/novo', element: <WinnersEditorScreen /> },
      { path: 'winners/:id', element: <WinnersEditorScreen /> },
      { path: 'winners/:id/gerar', element: <WinnersGenerateScreen /> },
      { path: 'animacoes', element: <AnimListScreen /> },
      { path: 'animacoes/novo', element: <AnimEditorScreen /> },
      { path: 'animacoes/:id', element: <AnimEditorScreen /> },
      { path: 'chaves', element: <BracketListScreen /> },
      { path: 'chaves/novo', element: <BracketEditorScreen /> },
      { path: 'chaves/:id', element: <BracketEditorScreen /> },
      { path: 'overlay', element: <OverlayListScreen /> },
      /*
       * O painel é a **mesma** rota para todos os overlays: trocar de um para
       * outro troca só o id da rota, o componente continua montado e a conexão com o
       * OBS nem fica sabendo — ver obsLink em src/overlay/obs.ts.
       */
      { path: 'overlay/novo', element: <OverlayScreen /> },
      { path: 'overlay/:id', element: <OverlayScreen /> },
    ],
  },
  // Fora da casca do sistema: o OBS carrega só as barras, sem menu nem fundo.
  { path: '/overlay/live', element: <OverlayLive /> },
  // No GitHub Pages o site mora em /UNICasterOverlay/; em dev, na raiz.
], { basename: import.meta.env.BASE_URL })

/** O OBS carrega só as barras: sem menu e sem fundo, mas com os dados. */
function OverlayLive() {
  return (
    <DataProvider>
      <OverlayLiveScreen />
    </DataProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
