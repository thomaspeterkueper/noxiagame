import EarthRegionPreview from './EarthRegionPreview'
import EarthInfrastructurePlanner from './EarthInfrastructurePlanner'
import EarthLandmarkMap from './EarthLandmarkMap'
import EarthLandmarkExplorer from './EarthLandmarkExplorer'
import EarthSurfaceLogisticsConsole from './EarthSurfaceLogisticsConsole'
import EarthSurfaceMissionDraftPanel from './EarthSurfaceMissionDraftPanel'
import EarthVehicleStagingPanel from './EarthVehicleStagingPanel'
import SpaceportAreaComparison from './SpaceportAreaComparison'
import PlayerCivicSignalsPanel from './PlayerCivicSignalsPanel'

export const metadata = {
  title: 'NOXIA Earth · Sauerland',
}

export default function EarthPage() {
  return <>
    <EarthRegionPreview />
    <PlayerCivicSignalsPanel />
    <EarthInfrastructurePlanner />
    <EarthLandmarkMap />
    <EarthLandmarkExplorer />
    <EarthVehicleStagingPanel />
    <EarthSurfaceLogisticsConsole />
    <EarthSurfaceMissionDraftPanel />
    <SpaceportAreaComparison />
  </>
}
