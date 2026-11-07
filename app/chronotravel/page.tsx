import ChronoTravelExplorer from './ChronoTravelExplorer'
import { HISTORICAL_SCENES } from '@/lib/game/chronotravel/catalogue'

export const metadata = {
  title: 'ChronoTravel | noχ¹ᐃ',
  description: 'Historische VR-Zeitreise: Hippodrom 550, 1200 und 1700',
}
export default function ChronoTravelPage() {
  return <ChronoTravelExplorer scenes={HISTORICAL_SCENES} />
}
