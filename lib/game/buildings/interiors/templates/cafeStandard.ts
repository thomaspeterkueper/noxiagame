import type { InteriorTemplate } from '../types'

export const CAFE_STANDARD_INTERIOR: InteriorTemplate = {
  id: 'cafe-standard-v1',
  buildingTypeId: 'cafe',
  hostKinds: ['building'],
  name: 'Café Standard',
  version: 1,
  levels: [
    { id: 'ground', name: 'Erdgeschoss', order: 0, elevationM: 0 },
  ],
  rooms: [
    {
      id: 'entry',
      levelId: 'ground',
      name: 'Eingang',
      kind: 'entrance',
      capacity: 4,
      capabilities: ['arrival', 'exit'],
      tags: ['public'],
    },
    {
      id: 'guest-room',
      levelId: 'ground',
      name: 'Gastraum',
      kind: 'hospitality',
      capacity: 24,
      capabilities: ['sit', 'conversation', 'consume'],
      tags: ['public', 'social'],
    },
    {
      id: 'counter',
      levelId: 'ground',
      name: 'Tresen',
      kind: 'service',
      capacity: 6,
      capabilities: ['order', 'serve', 'pay'],
      tags: ['public', 'service'],
    },
    {
      id: 'back-room',
      levelId: 'ground',
      name: 'Nebenraum',
      kind: 'storage',
      capacity: 4,
      capabilities: ['storage', 'staff'],
      tags: ['staff-only'],
    },
  ],
  portals: [
    { id: 'door-entry-guest', kind: 'door', fromRoomId: 'entry', toRoomId: 'guest-room', normallyOpen: true },
    { id: 'passage-guest-counter', kind: 'passage', fromRoomId: 'guest-room', toRoomId: 'counter', normallyOpen: true },
    { id: 'door-counter-back', kind: 'door', fromRoomId: 'counter', toRoomId: 'back-room', normallyOpen: false, accessTags: ['staff'] },
  ],
}
