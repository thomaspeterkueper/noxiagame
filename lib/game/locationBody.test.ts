import assert from 'node:assert/strict'
import {
  hasDedicatedSurfaceView,
  isMarsSurfaceSite,
  registerLocationBodies,
  resolveLocationBody,
} from './locationBody'
import { hasOrbit, orbitKey, position } from './orbits'
import { transferQuote } from './transfer'

const MARS = '10000000-0000-0000-0000-000000000004'
const MOON = '10000000-0000-0000-0000-000000000003'

// Körper aus der ID, sonst aus dem Slug alter Zeilen.
assert.equal(resolveLocationBody({ slug: 'mishkan-avi', celestial_body_id: MARS }), 'mars')
assert.equal(resolveLocationBody({ slug: 'mars', celestial_body_id: null }), 'mars')
assert.equal(resolveLocationBody({ slug: 'unbekannt', celestial_body_id: null }), null)

// Mars-Oberflächenorte, aber keine Stationen.
assert.equal(isMarsSurfaceSite({ slug: 'mishkan-avi', celestial_body_id: MARS, location_type: 'colony' }), true)
assert.equal(isMarsSurfaceSite({ slug: 'orbit-x', celestial_body_id: MARS, location_type: 'station' }), false)
assert.equal(isMarsSurfaceSite({ slug: 'mond-x', celestial_body_id: MOON, location_type: 'colony' }), false)
assert.equal(hasDedicatedSurfaceView('phobos'), true)
assert.equal(hasDedicatedSurfaceView('mishkan-avi', { slug: 'mishkan-avi', celestial_body_id: MARS, location_type: 'colony' }), true)
assert.equal(hasDedicatedSurfaceView('mishkan-avi'), false)

// Ohne Anmeldung keine Route – wie bisher.
assert.equal(hasOrbit('mishkan-avi'), false)
assert.equal(transferQuote('phobos', 'mishkan-avi', 100), null)

registerLocationBodies([
  { slug: 'mishkan-avi', celestial_body_id: MARS, location_type: 'colony' },
  { slug: 'orbit-x', celestial_body_id: MARS, location_type: 'station' },
  { slug: 'mars', celestial_body_id: MARS, location_type: 'colony' },
])

// Oberflächenort nutzt die Bahn seines Körpers.
assert.equal(orbitKey('mishkan-avi'), 'mars')
assert.equal(orbitKey('mars'), 'mars')
assert.equal(orbitKey('orbit-x'), null, 'Stationen bekommen keinen Alias')
assert.deepEqual(position('mishkan-avi', 100), position('mars', 100))

// Reise zum Oberflächenort kostet wie zum Mars selbst.
const toSite = transferQuote('phobos', 'mishkan-avi', 100)
const toMars = transferQuote('phobos', 'mars', 100)
assert.ok(toSite && toMars)
assert.equal(toSite!.durationSeconds, toMars!.durationSeconds)
assert.equal(toSite!.energy, toMars!.energy)

// Zwischen zwei Orten auf dem Mars: kurzer Flug über die Landeplätze.
const hop = transferQuote('mars', 'mishkan-avi', 100)
assert.ok(hop, 'Flug Tharsis Hub → Mishkan Avi ist möglich')
assert.equal(hop!.durationSeconds, 10)

// Feste Bahnen haben Vorrang vor Aliassen.
registerLocationBodies([{ slug: 'phobos', celestial_body_id: MARS, location_type: 'colony' }])
assert.equal(orbitKey('phobos'), 'phobos')

console.log('locationBody: ok')
