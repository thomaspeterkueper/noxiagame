import { createInteriorForBuildingInstance } from '../buildings/interiors/bindings'
import { projectPersistedBuildingInteriorHost, type PersistedBuildingHostSource } from '../buildings/interiors/persistedHosts'
import type { InteriorBindingResult } from '../buildings/interiors/bindings'
import { DAVARU_TEMPLE_DESTINATION } from './sharedTempleAccess'

/** Fail closed unless Core supplies an actual persisted DaVaRu building. */
export function resolvePersistedDavaruTempleBuilding(
  source: PersistedBuildingHostSource | null,
): InteriorBindingResult | null {
  if (!source || source.entity_id !== 'davaru_temple') return null
  const projected = projectPersistedBuildingInteriorHost(source)
  if (!projected || !projected.hostId) return null
  return createInteriorForBuildingInstance(
    { id: projected.hostId, buildingTypeId: projected.buildingTypeId },
    { interiorInstanceId: 'interior:' + DAVARU_TEMPLE_DESTINATION + ':' + projected.hostId },
  )
}
