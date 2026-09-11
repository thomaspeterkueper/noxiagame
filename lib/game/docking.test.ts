import {
  canDockAtPort,
  canReservePort,
  isPortCompatible,
  occupyPort,
  providesPhysicalCargoConnection,
  releasePort,
  reservePort,
  type DockingPort,
  type DockingVessel,
} from './docking'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const shuttle: DockingVessel = {
  id: 'shuttle-1',
  vesselClass: 'surface-transfer-shuttle',
  locationSlug: 'phobos',
}

const heavyFreighter: DockingVessel = {
  id: 'freighter-1',
  vesselClass: 'intersolar-heavy',
  locationSlug: 'phobos',
}

const standardPort: DockingPort = {
  id: 'P-01',
  stationSlug: 'phobos',
  label: 'Port 01',
  portClass: 'standard',
  status: 'available',
}

assert(isPortCompatible('surface-transfer-shuttle', 'standard'), 'shuttle should fit a standard port')
assert(!isPortCompatible('intersolar-heavy', 'standard'), 'heavy freighter must require a heavy port')
assert(canReservePort(standardPort, shuttle), 'available compatible port should be reservable')
assert(!canDockAtPort(standardPort, heavyFreighter), 'heavy freighter must not dock at standard port')

const reserved = reservePort(standardPort, shuttle)
assert(reserved.status === 'reserved', 'reservation should change port status')
assert(reserved.reservedForVesselId === shuttle.id, 'reservation must name the vessel')
assert(canDockAtPort(reserved, shuttle), 'reserved vessel should be allowed to dock')

const occupied = occupyPort(reserved, shuttle)
assert(occupied.status === 'occupied', 'docking should occupy the port')
assert(occupied.occupiedByVesselId === shuttle.id, 'occupied port must name vessel')

const released = releasePort(occupied, shuttle.id)
assert(released.status === 'available', 'undocking should release the port')
assert(released.occupiedByVesselId == null, 'released port should have no occupant')

assert(
  providesPhysicalCargoConnection({
    id: 'dock-1',
    stationSlug: 'phobos',
    portId: 'P-01',
    vesselId: shuttle.id,
    status: 'docked',
  }),
  'docked connection should provide a physical cargo path',
)

assert(
  !providesPhysicalCargoConnection({
    id: 'dock-2',
    stationSlug: 'phobos',
    portId: 'P-01',
    vesselId: shuttle.id,
    status: 'approaching',
  }),
  'approach alone must not provide a cargo-transfer path',
)

console.log('docking tests passed')
