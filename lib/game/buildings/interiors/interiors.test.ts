import {
  LABORATORY_STANDARD_INTERIOR,
  ORBITAL_TRANSFER_STATION_INTERIOR,
  countPresenceByRoom,
  createInteriorForBuildingInstance,
  createInteriorForStationInstance,
  createInteriorInstance,
  createInteriorPortalAccessPredicate,
  evaluateInteriorPortalAccess,
  findInteriorRoute,
  getInteriorFunctionDomainBinding,
  isPortalTraversable,
  projectCoreAssignmentsToInteriorHost,
  projectExplicitRoomPresence,
  resolveRoomFunctions,
  validateInteriorFunctionInvocation,
  validateInteriorInstance,
  validateInteriorTemplate,
  type InteriorPresenceProjection,
} from './index'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

assert(validateInteriorTemplate(LABORATORY_STANDARD_INTERIOR).length === 0, 'laboratory template must validate')
assert(validateInteriorTemplate(ORBITAL_TRANSFER_STATION_INTERIOR).length === 0, 'station template must validate')

const lab = createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
  id: 'INT:LAB:TEST',
  buildingInstanceId: 'BLD:LAB:TEST',
})
assert(validateInteriorInstance(LABORATORY_STANDARD_INTERIOR, lab).length === 0, 'laboratory instance must validate')
assert(Object.values(lab.roomStates).every(room => room.presentCount === 0), 'room presence must initialize as derived zero count')
assert(!('ownerId' in lab), 'interior instance must not duplicate ownership')
assert(!('locationId' in lab), 'interior instance must not duplicate broad location')
assert(!('currentNodeInventoryId' in lab), 'interior instance must not duplicate Core node binding')

const route = findInteriorRoute(LABORATORY_STANDARD_INTERIOR, lab, 'airlock', 'analysis-lab')
assertEqual(route?.rooms, ['airlock', 'corridor-0', 'analysis-lab'], 'laboratory route must use shared topology')
lab.portalStates['p-corridor-analysis'].state = 'locked'
assert(!isPortalTraversable(lab, 'p-corridor-analysis'), 'locked portal must be non-traversable')
assert(findInteriorRoute(LABORATORY_STANDARD_INTERIOR, lab, 'airlock', 'analysis-lab') === null, 'locked portal must block route')

const accessTemplate = {
  ...LABORATORY_STANDARD_INTERIOR,
  id: 'laboratory-access-test',
  portals: LABORATORY_STANDARD_INTERIOR.portals.map(portal =>
    portal.id === 'p-corridor-analysis' ? { ...portal, accessTags: ['lab.secure'] } : portal,
  ),
}
const accessLab = createInteriorInstance(accessTemplate, {
  id: 'INT:LAB:ACCESS',
  buildingInstanceId: 'BLD:LAB:ACCESS',
})
const deniedAccess = { subjectId: 'PERSON:VISITOR', grantedTags: [], source: 'core-policy-test' }
const secureAccess = { subjectId: 'PERSON:TECH', grantedTags: ['lab.secure'], source: 'core-policy-test' }
assert(
  evaluateInteriorPortalAccess(accessTemplate, accessLab, 'p-corridor-analysis', deniedAccess).reason === 'missing-required-access-tag',
  'restricted portal must reject missing authoritative access tag',
)
assert(
  evaluateInteriorPortalAccess(accessTemplate, accessLab, 'p-corridor-analysis', secureAccess).allowed,
  'restricted portal must accept an externally granted authoritative access tag',
)
assert(
  findInteriorRoute(accessTemplate, accessLab, 'airlock', 'analysis-lab', {
    canUsePortal: createInteriorPortalAccessPredicate(accessTemplate, accessLab, deniedAccess),
  }) === null,
  'access policy must be able to restrict navigation',
)
assert(
  findInteriorRoute(accessTemplate, accessLab, 'airlock', 'analysis-lab', {
    canUsePortal: createInteriorPortalAccessPredicate(accessTemplate, accessLab, secureAccess),
  }) !== null,
  'authorized subject must be able to route through operational restricted portal',
)
accessLab.portalStates['p-corridor-analysis'].state = 'locked'
assert(
  evaluateInteriorPortalAccess(accessTemplate, accessLab, 'p-corridor-analysis', secureAccess).reason === 'portal-not-traversable',
  'authorization must not override locked portal state',
)
assert(
  findInteriorRoute(accessTemplate, accessLab, 'airlock', 'analysis-lab', {
    canUsePortal: () => true,
  }) === null,
  'navigation callback must never override locked/blocked/failed portal state',
)

const buildingBinding = createInteriorForBuildingInstance(
  { id: 'BLD:LAB:BIND', buildingTypeId: 'laboratory' },
  { interiorInstanceId: 'INT:LAB:BIND' },
)
assert(buildingBinding?.interior.host.kind === 'building', 'building binding must use building host')

const stationBinding = createInteriorForStationInstance(
  { id: 'STA:TEST', stationSlug: 'test' },
  ORBITAL_TRANSFER_STATION_INTERIOR,
  'INT:STA:TEST',
)
assert(stationBinding.interior.host.kind === 'station', 'station binding must use station host')
assert(stationBinding.interior.buildingInstanceId === undefined, 'station must not pretend to be a building')
assert(findInteriorRoute(ORBITAL_TRANSFER_STATION_INTERIOR, stationBinding.interior, 'dock-airlock', 'depot') !== null, 'station must use shared navigation')

