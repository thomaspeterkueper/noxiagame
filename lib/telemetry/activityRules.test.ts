import assert from 'node:assert/strict'
import {
  apiActionParam,
  cleanLabel,
  earthPathPoint,
  isActivityKind,
  isRageClick,
  normalizeApiPath,
  roundPosition,
  shouldReportPosition,
} from './activityRules'

assert.equal(isActivityKind('click'), true)
assert.equal(isActivityKind('keystroke'), false)

assert.equal(cleanLabel('  Gebäude\n 3f2c1a9e-1111-4222-8333-444455556666 betreten  '), 'Gebäude :id betreten')
assert.equal(cleanLabel('x'.repeat(200)).length, 80)

assert.equal(normalizeApiPath('/api/game/ships?action=buy&shipTypeId=x'), '/api/game/ships')
assert.equal(normalizeApiPath('/api/game/person/3f2c1a9e-1111-4222-8333-444455556666/talk'), '/api/game/person/:id/talk')
assert.equal(apiActionParam('/api/game/ships?action=buy'), 'buy')
assert.equal(apiActionParam('/api/game/ships'), null)

const t = 10_000
assert.equal(isRageClick([], { t, x: 0, y: 0 }), false)
assert.equal(isRageClick([{ t: t - 300, x: 2, y: 2 }], { t, x: 0, y: 0 }), false)
assert.equal(isRageClick([{ t: t - 600, x: 2, y: 2 }, { t: t - 300, x: 5, y: 1 }], { t, x: 0, y: 0 }), true)
assert.equal(isRageClick([{ t: t - 1600, x: 2, y: 2 }, { t: t - 1300, x: 5, y: 1 }], { t, x: 0, y: 0 }), false)
assert.equal(isRageClick([{ t: t - 600, x: 200, y: 2 }, { t: t - 300, x: 300, y: 1 }], { t, x: 0, y: 0 }), false)

assert.equal(roundPosition(10.9), 10)
assert.equal(roundPosition(-3.2), -4)

assert.equal(shouldReportPosition(null, { t, x: 0, y: 0, scope: 'moon' }), true)
assert.equal(shouldReportPosition({ t: t - 1000, x: 0, y: 0, scope: 'moon' }, { t, x: 10, y: 0, scope: 'moon' }), false)
assert.equal(shouldReportPosition({ t: t - 6000, x: 0, y: 0, scope: 'moon' }, { t, x: 1, y: 0, scope: 'moon' }), false)
assert.equal(shouldReportPosition({ t: t - 6000, x: 0, y: 0, scope: 'moon' }, { t, x: 4, y: 0, scope: 'moon' }), true)
assert.equal(shouldReportPosition({ t: t - 100, x: 0, y: 0, scope: 'moon' }, { t, x: 0, y: 0, scope: 'cafe' }), true)

console.log('activityRules: ok')

// Erde: Bodenmeter, örtlich maßstabstreu (Sundern, 29.10.2026)
{
  const a = earthPathPoint({ lat: 51.33, lon: 8.0 }), b = earthPathPoint({ lat: 51.33, lon: 8.001 })
  assert.ok(Math.abs((b.x - a.x) - 69.6) < 0.5, 'ein tausendstel Grad Länge sind in Sundern rund 70 m')
  const c = earthPathPoint({ lat: 51.331, lon: 8.0 })
  assert.ok(Math.abs((c.y - a.y) - 110.6) < 0.5, 'ein tausendstel Grad Breite sind rund 111 m')
}
