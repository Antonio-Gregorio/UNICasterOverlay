import { CharactersTab } from '../components/CharactersTab'
import { useData } from '../data'
import { ScreenHeader } from './ScreenHeader'

export function CharactersScreen() {
  const data = useData()
  return (
    <>
      <ScreenHeader title="Personagens" subtitle="O roster de UNDER NIGHT IN-BIRTH II Sys:Celes." />
      <CharactersTab characters={data.characters} />
    </>
  )
}
