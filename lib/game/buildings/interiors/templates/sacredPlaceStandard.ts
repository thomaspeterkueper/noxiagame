import type { InteriorTemplate } from '../types'

/**
 * Shared fallback topology for religious places.
 * Concrete traditions may later override this with their own architecture.
 * The template models spatial affordances only, never theology.
 */
export const SACRED_PLACE_STANDARD_INTERIOR: InteriorTemplate = {
  id: 'sacred-place-standard-v1',
  buildingTypeId: 'sacred_place',
  hostKinds: ['building'],
  name: 'Religiöser Versammlungsort',
  version: 1,
  levels: [{ id: 'ground', name: 'Hauptebene', order: 0, elevationM: 0 }],
  rooms: [
    { id: 'entry', levelId: 'ground', name: 'Eingang', kind: 'entrance', capacity: 20, capabilities: ['arrival','information'], tags: ['public'] },
    { id: 'assembly', levelId: 'ground', name: 'Versammlungsraum', kind: 'hospitality', capacity: 80, capabilities: ['gather','service','ritual','sit','listen'], tags: ['public','community'] },
    { id: 'conversation', levelId: 'ground', name: 'Gesprächsraum', kind: 'service', capacity: 12, capabilities: ['conversation','care','teaching'], tags: ['public'] },
    { id: 'quiet', levelId: 'ground', name: 'Rückzugsraum', kind: 'other', capacity: 10, capabilities: ['reflection','prayer','rest'], tags: ['quiet'] },
  ],
  portals: [
    { id: 'entry-assembly', kind: 'passage', fromRoomId: 'entry', toRoomId: 'assembly', normallyOpen: true },
    { id: 'assembly-conversation', kind: 'door', fromRoomId: 'assembly', toRoomId: 'conversation', normallyOpen: true },
    { id: 'assembly-quiet', kind: 'door', fromRoomId: 'assembly', toRoomId: 'quiet', normallyOpen: true },
  ],
}
