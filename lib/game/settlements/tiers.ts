// lib/game/settlements/tiers.ts
// NOXIA settlement tiers — pure rules only. Thresholds are tuning parameters.

export type SettlementTierId = 0 | 1 | 2 | 3

export interface SettlementTierDefinition {
  id: SettlementTierId
  name: 'outpost' | 'settlement' | 'town' | 'city'
  enterPopulation: number
  requiredCapabilities: string[]
}

export const SETTLEMENT_TIER_THRESHOLDS = {
  settlement: 20,
  town: 100,
  city: 500,
} as const

export const SETTLEMENT_TIER_DOWNGRADE_FACTOR = 0.8

export const SOCIAL_HOSPITALITY_EQUIVALENTS = ['cafe', 'bar', 'q1_everyday_life'] as const

/**
 * Soziale Infrastruktur: Gebäude, die Begegnung ermöglichen. Café und Bar sind
 * die ersten Vertreter; Markt, Park, Freibad oder religiöse Orte nutzen später
 * dieselbe Struktur statt eines Sonderwegs.
 */
export interface SocialInfrastructureKind {
  /** Neue Spieler können hier ankommen (Startpunkt). */
  arrivalPoint: boolean
  /** Der Ort führt NPC-Gespräche über die npc-conversation-Pipeline. */
  hostsConversation: boolean
}

export const SOCIAL_INFRASTRUCTURE: Record<string, SocialInfrastructureKind> = {
  cafe: { arrivalPoint: true, hostsConversation: true },
  bar: { arrivalPoint: true, hostsConversation: true },
  // Das handgebaute Q1-Modul erfüllt die Stufe, ist aber kein Startpunkt.
  q1_everyday_life: { arrivalPoint: false, hostsConversation: false },
}

export function isSocialInfrastructure(buildingId: string): boolean {
  return buildingId in SOCIAL_INFRASTRUCTURE
}

export function arrivalPoints(buildingIds: Iterable<string>): string[] {
  return [...buildingIds].filter((id) => SOCIAL_INFRASTRUCTURE[id]?.arrivalPoint === true)
}

export const SETTLEMENT_TIERS: readonly SettlementTierDefinition[] = [
  { id: 0, name: 'outpost', enterPopulation: 0, requiredCapabilities: ['landing_or_docking', 'administration'] },
  { id: 1, name: 'settlement', enterPopulation: SETTLEMENT_TIER_THRESHOLDS.settlement, requiredCapabilities: ['social_hospitality'] },
  { id: 2, name: 'town', enterPopulation: SETTLEMENT_TIER_THRESHOLDS.town, requiredCapabilities: ['market', 'academy', 'clinic'] },
  { id: 3, name: 'city', enterPopulation: SETTLEMENT_TIER_THRESHOLDS.city, requiredCapabilities: ['park', 'leisure'] },
] as const

export function settlementTierForPopulation(population: number): SettlementTierId {
  const p = Math.max(0, Math.floor(Number(population) || 0))
  if (p >= SETTLEMENT_TIER_THRESHOLDS.city) return 3
  if (p >= SETTLEMENT_TIER_THRESHOLDS.town) return 2
  if (p >= SETTLEMENT_TIER_THRESHOLDS.settlement) return 1
  return 0
}

export function settlementTierWithHysteresis(input: {
  population: number
  currentTier: SettlementTierId
}): SettlementTierId {
  const target = settlementTierForPopulation(input.population)
  if (target >= input.currentTier) return target

  let tier = input.currentTier
  while (tier > target) {
    const enter = SETTLEMENT_TIERS[tier].enterPopulation
    if (input.population >= enter * SETTLEMENT_TIER_DOWNGRADE_FACTOR) break
    tier = (tier - 1) as SettlementTierId
  }
  return tier
}

export type SettlementCapabilityInput = {
  buildingIds: Iterable<string>
  locationType?: string | null
}

export function settlementCapabilities(input: SettlementCapabilityInput): Set<string> {
  const ids = new Set([...input.buildingIds])
  const out = new Set<string>()
  if (ids.has('landing_pad') || ids.has('docking_bay')) out.add('landing_or_docking')
  if (ids.has('admin') || ids.has('command_node')) out.add('administration')
  if (SOCIAL_HOSPITALITY_EQUIVALENTS.some(id => ids.has(id))) out.add('social_hospitality')
  if (ids.has('market')) out.add('market')
  if (ids.has('school') || ids.has('academy')) out.add('academy')
  if (ids.has('medical_core') || ids.has('clinic') || ids.has('medical_annex')) out.add('clinic')
  if (ids.has('park')) out.add('park')
  if (ids.has('pool') || ids.has('swimming_pool') || ids.has('leisure')) out.add('leisure')
  return out
}

export function missingSettlementCapabilities(input: {
  population: number
  currentTier?: SettlementTierId
  buildingIds: Iterable<string>
}): { tier: SettlementTierId; missing: string[] } {
  const tier = input.currentTier == null
    ? settlementTierForPopulation(input.population)
    : settlementTierWithHysteresis({ population: input.population, currentTier: input.currentTier })
  const have = settlementCapabilities({ buildingIds: input.buildingIds })
  const required = SETTLEMENT_TIERS
    .filter(def => def.id <= tier)
    .flatMap(def => def.requiredCapabilities)
  return { tier, missing: [...new Set(required)].filter(cap => !have.has(cap)) }
}
