import EarthRegionPreview from './EarthRegionPreview'
import EarthInfrastructurePlanner from './EarthInfrastructurePlanner'
import EarthLandmarkMap from './EarthLandmarkMap'
import EarthLandmarkExplorer from './EarthLandmarkExplorer'
import EarthSurfaceLiveMap from './EarthSurfaceLiveMap'
import EarthSurfaceLogisticsConsole from './EarthSurfaceLogisticsConsole'
import EarthSurfaceMissionDraftPanel from './EarthSurfaceMissionDraftPanel'
import EarthVehicleStagingPanel from './EarthVehicleStagingPanel'
import SpaceportAreaComparison from './SpaceportAreaComparison'

export const metadata = {
  title: 'NOXIA Earth · Sauerland',
}

export default function EarthPage() {
  return <>
    <EarthRegionPreview />
    <EarthInfrastructurePlanner />
    <EarthLandmarkMap />
    <EarthLandmarkExplorer />
    <EarthSurfaceLiveMap />
    <EarthVehicleStagingPanel />
    <EarthSurfaceLogisticsConsole />
    <EarthSurfaceMissionDraftPanel />
    <SpaceportAreaComparison />
  </>
}
