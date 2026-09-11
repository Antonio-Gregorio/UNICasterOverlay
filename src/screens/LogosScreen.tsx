import { LogosTab } from '../components/LogosTab'
import { ScreenHeader } from './ScreenHeader'

export function LogosScreen() {
  return (
    <>
      <ScreenHeader title="Logos" subtitle="Logos de evento, usadas nas artes." />
      <LogosTab />
    </>
  )
}
