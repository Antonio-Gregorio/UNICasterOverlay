import { TeamsTab } from '../components/TeamsTab'
import { ScreenHeader } from './ScreenHeader'

export function TeamsScreen() {
  return (
    <>
      <ScreenHeader title="Times" subtitle="Times com sigla e logo, usados nos cadastros de player." />
      <TeamsTab />
    </>
  )
}
