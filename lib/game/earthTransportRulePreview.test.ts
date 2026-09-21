import {
  EARTH_TRANSPORT_RULE_CORE_CONTRACT,
  evaluateEarthTransportRuleIntent,
  type EarthTransportRuleIntent,
} from './earthTransportRulePreview'
import type { EarthSurfaceRoutePlan } from './earthSurfaceRouting'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const route: EarthSurfaceRoutePlan = {
  ok: true,
  segments: [],
  polyline: [],
  distanceM: 1200,
  roadDistanceM: 1200,
  offroadDistanceM: 0,
  relativeTimeCostM: 1200,
  energyMultiplier: 1,
  wearMultiplier: 1,
  sourceSnap: { lat: 51.3, lon: 7.9 },
  destinationSnap: { lat: 51.31, lon: 7.91 },
}

const surplus: EarthTransportRuleIntent = {
  kind: 'surplus-transfer',
  sourceInventoryId: 'mine',
  destinationInventoryId: 'refinery',
  resource: 'copper_ore',
  thresholdAmount: 20,
  maxAmount: 15,
}

const surplusResult = evaluateEarthTransportRuleIntent({
  intent: surplus,
  sourceStock: [{ resource: 'copper_ore', amount: 48, unit: 't' }],
  destinationStock: [{ resource: 'copper_ore', amount: 2, unit: 't' }],
  route,
})
assert(surplusResult.triggerMet, 'a stock above the threshold must arm the rule')
assert(surplusResult.plannedAmount === 15, 'the per-run maximum must bound the transferred amount')
assert(surplusResult.routeState === 'validated', 'an Earth-validated route must be reported as validated')
assert(surplusResult.blockers.length === 0, 'a fully resolved rule preview has no blockers')
assert(surplusResult.requiredCoreContract === EARTH_TRANSPORT_RULE_CORE_CONTRACT, 'the preview must name the missing Core contract')

const cappedBySurplus = evaluateEarthTransportRuleIntent({
  intent: { ...surplus, maxAmount: null },
  sourceStock: [{ resource: 'copper_ore', amount: 27 }],
  destinationStock: [],
  route,
})
assert(cappedBySurplus.plannedAmount === 7, 'without a maximum the whole surplus moves')

const idle = evaluateEarthTransportRuleIntent({
  intent: surplus,
  sourceStock: [{ resource: 'copper_ore', amount: 20 }],
  destinationStock: [],
  route,
})
assert(!idle.triggerMet && idle.plannedAmount === null, 'exactly at the threshold the rule stays idle')

const reservedOnly = evaluateEarthTransportRuleIntent({
  intent: surplus,
  sourceStock: [{ resource: 'copper_ore', amount: 50, available: 4 }],
  destinationStock: [],
  route,
})
assert(reservedOnly.sourceAmount === 4, 'reserved stock must not be offered to an automatic rule')

const minimumStock: EarthTransportRuleIntent = {
  kind: 'minimum-stock',
  sourceInventoryId: 'water-source',
  destinationInventoryId: 'spaceport-storage',
  resource: 'water',
  thresholdAmount: 40,
  maxAmount: null,
}

const shortfall = evaluateEarthTransportRuleIntent({
  intent: minimumStock,
  sourceStock: [{ resource: 'water', amount: 100 }],
  destinationStock: [{ resource: 'water', amount: 12 }],
  route,
})
assert(shortfall.triggerMet && shortfall.plannedAmount === 28, 'a minimum stock rule must move exactly the shortfall')

const emptySource = evaluateEarthTransportRuleIntent({
  intent: minimumStock,
  sourceStock: [{ resource: 'water', amount: 0 }],
  destinationStock: [{ resource: 'water', amount: 12 }],
  route,
})
assert(emptySource.triggerMet && emptySource.plannedAmount === null, 'an empty source must not yield a planned amount')
assert(emptySource.blockers.length === 1, 'an empty source must be reported as a concrete blocker')

const blockedRoute = evaluateEarthTransportRuleIntent({
  intent: minimumStock,
  sourceStock: [{ resource: 'water', amount: 100 }],
  destinationStock: [{ resource: 'water', amount: 0 }],
  route: { ok: false, reason: 'disconnected-road-network' },
})
assert(blockedRoute.routeState === 'blocked' && blockedRoute.blockers.length === 1, 'a blocked Earth route must be visible as a rule blocker')

const missingRoute = evaluateEarthTransportRuleIntent({
  intent: minimumStock,
  sourceStock: [{ resource: 'water', amount: 100 }],
  destinationStock: [{ resource: 'water', amount: 0 }],
})
assert(missingRoute.routeState === 'missing', 'without an Earth route check the rule stays unresolved')

const sameNode = evaluateEarthTransportRuleIntent({
  intent: { ...minimumStock, destinationInventoryId: 'water-source' },
  sourceStock: [{ resource: 'water', amount: 100 }],
  destinationStock: [{ resource: 'water', amount: 0 }],
  route,
})
assert(sameNode.blockers.some(blocker => blocker.includes('verschiedene')), 'a rule within one node must be refused')

const invalidThreshold = evaluateEarthTransportRuleIntent({
  intent: { ...minimumStock, thresholdAmount: 0 },
  sourceStock: [],
  destinationStock: [],
  route,
})
assert(invalidThreshold.blockers.length === 1, 'an empty stock snapshot is a real zero and only the threshold is refused')

const unresolvedStock = evaluateEarthTransportRuleIntent({
  intent: minimumStock,
  sourceStock: null,
  destinationStock: undefined,
  route,
})
assert(unresolvedStock.sourceAmount === null, 'a missing snapshot stays unresolved instead of counting as zero')
assert(unresolvedStock.blockers.some(blocker => blocker.includes('Bestand')), 'unresolved stock must be reported as a blocker')

const otherResourceIgnored = evaluateEarthTransportRuleIntent({
  intent: surplus,
  sourceStock: [{ resource: 'copper_ore', amount: 48 }, { resource: 'energy', amount: 900 }],
  destinationStock: [],
  route,
})
assert(otherResourceIgnored.sourceAmount === 48, 'only the rule resource may count towards a rule')

console.log('earth transport rule preview tests passed')
