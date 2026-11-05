import { banText, cleanFurnishing, furnishingFacts, movableTables, tableMoveAllowed, withFurnishing, EMPTY_FURNISHING } from './furnishing'
import { venueLayoutForBuildingType, venuePath } from './venues'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }

const cafe = venueLayoutForBuildingType('cafe')
const [t1, t2] = movableTables(cafe)
check(Boolean(t1 && t2), 'café has movable tables')
check(tableMoveAllowed(cafe, t1.id, { x: t1.x, y: t1.y }, EMPTY_FURNISHING), 'a table may stay where it is')
check(!tableMoveAllowed(cafe, t1.id, { x: t2.x, y: t2.y }, EMPTY_FURNISHING), 'not onto another table')
check(!tableMoveAllowed(cafe, t1.id, { x: cafe.exit.x - 30, y: cafe.exit.y - 20 }, EMPTY_FURNISHING), 'exit stays free')
check(!tableMoveAllowed(cafe, t1.id, { x: 5, y: 5 }, EMPTY_FURNISHING), 'not into the wall')
// eine freie Stelle suchen
let free: { x: number; y: number } | null = null
for (let dx = -60; dx <= 60 && !free; dx += 10) for (let dy = -40; dy <= 40 && !free; dy += 10) { const at = { x: t1.x + dx, y: t1.y + dy }; if ((dx || dy) && tableMoveAllowed(cafe, t1.id, at, EMPTY_FURNISHING)) free = at }
check(Boolean(free), 'some free place near table 1')
const f = cleanFurnishing({ tables: { [t1.id]: free, [t2.id]: { x: t1.x, y: t1.y } }, decor: [{ kind: 'pflanze', x: 300, y: 200 }, { kind: 'bild', x: 200, y: 400 }, { kind: 'rakete', x: 1, y: 1 }] }, cafe)
check(Boolean(f.tables[t1.id]) && f.decor.length === 2 && f.decor[1].y <= 80, 'clean keeps allowed moves and decor, pictures go on the wall')
const moved = withFurnishing(cafe, f)
const n = t1.id.replace('table-', '')
const seat = moved.spots.find(s => s.id === `table-${n}-l`)!, seat0 = cafe.spots.find(s => s.id === `table-${n}-l`)!
check(seat.x - seat0.x === free!.x - t1.x && seat.y - seat0.y === free!.y - t1.y, 'chairs and seats move with the table')
check(venuePath(moved, moved.start, seat).length >= 2, 'path still found')
check(furnishingFacts(f).some(x => x.includes('Pflanze')) && moved.roomFact.includes('geschmückt'), 'figures see the decor')
check(withFurnishing(cafe, EMPTY_FURNISHING) === cafe, 'nothing changed: same layout')
const now = Date.parse('2026-11-05T10:00:00Z')
check(banText(null, now) === null && banText('2026-11-05T09:00:00Z', now) === null && Boolean(banText('2026-11-06T10:00:00Z', now)?.includes('bis')) && banText('2040-01-01T00:00:00Z', now) === 'Du hast hier Hausverbot.', 'ban text')

if (failures) { console.error(failures + ' failed'); process.exit(1) } else console.log('furnishing checks passed')
