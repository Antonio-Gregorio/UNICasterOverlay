import { createContext, useContext, useEffect, useState } from 'react'
import { loadCharacters } from './characters'
import { loadFlags } from './flags'
import { loadBackgrounds, type BackgroundPreset } from './winners/backgrounds'
import { loadMockPlayers, type MockPlayer } from './topbar/mockPlayers'
import type { Character, FlagManifest } from './types'

/**
 * Dados estáticos do projeto — roster, bandeiras, fundos e os players de
 * exemplo. Carregados uma vez e servidos por contexto: antes cada tela puxava
 * os mesmos arquivos por conta própria e repetia o trabalho a cada navegação.
 */
export interface AppData {
  characters: Character[]
  flags: FlagManifest
  backgrounds: BackgroundPreset[]
  mocks: MockPlayer[]
}

const DataContext = createContext<AppData | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadCharacters(), loadFlags(), loadBackgrounds(), loadMockPlayers()])
      .then(([characters, flags, backgrounds, mocks]) =>
        setData({ characters, flags, backgrounds, mocks })
      )
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p className="empty">Falha ao carregar os dados: {error}</p>
  if (!data) return <p className="empty">Carregando...</p>
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>
}

export function useData(): AppData {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData fora do DataProvider')
  return data
}
