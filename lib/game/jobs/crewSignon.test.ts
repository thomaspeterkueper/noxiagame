import assert from 'node:assert/strict'
import { crewKnowledge, crewStatusLine, durationText, sinceText, type CrewState } from './crewSignon'

const base: CrewState = { location: 'earth', locationName: 'Erde', hasShip: false, inTransit: false, tick: 100, routes: [], signon: null }
assert.deepEqual(crewKnowledge(base), ['Von hier fährt zurzeit keine Fracht ab; anheuern kann man hier nicht'])
const withRoute: CrewState = { ...base, routes: [{ destination: 'moon', name: 'Mond', departures: 7, lastDepartTick: 52, hours: 2, wage: 10 }] }
const k = crewKnowledge(withRoute)
assert.ok(k.some(l => l.includes('Mond') && l.includes('vor 2 Tagen') && l.includes('10 Cr')))
assert.equal(durationText(61.2), '2,6 Tage')
assert.equal(sinceText(0.5), 'gerade eben')
assert.equal(crewStatusLine(base), null)
assert.ok(crewStatusLine({ ...withRoute, signon: { status: 'waiting', destination: 'moon', destinationName: 'Mond' } })!.includes('Heuerliste nach Mond'))
assert.ok(crewStatusLine({ ...withRoute, signon: { status: 'aboard', destination: 'moon', destinationName: 'Mond', arrive_tick: 102, wage_credits: 10 } })!.includes('2 Std.'))
console.log('crewSignon ok')
