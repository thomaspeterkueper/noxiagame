import MoonSurfaceTransportPlanner from './MoonSurfaceTransportPlanner'
import MoonAscentShuttlePanel from './MoonAscentShuttlePanel'
import ShackletonSurfaceMap from './ShackletonSurfaceMap'

export const metadata = {
  title: 'NOXIA Moon · Shackleton',
}

export default function MoonPage() {
  return <>
    <ShackletonSurfaceMap />
    <MoonSurfaceTransportPlanner />
    <MoonAscentShuttlePanel />
  </>
}
