import type { InteriorTemplate } from '../types'

export const LABORATORY_STANDARD_INTERIOR: InteriorTemplate = {
  id: 'laboratory-standard-01',
  buildingTypeId: 'laboratory',
  hostKinds: ['building'],
  name: 'Standard laboratory interior',
  version: 1,
  levels: [
    { id: 'level-0', name: 'Level 0', order: 0, elevationM: 0 },
    { id: 'level-1', name: 'Level 1', order: 1, elevationM: 3.2 },
  ],
  rooms: [
    { id: 'airlock', levelId: 'level-0', name: 'Entrance / airlock', kind: 'airlock', capacity: 4, tags: ['entry'] },
    { id: 'corridor-0', levelId: 'level-0', name: 'Main corridor', kind: 'corridor', capacity: 10 },
    { id: 'analysis-lab', levelId: 'level-0', name: 'Analysis laboratory', kind: 'laboratory', capacity: 8, capabilities: ['research.analysis'] },
    { id: 'workshop', levelId: 'level-0', name: 'Workshop', kind: 'workshop', capacity: 6, capabilities: ['maintenance', 'fabrication'] },
    { id: 'storage', levelId: 'level-0', name: 'Storage', kind: 'storage', capacity: 4, capabilities: ['inventory'] },
    { id: 'technical', levelId: 'level-0', name: 'Technical room', kind: 'technical', capacity: 3, capabilities: ['building.utilities'] },
    { id: 'corridor-1', levelId: 'level-1', name: 'Upper corridor', kind: 'corridor', capacity: 8 },
    { id: 'office', levelId: 'level-1', name: 'Research office', kind: 'office', capacity: 6, capabilities: ['administration', 'research.data'] },
    { id: 'meeting', levelId: 'level-1', name: 'Meeting room', kind: 'service', capacity: 8, capabilities: ['briefing'] },
    { id: 'data-room', levelId: 'level-1', name: 'Data room', kind: 'technical', capacity: 3, capabilities: ['research.data', 'compute'] },
  ],
  portals: [
    { id: 'p-airlock-corridor', kind: 'airlock', fromRoomId: 'airlock', toRoomId: 'corridor-0', pressureBoundary: true },
    { id: 'p-corridor-analysis', kind: 'door', fromRoomId: 'corridor-0', toRoomId: 'analysis-lab' },
    { id: 'p-corridor-workshop', kind: 'door', fromRoomId: 'corridor-0', toRoomId: 'workshop' },
    { id: 'p-corridor-storage', kind: 'door', fromRoomId: 'corridor-0', toRoomId: 'storage' },
    { id: 'p-corridor-technical', kind: 'door', fromRoomId: 'corridor-0', toRoomId: 'technical' },
    { id: 'p-levels', kind: 'stairs', fromRoomId: 'corridor-0', toRoomId: 'corridor-1' },
    { id: 'p-corridor-office', kind: 'door', fromRoomId: 'corridor-1', toRoomId: 'office' },
    { id: 'p-corridor-meeting', kind: 'door', fromRoomId: 'corridor-1', toRoomId: 'meeting' },
    { id: 'p-corridor-data', kind: 'door', fromRoomId: 'corridor-1', toRoomId: 'data-room' },
  ],
}
