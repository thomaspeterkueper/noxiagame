import EarthRegionPreview from './EarthRegionPreview'
import EarthSurfaceLiveMap from './EarthSurfaceLiveMap'
import EarthSurfaceLogisticsConsole from './EarthSurfaceLogisticsConsole'
import EarthVehicleStagingPanel from './EarthVehicleStagingPanel'
import SpaceportAreaComparison from './SpaceportAreaComparison'

export const metadata = {
  title: 'NOXIA Earth · Sauerland',
}

export default function EarthPage() {
  return <>
    <EarthRegionPreview />
    <EarthSurfaceLiveMap />
    <EarthVehicleStagingPanel />
    <EarthSurfaceLogisticsConsole />
    <SpaceportAreaComparison />
  </>
}
