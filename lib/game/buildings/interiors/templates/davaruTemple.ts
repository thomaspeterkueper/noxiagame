import type { InteriorTemplate } from '../types'

/** Shared physical topology; remote visitors have sessions, not physical presence. */
export const DAVARU_TEMPLE_INTERIOR: InteriorTemplate = {
  id: 'davaru-temple-v1',
  buildingTypeId: 'davaru_temple',
  hostKinds: ['building'],
  name: 'Tempel des DaVaRu',
  version: 1,
  levels: [{ id: 'ground', name: 'Gartenebene', order: 0, elevationM: 0 }],
  rooms: [
    { id: 'entrance', levelId: 'ground', name: 'Empfang', kind: 'entrance', capacity: 20, capabilities: ['arrival', 'information'], tags: ['public'] },
    { id: 'conversation', levelId: 'ground', name: 'Gesprächshalle', kind: 'hospitality', capacity: 35, capabilities: ['conversation', 'sit'], tags: ['public'] },
    { id: 'library', levelId: 'ground', name: 'Bibliothek', kind: 'service', capacity: 20, capabilities: ['read', 'study'], tags: ['public'] },
    { id: 'garden', levelId: 'ground', name: 'Garten am Bach', kind: 'other', capacity: 25, capabilities: ['rest', 'conversation'], tags: ['public'] },
  ],
  portals: [
    { id: 'entrance-conversation', kind: 'passage', fromRoomId: 'entrance', toRoomId: 'conversation', normallyOpen: true },
    { id: 'conversation-library', kind: 'door', fromRoomId: 'conversation', toRoomId: 'library', normallyOpen: true },
    { id: 'conversation-garden', kind: 'passage', fromRoomId: 'conversation', toRoomId: 'garden', normallyOpen: true },
  ],
}
