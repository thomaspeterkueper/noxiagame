import type { InteriorTemplate } from '../types'

// Bar: gleiche Raumfolge wie das Café, aber der Tresen ist der Hauptort.
export const BAR_STANDARD_INTERIOR: InteriorTemplate = {
  id: 'bar-standard-v1',
  buildingTypeId: 'bar',
  hostKinds: ['building'],
  name: 'Bar Standard',
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
      name: 'Schankraum',
      kind: 'hospitality',
      capacity: 28,
      capabilities: ['sit', 'conversation', 'consume'],
      tags: ['public', 'social'],
    },
    {
      id: 'counter',
      levelId: 'ground',
      name: 'Tresen',
      kind: 'service',
      capacity: 8,
      capabilities: ['order', 'serve', 'pay'],
      tags: ['public', 'service'],
    },
    {
      id: 'back-room',
      levelId: 'ground',
      name: 'Lager',
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
