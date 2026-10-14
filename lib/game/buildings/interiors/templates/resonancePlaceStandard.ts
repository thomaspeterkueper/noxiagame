import type { InteriorTemplate } from '../types'

/**
 * Omnizedenz resonance place.
 * Not a church/temple analogue and not a privileged truth source.
 * It provides space for encounter, reflection, conversation and shared presence.
 */
export const RESONANCE_PLACE_STANDARD_INTERIOR: InteriorTemplate = {
  id: 'resonance-place-standard-v1',
  buildingTypeId: 'resonance_place',
  hostKinds: ['building'],
  name: 'Resonanzplatz',
  version: 1,
  levels: [{ id: 'ground', name: 'Platzebene', order: 0, elevationM: 0 }],
  rooms: [
    { id: 'threshold', levelId: 'ground', name: 'Übergang', kind: 'entrance', capacity: 20, capabilities: ['arrival','orientation'], tags: ['public'] },
    { id: 'forum', levelId: 'ground', name: 'Offener Resonanzraum', kind: 'hospitality', capacity: 60, capabilities: ['conversation','gather','listen','reflection'], tags: ['public','social'] },
    { id: 'quiet-edge', levelId: 'ground', name: 'Stiller Rand', kind: 'other', capacity: 16, capabilities: ['reflection','rest','observe'], tags: ['public','quiet'] },
    { id: 'study', levelId: 'ground', name: 'Lesen & Denken', kind: 'service', capacity: 16, capabilities: ['read','study','conversation'], tags: ['public'] },
  ],
  portals: [
    { id: 'threshold-forum', kind: 'passage', fromRoomId: 'threshold', toRoomId: 'forum', normallyOpen: true },
    { id: 'forum-quiet', kind: 'passage', fromRoomId: 'forum', toRoomId: 'quiet-edge', normallyOpen: true },
    { id: 'forum-study', kind: 'passage', fromRoomId: 'forum', toRoomId: 'study', normallyOpen: true },
  ],
}
