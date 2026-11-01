import type { LocalSurfaceBuilding, LocalSurfacePoint } from './localSurfaceScene'
import { distanceToBuildingFootprint } from './localSceneRuntime'

/**
 * POIs are usually mapped to the centre of a real building. Walking into the
 * building is blocked by collision, so centre-distance cannot gate entry.
 * Only associate a POI with a footprint when its mapped point lies inside
 * (or within 3 m of) that footprint; never borrow an unrelated nearby house.
 */
export function landmarkEntryDistance(
  player: LocalSurfacePoint,
  poi: LocalSurfacePoint,
  buildings: readonly LocalSurfaceBuilding[],
): number {
  const host = buildings
    .filter(building => distanceToBuildingFootprint(poi, building) <= 3)
    .sort((a, b) =>
      Math.hypot(a.center.xM - poi.xM, a.center.yM - poi.yM) -
      Math.hypot(b.center.xM - poi.xM, b.center.yM - poi.yM),
    )[0]
  return host ? distanceToBuildingFootprint(player, host) : Math.hypot(player.xM - poi.xM, player.yM - poi.yM)
}
