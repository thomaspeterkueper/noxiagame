import type { InteriorTemplate } from '../types'

/**
 * Shared topology for a compact pressurized habitat cluster.
 *
 * The template describes physical/functional affordances only. Population,
 * assignments, access authorization, environmental telemetry and life-support
 * state remain authoritative in their owning Core/domain projections.
 */
export const PRESSURIZED_HABITAT_CLUSTER_INTERIOR: InteriorTemplate = {
  id: 'pressurized-habitat-cluster-01',
  buildingTypeId: 'habitat_cluster',
  hostKinds: ['building'],
  name: 'Pressurized habitat cluster interior',
  version: 1,
  levels: [
    { id: 'habitat-main', name: 'Habitat level', order: 0 },
    { id: 'habitat-service', name: 'Service level', order: 1 },
  ],
  rooms: [
    { id: 'entry-airlock', levelId: 'habitat-main', name: 'Entry airlock', kind: 'airlock', tags: ['entry'], capabilities: [] },
    { id: 'central-corridor', levelId: 'habitat-main', name: 'Central corridor', kind: 'corridor', capabilities: [] },
    { id: 'commons', levelId: 'habitat-main', name: 'Commons', kind: 'habitation', capabilities: ['crew.habitation'] },
    { id: 'living-a', levelId: 'habitat-main', name: 'Living section A', kind: 'habitation', capabilities: ['crew.habitation'] },
    { id: 'living-b', levelId: 'habitat-main', name: 'Living section B', kind: 'habitation', capabilities: ['crew.habitation'] },
    { id: 'local-storage', levelId: 'habitat-service', name: 'Local storage', kind: 'storage', capabilities: ['inventory.storage'] },
    { id: 'service-corridor', levelId: 'habitat-service', name: 'Service corridor', kind: 'service', capabilities: [] },
    { id: 'local-utilities', levelId: 'habitat-service', name: 'Local utilities', kind: 'technical', capabilities: ['utilities.local'] },
  ],
  portals: [
    { id: 'p-entry-corridor', kind: 'airlock', fromRoomId: 'entry-airlock', toRoomId: 'central-corridor', pressureBoundary: true },
    { id: 'p-corridor-commons', kind: 'door', fromRoomId: 'central-corridor', toRoomId: 'commons' },
    { id: 'p-corridor-living-a', kind: 'door', fromRoomId: 'central-corridor', toRoomId: 'living-a' },
    { id: 'p-corridor-living-b', kind: 'door', fromRoomId: 'central-corridor', toRoomId: 'living-b' },
    { id: 'p-corridor-service', kind: 'hatch', fromRoomId: 'central-corridor', toRoomId: 'service-corridor' },
    { id: 'p-service-storage', kind: 'door', fromRoomId: 'service-corridor', toRoomId: 'local-storage' },
    { id: 'p-service-utilities', kind: 'hatch', fromRoomId: 'service-corridor', toRoomId: 'local-utilities' },
  ],
}
