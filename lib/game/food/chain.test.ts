import {
  DISH_INGREDIENTS_G, GOODS, allocateBread, dishRequirementsG, formatMass, kgFromGrams, toGrams, PROCESSES, breadDemandKgPerDay, inputsFor, kcalOf, processesFor, runProcess,
  simulateBreadChain, spoilDay, totalOf, upstreamRequirements,
  type ChainConfig, type ChainNodes, type Disruption, type Good,
} from './chain'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

// Verfahren und Mengenverhältnisse
const bake = runProcess({ flour: 250, water: 1000, salt: 10, yeast: 10, energy: 1 }, PROCESSES.baking, 5)
check(bake.batches === 2 && bake.limitedBy === 'flour' && bake.stock.bread === 300 && near(bake.stock.flour!, 50), 'baking stops at missing flour – no bread without inputs')
check(runProcess({ flour: 1000, water: 1000, salt: 10, yeast: 10, energy: 1 }, PROCESSES.baking, 5, 12).limitedBy === 'labor', 'labor limits the bakery')
check(runProcess({ seed: 1000, energy: 10 }, PROCESSES.wheat_harvest, 1, Infinity, 3).limitedBy === 'season', 'no wheat harvest in March')
check(inputsFor(PROCESSES.baking, 'bread', 150).find(f => f.good === 'flour')!.amount === 100, '150 kg bread need 100 kg flour')
const up = upstreamRequirements('bread', 150, { bread: PROCESSES.baking, flour: PROCESSES.milling })
check(near(up.grain!, 133.3333333, 1e-4) && up.flour === undefined && (up.energy ?? 0) > 0.05, 'bread traces back to grain and energy')
check(processesFor('habitat').every(p => p.facility !== 'field') && processesFor('habitat').some(p => p.code === 'hydroponic_greens'), 'habitats get hydroponics, not fields')
check(processesFor('earth_open').some(p => p.code === 'wheat_harvest'), 'open earth gets fields')

// Verderb
const spoiled = spoilDay({ bread: 100, salt: 50, flour: 180 })
check(near(spoiled.stock.bread!, 75) && spoiled.stock.salt === 50 && near(spoiled.lost.flour!, 1), 'bread spoils fast, salt never, flour slowly')
check(kcalOf({ bread: 1, flour: 10 }) === GOODS.bread.kcalPerKg, 'only edible goods count as calories')

// Kette über Tage – Testgröße eines Dorfes (Seelenberg ~550 Personen), aber ortsunabhängig
const config: ChainConfig = {
  persons: 554, breadShareOfKcal: 0.3,
  leadDays: { grainToMill: 1, flourToBakery: 1, breadToShop: 0 },
  reorderCoverDays: 3, orderCoverDays: 7,
  bakeryLaborHoursPerDay: 16, millLaborHoursPerDay: 8,
}
const demand = breadDemandKgPerDay(config)
const flourPerDay = demand / 1.5
const start = (): ChainNodes => ({
  granary: { grain: 20000 },
  mill: { grain: 2000, flour: flourPerDay * 5 },
  bakery: { flour: flourPerDay * 4 },
  shop: { bread: demand },
})

// Massenbilanz in Getreideäquivalent: Getreide + Mehl + Kleie + (je erzeugtes Brot)/1,5 bleibt erhalten.
function grainEquivalent(nodes: ChainNodes, transit: { good: Good; amount: number }[], breadOut: number) {
  return totalOf('grain', nodes, transit) + totalOf('flour', nodes, transit) + totalOf('bran', nodes, transit)
    + (totalOf('bread', nodes, transit) + breadOut) / 1.5
}

const normal = simulateBreadChain(config, start(), 60)
const s0 = start()
const before = grainEquivalent(s0, [], 0)
const breadOut = normal.log.reduce((s, d) => s + d.breadEatenKg + d.spoiledBreadKg, 0)
check(near(grainEquivalent(normal.nodes, normal.inTransit, breadOut), before, 1e-3), 'mass balance holds: nothing appears or vanishes')
check(normal.log.slice(3).every(d => d.shortfallKg < 1e-6), 'normal operation: nobody goes without bread')
check(normal.log.every(d => d.shopBread >= -1e-9 && d.bakeryFlour >= -1e-9), 'no negative stock anywhere')
check(normal.log.some(d => d.orders.includes('Mehl an Bäckerei')) && normal.log.some(d => d.orders.includes('Getreide an Mühle')), 'falling stock triggers orders up the chain')
check(JSON.stringify(simulateBreadChain(config, start(), 60).log) === JSON.stringify(normal.log), 'deterministic: same input, same days')

