import { describe, expect, it } from 'vitest'
import { resolveTempleCanonicalPeople } from './canonicalTemplePeople'
const ref = (key: string, person: string, from: number | null = null) => ({
  person_id: person, character_key: key, universe_key: 'noxia',
  integration_mode: 'canon_anchor', valid_from_tick: from, valid_until_tick: null,
})
describe('DaVaRu temple canonical-person bridge', () => {
  it('resolves real identities without creating persons', () => {
    expect(resolveTempleCanonicalPeople([
      ref('daniel-van-runen-davaru', 'person-davaru'),
      ref('aristeas-lux', 'person-aristeas', 100),
    ], 110)).toEqual([
      {personId:'person-davaru',characterKey:'daniel-van-runen-davaru',role:'host',displayName:'Daniel van Runen (DaVaRu)'},
      {personId:'person-aristeas',characterKey:'aristeas-lux',role:'visitor',displayName:'Aristeas Lux'},
    ])
  })
  it('omits inactive or ambiguous identities', () => {
    expect(resolveTempleCanonicalPeople([ref('aristeas-lux','future',500)], 200)).toEqual([])
    expect(resolveTempleCanonicalPeople([ref('aristeas-lux','a'),ref('aristeas-lux','b')], 200)).toEqual([])
  })
})
