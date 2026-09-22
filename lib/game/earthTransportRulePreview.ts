// lib/game/earthTransportRulePreview.ts
// Earth-owned preview of automatic surface transport rules.
//
// Earth owns only the planet-specific part of a transport rule: whether the rule
// would trigger on the observed Core stock, and whether Earth can actually route
// the resulting cargo move. The rule model itself, its persistence, reservations,
// inventory mutation and execution stay Core-owned. This module therefore
// evaluates an intent and reports the missing shared contract instead of storing
// or executing anything.

import type { EarthSurfaceRoutePlanResult } from './earthSurfaceRouting'
import { earthRouteFailureWarning } from './earthTransportOverlay'

/**
 * Shared contract Earth cannot supply itself. Until Core provides it, the Earth
 * UX may preview a rule but never persist or run one.
 */
export const EARTH_TRANSPORT_RULE_CORE_CONTRACT = 'core-transport-rule-v1' as const

export type EarthTransportRuleKind =
  /** "Wenn Kupfererz > 20 t → bringe bis zu 15 t zur Raffinerie" */
  | 'surplus-transfer'
  /** "Halte im Raumhafenlager mindestens 40 t Wasser vor." */
  | 'minimum-stock'

export interface EarthTransportRuleIntent {
  kind: EarthTransportRuleKind
  sourceInventoryId: string
  destinationInventoryId: string
  resource: string
  /** Stock level that triggers the rule (surplus) or must be kept (minimum). */
  thresholdAmount: number
  /** Upper bound for a single surplus transfer. */
  maxAmount: number | null
}

export interface EarthTransportRuleStockEntry {
  resource: string
  amount: number
  available?: number
  unit?: string | null
}

export type EarthTransportRuleRouteState = 'validated' | 'blocked' | 'missing'

export interface EarthTransportRuleEvaluation {
  kind: EarthTransportRuleKind
  triggerMet: boolean
  sourceAmount: number | null
  destinationAmount: number | null
  /** Amount Earth would move if the rule fired; still reserved by Core. */
  plannedAmount: number | null
  routeState: EarthTransportRuleRouteState
  blockers: string[]
  /** Core contract this preview depends on before anything may be persisted. */
  requiredCoreContract: typeof EARTH_TRANSPORT_RULE_CORE_CONTRACT
}

export interface EarthTransportRuleEvaluationInput {
  intent: EarthTransportRuleIntent
  /** Core snapshot of the source. `null` means "not loaded yet", `[]` means "empty". */
  sourceStock?: readonly EarthTransportRuleStockEntry[] | null
  destinationStock?: readonly EarthTransportRuleStockEntry[] | null
  /** Earth route for source → destination, exactly as the manual flow validates it. */
  route?: EarthSurfaceRoutePlanResult | null
}

function usableAmount(entry: EarthTransportRuleStockEntry) {
  const available = entry.available ?? entry.amount
  return Number.isFinite(available) && available > 0 ? available : 0
}

function stockFor(stock: readonly EarthTransportRuleStockEntry[] | null | undefined, resource: string) {
  // An empty snapshot is a real zero; only a missing snapshot stays unresolved.
  if (!stock) return null
  return stock
    .filter(entry => entry.resource === resource)
    .reduce((sum, entry) => sum + usableAmount(entry), 0)
}

function routeStateOf(input: EarthTransportRuleEvaluationInput): { state: EarthTransportRuleRouteState; blocker: string | null } {
  if (!input.route) return { state: 'missing', blocker: 'Für die Regel wurde noch keine Earth-Route geprüft.' }
  if ('reason' in input.route) {
    return { state: 'blocked', blocker: earthRouteFailureWarning(input.route) ?? 'Die Earth-Route der Regel ist blockiert.' }
  }
  return { state: 'validated', blocker: null }
}

/**
 * Evaluate a rule intent against the Core stock Earth already observes plus the
 * Earth route the manual flow would use. Pure and read-only: it returns what the
 * rule would do, never what has been scheduled.
 */
export function evaluateEarthTransportRuleIntent(
  input: EarthTransportRuleEvaluationInput,
): EarthTransportRuleEvaluation {
  const { intent } = input
  const blockers: string[] = []

  if (!Number.isFinite(intent.thresholdAmount) || intent.thresholdAmount <= 0) {
    blockers.push('Der Schwellwert der Regel muss eine positive Menge sein.')
  }
  if (intent.kind === 'surplus-transfer' && intent.maxAmount != null
    && (!Number.isFinite(intent.maxAmount) || intent.maxAmount <= 0)) {
    blockers.push('Die maximale Transportmenge muss positiv sein, wenn sie begrenzt wird.')
  }
  if (intent.sourceInventoryId === intent.destinationInventoryId) {
    blockers.push('Quelle und Ziel einer Transportregel müssen verschiedene Knoten sein.')
  }
  if (!intent.resource.trim()) blockers.push('Es ist kein Gut für die Regel gewählt.')

  const sourceAmount = stockFor(input.sourceStock, intent.resource)
  const destinationAmount = stockFor(input.destinationStock, intent.resource)
  if (sourceAmount == null || destinationAmount == null) {
    blockers.push('Für die Regel liegt noch kein aufgelöster Bestand beider Knoten vor.')
  }

  const route = routeStateOf(input)
  if (route.blocker) blockers.push(route.blocker)

  let triggerMet = false
  let plannedAmount: number | null = null

  if (sourceAmount != null && destinationAmount != null && intent.resource.trim()) {
    if (intent.kind === 'surplus-transfer') {
      const surplus = sourceAmount - intent.thresholdAmount
      triggerMet = surplus > 0
      plannedAmount = triggerMet ? (intent.maxAmount == null ? surplus : Math.min(surplus, intent.maxAmount)) : null
    } else {
      const shortfall = intent.thresholdAmount - destinationAmount
      triggerMet = shortfall > 0
      plannedAmount = triggerMet ? Math.min(shortfall, sourceAmount) : null
    }
    if (triggerMet && !(plannedAmount != null && plannedAmount > 0)) {
      plannedAmount = null
      blockers.push('Die Regel greift, aber die Quelle kann die benötigte Menge nicht liefern.')
    }
  }

  return {
    kind: intent.kind,
    triggerMet,
    sourceAmount,
    destinationAmount,
    plannedAmount,
    routeState: route.state,
    blockers,
    requiredCoreContract: EARTH_TRANSPORT_RULE_CORE_CONTRACT,
  }
}
