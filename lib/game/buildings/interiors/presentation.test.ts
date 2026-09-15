import {
  LABORATORY_STANDARD_INTERIOR,
  ORBITAL_TRANSFER_STATION_INTERIOR,
  PRESSURIZED_HABITAT_CLUSTER_INTERIOR,
  buildInteriorTemplateOverview,
  getInteriorTemplateForBuildingType,
  getInteriorTemplateForStationRole,
  projectPersistedBuildingInteriorHost,
  projectPersistedBuildingInteriorHosts,
} from './index'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const overview = buildInteriorTemplateOverview(LABORATORY_STANDARD_INTERIOR)

assert(overview.templateId === LABORATORY_STANDARD_INTERIOR.id, 'overview must preserve template identity')
assert(overview.levels.length === 2, 'laboratory overview must expose both levels')
assert(overview.levels[0].order === 0, 'overview levels must be sorted by order')

const analysisRoom = overview.levels
  .flatMap(level => level.rooms)
  .find(room => room.id === 'analysis-lab')

assert(Boolean(analysisRoom), 'overview must expose analysis room')
assert(
  analysisRoom?.capabilities.some(capability => capability.id === 'research.spectroscopy.raman-ir') === true,
  'overview must expose canonical Raman/IR capability',
)
assert(
  analysisRoom?.functions.some(fn => fn.id === 'sample.raman-ir-analysis') === true,
  'overview must expose resolved Raman/IR room function',
)
assert(!('presentCount' in (analysisRoom ?? {})), 'template overview must not invent runtime room presence')
assert(!('operationalState' in (analysisRoom ?? {})), 'template overview must not invent runtime room state')

for (const role of ['habitat-transfer-station', 'free-port', 'orbital-depot']) {
  const stationTemplate = getInteriorTemplateForStationRole(role)
  assert(
    stationTemplate?.id === ORBITAL_TRANSFER_STATION_INTERIOR.id,
    `station role ${role} must resolve to the shared orbital transfer-station topology`,
  )
}
assert(
  getInteriorTemplateForStationRole('unknown-station-role') === null,
  'unknown station roles must fail closed instead of inventing an interior topology',
)

const stationOverview = buildInteriorTemplateOverview(ORBITAL_TRANSFER_STATION_INTERIOR)
const dockingRoom = stationOverview.levels.flatMap(level => level.rooms).find(room => room.id === 'dock-airlock')
assert(Boolean(dockingRoom), 'station overview must expose docking airlock')
assert(
  dockingRoom?.capabilities.some(capability => capability.id === 'station.docking') === true,
  'station overview must expose docking as facility capability',
)
assert(!('docked' in (dockingRoom ?? {})), 'station presentation must not infer authoritative docking state')
assert(!('unlocked' in (dockingRoom ?? {})), 'station presentation must not infer player unlock state')

const habitatTemplate = getInteriorTemplateForBuildingType('habitat_cluster')
assert(
  habitatTemplate?.id === PRESSURIZED_HABITAT_CLUSTER_INTERIOR.id,
  'canonical habitat_cluster building type must resolve to the shared pressurized habitat topology',
)
assert(
  getInteriorTemplateForBuildingType('unknown_habitat_type') === null,
  'unknown building types must fail closed instead of borrowing a habitat topology',
)

const habitatOverview = buildInteriorTemplateOverview(PRESSURIZED_HABITAT_CLUSTER_INTERIOR)
const commons = habitatOverview.levels.flatMap(level => level.rooms).find(room => room.id === 'commons')
assert(Boolean(commons), 'habitat overview must expose commons')
assert(
  commons?.capabilities.some(capability => capability.id === 'crew.habitation') === true,
  'habitat commons must expose habitation as a physical facility capability',
)
assert(!('population' in (commons ?? {})), 'habitat template presentation must not invent population state')
assert(!('pressureKPa' in (commons ?? {})), 'habitat template presentation must not invent environmental telemetry')
assert(!('circadian' in (commons ?? {})), 'habitat template presentation must not invent temporal-ecology state')

const persistedHabitat = projectPersistedBuildingInteriorHost({
  id: 'persisted-tharsis-host-uuid',
  entity_id: 'habitat_cluster',
})
assert(Boolean(persistedHabitat), 'persisted habitat_cluster must resolve as an interior-capable Core host')
assert(
  persistedHabitat?.hostId === 'persisted-tharsis-host-uuid',
  'persisted host projection must preserve the authoritative Core entity id',
)
assert(
  persistedHabitat?.template.id === PRESSURIZED_HABITAT_CLUSTER_INTERIOR.id,
  'persisted habitat host must resolve through the shared registry',
)
assert(
  projectPersistedBuildingInteriorHost({ id: 'unknown-host', entity_id: 'command_centre' }) === null,
  'unmapped persisted building types must remain unresolved instead of guessing a topology',
)
assert(
  projectPersistedBuildingInteriorHost({ id: '   ', entity_id: 'habitat_cluster' }) === null,
  'empty persisted Core identities must never become interior hosts',
)

const projectedHosts = projectPersistedBuildingInteriorHosts([
  { id: 'hab-a', entity_id: 'habitat_cluster' },
  { id: 'command-a', entity_id: 'command_centre' },
  { id: 'hab-b', entity_id: 'habitat_cluster' },
])
assert(projectedHosts.length === 2, 'host collection projection must include only explicitly mapped building types')
assert(projectedHosts[0].hostId === 'hab-a' && projectedHosts[1].hostId === 'hab-b', 'host projection must preserve Core result order')
assert(!('population' in persistedHabitat!), 'persisted host projection must not copy or invent population state')
assert(!('x_m' in persistedHabitat!), 'persisted host projection must not duplicate spatial coordinates')

console.log('interior presentation tests passed')
