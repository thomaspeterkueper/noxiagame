import type { InteriorTemplate } from '../types'

export const ORBITAL_TRANSFER_STATION_INTERIOR: InteriorTemplate = {
  id: 'orbital-transfer-station-01',
  hostKinds: ['station'],
  name: 'Orbital transfer station interior',
  version: 1,
  levels: [
    { id: 'deck-a', name: 'Docking deck', order: 0 },
    { id: 'deck-b', name: 'Habitat deck', order: 1 },
    { id: 'deck-c', name: 'Service deck', order: 2 },
  ],
  rooms: [
    { id: 'dock-airlock', levelId: 'deck-a', name: 'Docking airlock', kind: 'airlock', capacity: 8, tags: ['entry', 'docking'] },
    { id: 'transfer-corridor', levelId: 'deck-a', name: 'Transfer corridor', kind: 'corridor', capacity: 18, capabilities: ['cargo.transfer'] },
    { id: 'cargo-lock', levelId: 'deck-a', name: 'Cargo lock', kind: 'storage', capacity: 8, capabilities: ['inventory', 'cargo.transfer'] },
    { id: 'habitat-hub', levelId: 'deck-b', name: 'Habitat hub', kind: 'habitation', capacity: 24, capabilities: ['crew.habitation'] },
    { id: 'medical-bay', levelId: 'deck-b', name: 'Medical bay', kind: 'medical', capacity: 6, capabilities: ['medical'] },
    { id: 'operations', levelId: 'deck-b', name: 'Station operations', kind: 'office', capacity: 10, capabilities: ['station.operations', 'administration'] },
    { id: 'service-spine', levelId: 'deck-c', name: 'Service spine', kind: 'corridor', capacity: 12 },
    { id: 'utilities', levelId: 'deck-c', name: 'Utilities', kind: 'technical', capacity: 6, capabilities: ['station.utilities'] },
    { id: 'depot', levelId: 'deck-c', name: 'Depot', kind: 'storage', capacity: 12, capabilities: ['inventory', 'station.depot'] },
  ],
  portals: [
    { id: 'p-dock-transfer', kind: 'airlock', fromRoomId: 'dock-airlock', toRoomId: 'transfer-corridor', pressureBoundary: true },
    { id: 'p-transfer-cargo', kind: 'hatch', fromRoomId: 'transfer-corridor', toRoomId: 'cargo-lock', pressureBoundary: true },
    { id: 'p-transfer-habitat', kind: 'elevator', fromRoomId: 'transfer-corridor', toRoomId: 'habitat-hub' },
    { id: 'p-habitat-medical', kind: 'door', fromRoomId: 'habitat-hub', toRoomId: 'medical-bay' },
    { id: 'p-habitat-operations', kind: 'door', fromRoomId: 'habitat-hub', toRoomId: 'operations' },
    { id: 'p-habitat-service', kind: 'ladder', fromRoomId: 'habitat-hub', toRoomId: 'service-spine' },
    { id: 'p-service-utilities', kind: 'hatch', fromRoomId: 'service-spine', toRoomId: 'utilities' },
    { id: 'p-service-depot', kind: 'hatch', fromRoomId: 'service-spine', toRoomId: 'depot' },
  ],
}
