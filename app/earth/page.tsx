import EarthRegionPreview from './EarthRegionPreview'
import EarthSurfaceLogisticsConsole from './EarthSurfaceLogisticsConsole'
import EarthSurfaceVehicleTracker from './EarthSurfaceVehicleTracker'
import SpaceportAreaComparison from './SpaceportAreaComparison'

export const metadata = {
  title: 'NOXIA Earth · Sauerland',
}

export default function EarthPage() {
  return <>
    <EarthRegionPreview />
    <EarthSurfaceLogisticsConsole />
    <EarthSurfaceVehicleTracker />
    <SpaceportAreaComparison />
  </>
}