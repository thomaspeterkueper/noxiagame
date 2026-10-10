import type { InteriorTemplate } from '../types'

// Restaurant: Empfang, Speiseraum und eine Küche hinter geschlossener Tür.
// Die Durchreiche ist kein Portal – Gäste sehen nicht in die Küche.
export const RESTAURANT_STANDARD_INTERIOR: InteriorTemplate = {
  id: 'restaurant-standard-v1',
  buildingTypeId: 'restaurant',
  hostKinds: ['building'],
  name: 'Restaurant Standard',
  version: 1,
  levels: [
    { id: 'ground', name: 'Erdgeschoss', order: 0, elevationM: 0 },
  ],
  rooms: [
    {
      id: 'entry',
      levelId: 'ground',
      name: 'Empfang',
      kind: 'entrance',
      capacity: 6,
      capabilities: ['arrival', 'exit'],
      tags: ['public'],
    },
    {
      id: 'guest-room',
      levelId: 'ground',
      name: 'Speiseraum',
      kind: 'hospitality',
      capacity: 36,
      capabilities: ['sit', 'conversation', 'consume', 'order', 'serve', 'pay'],
      tags: ['public', 'social'],
    },
    {
      id: 'kitchen',
      levelId: 'ground',
      name: 'Küche',
      kind: 'service',
      capacity: 6,
      capabilities: ['staff'],
      tags: ['staff-only'],
    },
    {
      id: 'back-room',
      levelId: 'ground',
      name: 'Vorratsraum',
      kind: 'storage',
      capacity: 3,
      capabilities: ['storage', 'staff'],
      tags: ['staff-only'],
    },
  ],
  portals: [
    { id: 'door-entry-guest', kind: 'door', fromRoomId: 'entry', toRoomId: 'guest-room', normallyOpen: true },
    { id: 'door-guest-kitchen', kind: 'door', fromRoomId: 'guest-room', toRoomId: 'kitchen', normallyOpen: false, accessTags: ['staff'] },
    { id: 'door-kitchen-back', kind: 'door', fromRoomId: 'kitchen', toRoomId: 'back-room', normallyOpen: false, accessTags: ['staff'] },
  ],
}
