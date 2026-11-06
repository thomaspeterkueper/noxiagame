import assert from 'node:assert/strict'
import { gameGuideLines } from './gameGuide'

const earth = [
  { kind: 'bar', name: 'Metropol' }, { kind: 'restaurant', name: 'Balkan Grill' },
  { kind: 'job_agency', name: 'Freiheitsmühle 7' }, { kind: 'school', name: null },
]
assert.ok(gameGuideLines('Ich suche eine Toilette', earth, 'earth')[0].includes('Metropol'))
assert.ok(gameGuideLines('Ich möchte tanzen', earth, 'earth')[0].includes('zurzeit nicht'))
assert.ok(!gameGuideLines('ich dachte hier kommen mehr leute zum tanzen', earth, 'earth').some(l => l.includes('Haus kaufen')))
assert.ok(gameGuideLines('wie kann ich selbst einen club aufmachen, zum tanzen?', earth, 'earth').some(l => l.includes('Haus kaufen')))
assert.ok(gameGuideLines('Hallo, ab wann ist hier was los?', earth, 'earth')[0].includes('18 Uhr') && gameGuideLines('Hallo, ab wann ist hier was los?', earth, 'earth')[0].includes('Metropol'))
assert.ok(gameGuideLines('Ich möchte tanzen', [...earth, { kind: 'nightclub', name: 'Fabrik' }], 'earth')[0].includes('Fabrik'))
assert.ok(gameGuideLines('ich möchte ein Café eröffnen', earth, 'earth')[0].includes('Haus kaufen'))
assert.ok(gameGuideLines('ich möchte zum Raumhafen', earth, 'earth').some(l => l.includes('Crew')))
assert.ok(gameGuideLines('ich suche Arbeit', earth, 'earth')[0].includes('Freiheitsmühle 7'))
assert.ok(gameGuideLines('wo ist die Akademie?', earth, 'earth')[0].includes('Prämie'))
assert.deepEqual(gameGuideLines('Moin, wie geht es dir?', earth, 'earth'), [])
console.log('gameGuide ok')
