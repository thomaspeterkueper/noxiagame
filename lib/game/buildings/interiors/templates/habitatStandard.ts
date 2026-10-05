import type { InteriorTemplate } from '../types'

export const HABITAT_STANDARD_INTERIOR: InteriorTemplate = {
  id: 'habitat-standard-v1',
  buildingTypeId: 'habitat',
  hostKinds: ['building'],
  name: 'Habitat Standard',
  version: 1,
  levels: [{ id: 'ground', name: 'Hauptebene', order: 0, elevationM: 0 }],
  rooms: [
    { id: 'airlock', levelId: 'ground', name: 'Eingangsschleuse', kind: 'airlock', capacity: 6, capabilities: ['arrival','exit'], tags: ['public'] },
    { id: 'common', levelId: 'ground', name: 'Gemeinschaftsraum', kind: 'habitation', capacity: 20, capabilities: ['sit','conversation','consume'], tags: ['social'] },
    { id: 'quarters', levelId: 'ground', name: 'Wohneinheiten', kind: 'habitation', capacity: 24, capabilities: ['sleep','privacy'], tags: ['residential'] },
    { id: 'support', levelId: 'ground', name: 'Versorgungskern', kind: 'utility', capacity: 6, capabilities: ['life_support','maintenance'], tags: ['technical'] },
  ],
  portals: [
    { id:'airlock-common',kind:'airlock',fromRoomId:'airlock',toRoomId:'common',normallyOpen:true,pressureBoundary:true },
    { id:'common-quarters',kind:'door',fromRoomId:'common',toRoomId:'quarters',normallyOpen:true },
    { id:'common-support',kind:'door',fromRoomId:'common',toRoomId:'support',normallyOpen:false,accessTags:['staff'] },
  ],
}
