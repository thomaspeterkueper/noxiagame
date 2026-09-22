import {
  assessEarthSpaceportHandover,
  buildEarthSurfaceHandoverChain,
  classifyEarthSurfaceNode,
  describeEarthSurfaceInventory,
  type EarthSurfaceInventoryNodeInput,
} from './earthSurfaceHandover'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const mine: EarthSurfaceInventoryNodeInput = {
  id: 'inv-mine',
  label: 'Kupfermine · Facility',
  inventory_kind: 'facility',
  metadata: { role: 'extraction', buildingType: 'mine' },
}

const hub: EarthSurfaceInventoryNodeInput = {
  id: 'inv-hub',
  label: 'Logistik-Hub · Depot',
  inventory_kind: 'depot',
  metadata: { role: 'logistics', buildingType: 'logistics_hub' },
}

const spaceportStorage: EarthSurfaceInventoryNodeInput = {
  id: 'inv-spaceport-storage',
  label: 'Raumhafenlager · Depot',
  inventory_kind: 'depot',
  metadata: { role: 'spaceport_storage', buildingType: 'spaceport_storage' },
}

const pad: EarthSurfaceInventoryNodeInput = {
  id: 'inv-pad',
  label: 'Landing Pad · Shuttle-Port',
  inventory_kind: 'surface_port',
  metadata: { role: 'shuttle_port', buildingType: 'landing_pad' },
}

const locationStock: EarthSurfaceInventoryNodeInput = {
  id: 'inv-location',
  label: 'Earth · Standortbestand',
  inventory_kind: 'location',
  storage_kind: 'location_resources',
  metadata: null,
}

assert(classifyEarthSurfaceNode(mine) === 'facility', 'a facility inventory must classify as facility')
assert(classifyEarthSurfaceNode(hub) === 'depot', 'a plain depot must not become a spaceport warehouse')
assert(classifyEarthSurfaceNode(spaceportStorage) === 'spaceport-storage', 'only the Core role metadata marks the spaceport warehouse')
assert(classifyEarthSurfaceNode(pad) === 'surface-port', 'a surface_port inventory is the shuttle handover node')
assert(classifyEarthSurfaceNode(locationStock) === 'location', 'aggregated location stock is not a physical chain node')
assert(classifyEarthSurfaceNode({ id: 'x', label: 'x', inventory_kind: 'unknown-kind' }) === 'other', 'unknown Core kinds must not be guessed')

const described = describeEarthSurfaceInventory(spaceportStorage)
assert(described.purpose === 'spaceport_storage', 'the Core metadata role must be preserved')
assert(described.buildingType === 'spaceport_storage', 'the Core building type must be preserved')

const chain = buildEarthSurfaceHandoverChain([mine, hub, spaceportStorage, pad, locationStock])
assert(chain.facilities.length === 1 && chain.facilities[0].id === 'inv-mine', 'facilities must join the chain')
assert(chain.depots.length === 1 && chain.depots[0].id === 'inv-hub', 'plain depots stay depots')
assert(chain.spaceportStorage.length === 1 && chain.surfacePorts.length === 1, 'spaceport warehouse and pad are separate stops')
assert(!chain.depots.some(node => node.id === 'inv-location'), 'location stock must never appear as a chain stop')

const inactive = buildEarthSurfaceHandoverChain([{ ...pad, active: false }])
assert(inactive.surfacePorts.length === 0, 'inactive Core inventories are not part of the live chain')

const ready = assessEarthSpaceportHandover([mine, hub, spaceportStorage, pad])
assert(ready.state === 'ready', 'warehouse plus pad must assess as ready')
assert(ready.boundary === 'surface-port', 'the Earth chain must end at the surface port')
assert(ready.shuttle?.craftId === 'asce-0.3p', 'the surface transfer shuttle semantics must come from the shared transport domains')

const missingStorage = assessEarthSpaceportHandover([mine, hub, pad])
assert(missingStorage.state === 'storage-missing', 'a pad without the spaceport warehouse is not a complete handover chain')

const missingPort = assessEarthSpaceportHandover([mine, hub, spaceportStorage])
assert(missingPort.state === 'surface-port-missing', 'the warehouse alone is not a shuttle handover')

console.log('earth surface handover tests passed')
