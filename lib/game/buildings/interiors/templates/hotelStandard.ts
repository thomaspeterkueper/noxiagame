import type { InteriorTemplate } from '../types'

// Hotel: Lobby mit Empfang, Büro dahinter, Gästezimmer im Obergeschoss.
// Vorbild SunDog: Am Empfang mietet man ein Zimmer und ruht sich aus.
export const HOTEL_STANDARD_INTERIOR: InteriorTemplate = {
  id: 'hotel-standard-v1',
  buildingTypeId: 'hotel',
  hostKinds: ['building'],
  name: 'Hotel Standard',
  version: 1,
  levels: [
    { id: 'ground', name: 'Erdgeschoss', order: 0, elevationM: 0 },
    { id: 'upper', name: 'Obergeschoss', order: 1, elevationM: 3.2 },
  ],
  rooms: [
    { id: 'entry', levelId: 'ground', name: 'Eingang', kind: 'entrance', capacity: 4, capabilities: ['arrival', 'exit'], tags: ['public'] },
    { id: 'guest-room', levelId: 'ground', name: 'Lobby', kind: 'hospitality', capacity: 16, capabilities: ['sit', 'conversation'], tags: ['public', 'social'] },
    { id: 'counter', levelId: 'ground', name: 'Empfang', kind: 'service', capacity: 4, capabilities: ['order', 'serve', 'pay'], tags: ['public', 'service'] },
    { id: 'back-room', levelId: 'ground', name: 'Büro', kind: 'office', capacity: 2, capabilities: ['staff'], tags: ['staff-only'] },
    { id: 'rooms', levelId: 'upper', name: 'Gästezimmer', kind: 'habitation', capacity: 16, capabilities: ['sleep', 'privacy'], tags: ['guests-only'] },
  ],
  portals: [
    { id: 'door-entry-lobby', kind: 'door', fromRoomId: 'entry', toRoomId: 'guest-room', normallyOpen: true },
    { id: 'passage-lobby-counter', kind: 'passage', fromRoomId: 'guest-room', toRoomId: 'counter', normallyOpen: true },
    { id: 'door-counter-office', kind: 'door', fromRoomId: 'counter', toRoomId: 'back-room', normallyOpen: false, accessTags: ['staff'] },
    { id: 'stairs-lobby-rooms', kind: 'stairs', fromRoomId: 'guest-room', toRoomId: 'rooms', normallyOpen: false, accessTags: ['guest', 'staff'] },
  ],
}