const analysisRoom = LABORATORY_STANDARD_INTERIOR.rooms.find(room => room.id === 'analysis-lab')
assert(Boolean(analysisRoom), 'analysis room must exist')
const analysisFunctions = resolveRoomFunctions(analysisRoom!).functions.map(definition => definition.id)
assert(analysisFunctions.includes('sample.raman-ir-analysis'), 'analysis room must expose Raman/IR function')

const ramanBinding = getInteriorFunctionDomainBinding('sample.raman-ir-analysis')
assert(Boolean(ramanBinding), 'Raman/IR function must have authoritative-domain binding')
assertEqual(ramanBinding?.requiredInputs, ['sample', 'instrument'], 'Raman/IR requires sample and instrument')
assertEqual(ramanBinding?.expectedOutputs, ['measurement', 'raw-data'], 'Raman/IR yields measurement and raw data references')

const reanalysisBinding = getInteriorFunctionDomainBinding('data.reanalyse')
assertEqual(reanalysisBinding?.requiredInputs, ['raw-data'], 'data reanalysis must require stored raw data only')
assert(reanalysisBinding?.expectedOutputs?.includes('interpretation') === true, 'reanalysis may produce interpretation')
assert(reanalysisBinding?.expectedOutputs?.includes('discovery') === true, 'reanalysis may produce discovery')

const invocationOk = validateInteriorFunctionInvocation(LABORATORY_STANDARD_INTERIOR, createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
  id: 'INT:LAB:INVOCATION',
  buildingInstanceId: 'BLD:LAB:INVOCATION',
}), {
  interiorInstanceId: 'INT:LAB:INVOCATION',
  roomId: 'analysis-lab',
  functionId: 'sample.raman-ir-analysis',
  objectRefs: [
    { kind: 'sample', id: 'SAMPLE:001' },
    { kind: 'instrument', id: 'INSTRUMENT:RAMAN:001' },
  ],
})
assert(invocationOk.length === 0, 'valid Raman/IR invocation must hand off cleanly')

const invocationMissingInstrument = validateInteriorFunctionInvocation(LABORATORY_STANDARD_INTERIOR, createInteriorInstance(LABORATORY_STANDARD_INTERIOR, {
  id: 'INT:LAB:INVOCATION:BAD',
  buildingInstanceId: 'BLD:LAB:INVOCATION:BAD',
}), {
  interiorInstanceId: 'INT:LAB:INVOCATION:BAD',
  roomId: 'analysis-lab',
  functionId: 'sample.raman-ir-analysis',
  objectRefs: [{ kind: 'sample', id: 'SAMPLE:001' }],
})
assert(invocationMissingInstrument.some(issue => issue.code === 'missing-required-domain-object'), 'analysis without instrument must be rejected')

const presence: InteriorPresenceProjection = {
  personId: 'PERSON:001',
  host: { kind: 'building', id: 'BLD:LAB:TEST' },
  roomId: 'analysis-lab',
  source: 'live-presence',
}
assert(!('roleId' in presence), 'room presence must not duplicate person assignment role')
assert(!('locationId' in presence), 'room presence must not become broad person location')

const coreAssignments = projectCoreAssignmentsToInteriorHost(
  { kind: 'building', id: 'BLD:LAB:TEST' },
  [
    { personId: 'PERSON:WORKER', tileEntityId: 'BLD:LAB:TEST', assignmentType: 'work', roleCode: 'lab-tech' },
    { personId: 'PERSON:OTHER', tileEntityId: 'BLD:OTHER', assignmentType: 'work' },
  ],
)
assertEqual(coreAssignments.map(item => item.personId), ['PERSON:WORKER'], 'Core assignments must filter by authoritative tile entity host')
assert(coreAssignments[0].source === 'core.person_assignments', 'host assignment projection must preserve Core provenance')
assert(!('roomId' in coreAssignments[0]), 'durable building assignment must not invent room presence')
assert(!('locationId' in coreAssignments[0]), 'building assignment projection must not duplicate broad location')
assert(!('occurredAt' in coreAssignments[0]), 'assignment projection must not invent event time')

const stationAssignments = projectCoreAssignmentsToInteriorHost(
  { kind: 'station', id: 'STA:TEST' },
  [{ personId: 'PERSON:WORKER', tileEntityId: 'STA:TEST', assignmentType: 'work' }],
)
assertEqual(stationAssignments, [], 'tile-entity person assignments must not be reinterpreted as station assignments')

const explicitPresence = projectExplicitRoomPresence(
  { kind: 'building', id: 'BLD:LAB:TEST' },
  [
    { personId: 'PERSON:001', host: { kind: 'building', id: 'BLD:LAB:TEST' }, roomId: 'analysis-lab', source: 'live-presence' },
    { personId: 'PERSON:002', host: { kind: 'building', id: 'BLD:LAB:TEST' }, roomId: 'analysis-lab', source: 'live-presence' },
    { personId: 'PERSON:003', host: { kind: 'building', id: 'BLD:OTHER' }, roomId: 'analysis-lab', source: 'live-presence' },
  ],
)
assertEqual(explicitPresence.map(item => item.personId), ['PERSON:001', 'PERSON:002'], 'room presence must require explicit matching host presence')
assertEqual(countPresenceByRoom(explicitPresence), { 'analysis-lab': 2 }, 'presentCount projection must derive only from explicit presence records')

console.log('shared interior domain tests passed')