// Störung: Straße zur Bäckerei an Tag 8–20 gesperrt, Umweg +6 Tage
const roadBlocked: Disruption[] = [{ link: 'flourToBakery', fromDay: 8, toDay: 20, extraDays: 6 }]
const disrupted = simulateBreadChain(config, start(), 60, roadBlocked)
const shortDays = disrupted.log.filter(d => d.shortfallKg > 1e-6)
check(shortDays.length > 0, 'blocked road leads to missing bread')
check(disrupted.log.some(d => d.bakeryLimitedBy === 'flour'), 'the bakery reports flour as its limit')
check(shortDays.every(d => d.day > 8), 'the shortage follows the blockage, not before')
check(disrupted.log.slice(-10).every(d => d.shortfallKg < 1e-6), 'after the road reopens supply recovers')
const breadOutD = disrupted.log.reduce((s, d) => s + d.breadEatenKg + d.spoiledBreadKg, 0)
check(near(grainEquivalent(disrupted.nodes, disrupted.inTransit, breadOutD), before, 1e-3), 'mass balance holds during the disruption: delayed flour stays in transit')

// Leerer Speicher: ohne Getreide endet die Kette sichtbar
const empty = simulateBreadChain(config, { ...start(), granary: {} , mill: { flour: flourPerDay * 2 } }, 30)
check(empty.log.some(d => d.orders.includes('Getreide fehlt im Speicher')) && empty.log.slice(-5).every(d => d.shortfallKg > 0), 'empty granary: missing grain is reported and bread runs out')

// Einheiten: kg im Modell, ganze Gramm in der Buchung, Anzeige wechselt bei 1 t
check(toGrams(0.0025) === 3 && toGrams(2) === 2000 && kgFromGrams(1500) === 1.5, 'kg and grams convert exactly')
check(Object.values(PROCESSES).every(p => [...p.inputs, ...p.outputs].filter(f => GOODS[f.good].unit === 'kg').every(f => Number.isInteger(f.amount * 1000))), 'every process flow is a whole number of grams')
check(formatMass(0.25) === '250 g' && formatMass(146.3) === '146,3 kg' && formatMass(20000) === '20 t', 'display switches g, kg, t')

// Gastronomie aus demselben Bestand
check(JSON.stringify(allocateBread(100, 80, 40, 'households_first')) === JSON.stringify({ households: 80, hospitality: 20 }), 'scarcity: households first')
const prop = allocateBread(60, 80, 40, 'proportional')
check(near(prop.households, 40) && near(prop.hospitality, 20), 'scarcity: proportional sharing')
const dishes = dishRequirementsG({ restaurant_main: 10, cafe_meal: 4, mystery: 1 })
check(dishes.grams.potatoes === 3000 && dishes.grams.bread === 1400 && dishes.unknown.includes('mystery'), 'dishes become ingredients in grams; unknown dishes are reported')
check(Object.values(DISH_INGREDIENTS_G).every(r => Object.values(r).every(v => Number.isInteger(v))), 'dish recipes are whole grams')

const withInn: ChainConfig = { ...config, hospitalityBreadKgPerDay: 40 }
const innNormal = simulateBreadChain(withInn, start(), 60)
check(innNormal.log.slice(3).every(d => d.shortfallKg < 1e-6 && d.hospitalityShortfallKg < 1e-6), 'household and inn are both supplied in normal operation')
const innBlocked = simulateBreadChain(withInn, start(), 60, roadBlocked)
const hit = innBlocked.log.filter(d => d.hospitalityShortfallKg > 1e-6)
check(hit.length > 0 && hit.every(d => d.day > 8), 'flour outage reaches the inn as well')
check(innBlocked.log.every(d => d.hospitalityShortfallKg < 1e-6 || d.hospitalityServedKg < d.hospitalityNeededKg), 'inn shortfall is consistent')
const breadOutInn = innBlocked.log.reduce((s, d) => s + d.breadEatenKg + d.spoiledBreadKg, 0)
check(near(grainEquivalent(innBlocked.nodes, innBlocked.inTransit, breadOutInn), before, 1e-3), 'mass balance holds with the inn')

if (failures) { console.error(`${failures} food chain checks failed`); process.exit(1) }
console.log('food chain: all checks passed')
