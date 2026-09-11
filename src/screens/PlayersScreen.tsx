import { PlayersTab } from '../components/PlayersTab'
import { useData } from '../data'
import { ScreenHeader } from './ScreenHeader'

export function PlayersScreen() {
  const data = useData()
  return (
    <>
      <ScreenHeader title="Players" subtitle="Quem joga: personagem, time e bandeiras." />
      <PlayersTab characters={data.characters} flags={data.flags} mocks={data.mocks} />
    </>
  )
}
