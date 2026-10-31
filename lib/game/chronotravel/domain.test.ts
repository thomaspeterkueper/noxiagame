import { strict as assert } from 'node:assert'
import { HISTORICAL_SCENES, TRAVEL_OFFERS } from './catalogue'
import { evidenceOverview, quoteCredits, validateReservation, validateScene, visitMemoryEvent, type Reservation } from './domain'

for (const scene of HISTORICAL_SCENES) assert.deepEqual(validateScene(scene), { ok: true })
assert.equal(new Set(HISTORICAL_SCENES.map(s => s.placeId)).size, 1)
assert.deepEqual(HISTORICAL_SCENES.map(s => s.yearCE), [550, 1200, 1700])
const offer = TRAVEL_OFFERS[0]
const booking: Reservation = { id: 'r-1', actorId: 'npc-1', offerId: offer.id, guests: 2, startsAt: '2150-04-10T15:00:00Z', status: 'reserved' }
assert.deepEqual(validateReservation(booking, TRAVEL_OFFERS, [], HISTORICAL_SCENES), { ok: true })
assert.equal(quoteCredits(offer, 2), 50)
const taken: Reservation = { ...booking, id: 'r-0', guests: 7 }
assert.deepEqual(validateReservation(booking, TRAVEL_OFFERS, [taken], HISTORICAL_SCENES), { ok: false, reason: 'capacity_exceeded' })
assert.deepEqual(validateReservation(booking, TRAVEL_OFFERS, [booking], HISTORICAL_SCENES), { ok: false, reason: 'duplicate_reservation' })
assert.equal(evidenceOverview(HISTORICAL_SCENES[0]).speculative, 1)
assert.throws(() => visitMemoryEvent(booking, HISTORICAL_SCENES[0]), /visit_not_completed/)
assert.equal(visitMemoryEvent({ ...booking, status: 'completed' }, HISTORICAL_SCENES[0]).simulated, true)
console.log('ChronoTravel domain tests passed')
