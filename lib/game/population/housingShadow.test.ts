import { shadowHousingDecision, type ShadowDwelling, type ShadowPerson } from './housingShadow'
import type { Dwelling } from './housing'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

const dwelling = (id: string, patch: Partial<Dwelling> = {}): Dwelling => ({
  id, locationId: 'mars', tileEntityId: id, kind: 'rental', capacity: 4, ownerKind: 'state', ownerId: 'state:mars',
  rent: 0, baseRent: 0, askingPrice: null, nightlyRate: null, ...patch,
})
const entry = (d: Dwelling, residents: string[] = [], supply = 1): ShadowDwelling => ({ dwelling: d, residents, supply })
const person = (patch: Partial<ShadowPerson> = {}): ShadowPerson => ({
  id: 'p1', locationId: 'mars', dwellingId: 'habitat', tenure: 'provided', wealth: 1000, dailyWage: 70,
  needs: { variety: 0.9 }, affinity: {}, closeTies: [], lastMoveTick: null, ticksSinceEviction: null, ...patch,
})
const habitat = entry(dwelling('habitat'), ['p1', 'p2'])
const block = entry(dwelling('block', { ownerKind: 'landlord', ownerId: 'corp', rent: 400, baseRent: 400 }))
const unpriced = entry(dwelling('unpriced', { ownerKind: 'landlord', ownerId: 'corp', rent: null, baseRent: null }))

const content = shadowHousingDecision(person(), [habitat, block, unpriced], 100)
check(content.outcome === 'stay' && !content.executable, 'a content person stays')
check(content.affordablePlaces === 1 && content.accessiblePlaces === 1, 'a dwelling without a price is not on offer')

const homeless = shadowHousingDecision(person({ dwellingId: null, tenure: 'none' }), [habitat, block], 100)
check(homeless.outcome === 'granted' && homeless.mustMove, 'someone without a home takes what is open')
check(homeless.targetDwellingId === 'habitat' && !homeless.executable, 'free public housing is preferred and is not a market move')

const full = entry(dwelling('habitat', { capacity: 2 }), ['p2', 'p3'])
const toMarket = shadowHousingDecision(person({ dwellingId: null, tenure: 'none' }), [full, block], 100)
check(toMarket.outcome === 'granted' && toMarket.targetDwellingId === 'block' && toMarket.executable && toMarket.gatekeeperId === 'corp', 'with public housing full the private rental is an executable market move')

const poor = shadowHousingDecision(person({ dwellingId: null, tenure: 'none', dailyWage: 20 }), [full, block], 100)
check(poor.outcome === 'no_offer' && poor.affordablePlaces === 0, 'a rent above 40 % of the wage is no offer at all')

const evicted = shadowHousingDecision(person({ dwellingId: null, tenure: 'none', wealth: 500, ticksSinceEviction: 240 }), [full, block], 100)
check(evicted.outcome === 'refused' && evicted.reason === 'past_arrears' && evicted.accessiblePlaces === 0 && evicted.affordablePlaces === 1, 'a recent eviction is refused: affordable but not accessible')

const elsewhere = entry(dwelling('far', { locationId: 'moon' }))
check(shadowHousingDecision(person({ dwellingId: null, tenure: 'none' }), [full, elsewhere], 100).outcome === 'no_offer', 'another settlement is no option without work there')

const bored = shadowHousingDecision(person({ needs: { variety: 0.05 } }), [habitat, block], 100)
check(bored.wantsToMove && bored.outcome === 'no_offer' && bored.reason === 'monotony', 'a bored person wants to move but does not trade free housing for a paid one')
check(JSON.stringify(shadowHousingDecision(person(), [habitat, block], 100)) === JSON.stringify(shadowHousingDecision(person(), [habitat, block], 100)), 'the decision is deterministic')

if (failures) throw new Error(String(failures) + ' housing shadow test(s) failed')
console.log('Housing shadow: tests passed; mutations=0')
