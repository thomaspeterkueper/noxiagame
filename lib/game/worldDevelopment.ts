// lib/game/worldDevelopment.ts
// NOXIA world-development foundation.
//
// This module is deliberately projection-only. It does not persist state,
// grant unlocks, alter inventories, mutate prices, advance ticks or bypass
// authoritative Core commands. It turns explicit macro signals into a
// deterministic planning snapshot that other domains may consume later.

export const WORLD_DEVELOPMENT_DOMAIN_IDS = [
  'knowledge_technology',
  'energy_industry',
  'economy_logistics',
  'population_society',
  'climate_biosphere',
  'governance_institutions',
] as const

export type WorldDevelopmentDomainId = typeof WORLD_DEVELOPMENT_DOMAIN_IDS[number]
export type WorldDevelopmentPolarity = 'capacity' | 'pressure'

export interface WorldDevelopmentDomainDefinition {
  id: WorldDevelopmentDomainId
  label: string
  purpose: string
}

export const WORLD_DEVELOPMENT_DOMAINS: readonly WorldDevelopmentDomainDefinition[] = [
  {
    id: 'knowledge_technology',
    label: 'Knowledge & Technology',
    purpose: 'Research depth, compute, automation, biotechnology and the ability to turn knowledge into usable systems.',
  },
  {
    id: 'energy_industry',
    label: 'Energy & Industry',
    purpose: 'Grid capacity, dependable energy, industrial depth, maintenance, materials processing and circular production.',
  },
  {
    id: 'economy_logistics',
    label: 'Economy & Logistics',
    purpose: 'Physical supply chains, transport reach, orbital infrastructure, ISRU and the ability to move and service real goods.',
  },
  {
    id: 'population_society',
    label: 'Population & Society',
    purpose: 'Skills, demographic pressure, households, social cohesion, health, food and long-duration settlement viability.',
  },
  {
    id: 'climate_biosphere',
    label: 'Climate & Biosphere',
    purpose: 'Climate stress, water security, land productivity and ecological constraints that alter costs and viable locations.',
  },
  {
    id: 'governance_institutions',
    label: 'Governance & Institutions',
    purpose: 'Institutional capacity, cyber resilience, information trust and legal frameworks for increasingly distributed infrastructure.',
  },
] as const

export type WorldDevelopmentDriverId =
  | 'ai_automation'
  | 'compute_infrastructure'
  | 'research_capability'
  | 'biotechnology'
  | 'grid_capacity'
  | 'firm_energy'
  | 'fusion_maturity'
  | 'industrial_depth'
  | 'maintenance_capacity'
  | 'circularity'
  | 'critical_material_security'
  | 'surface_logistics'
  | 'orbital_logistics'
  | 'isru_maturity'
  | 'closed_loop_life_support'
  | 'skills_depth'
  | 'demographic_pressure'
  | 'social_cohesion'
  | 'food_security'
  | 'water_security'
  | 'climate_stress'
  | 'institutional_capacity'
  | 'cyber_resilience'
  | 'information_trust'
  | 'resource_law_framework'

export interface WorldDevelopmentDriverDefinition {
  id: WorldDevelopmentDriverId
  domain: WorldDevelopmentDomainId
  polarity: WorldDevelopmentPolarity
  label: string
  description: string
  consumers: readonly string[]
}

export const WORLD_DEVELOPMENT_DRIVERS: readonly WorldDevelopmentDriverDefinition[] = [
  { id: 'ai_automation', domain: 'knowledge_technology', polarity: 'capacity', label: 'AI & automation', description: 'Operational autonomy across planning, robotics and routine industrial work.', consumers: ['production', 'maintenance', 'research', 'settlement operations'] },
  { id: 'compute_infrastructure', domain: 'knowledge_technology', polarity: 'capacity', label: 'Compute infrastructure', description: 'Available classical/HPC/accelerator infrastructure; quantum systems remain specialist coprocessors rather than generic replacements.', consumers: ['research', 'AI', 'simulation', 'navigation'] },
  { id: 'research_capability', domain: 'knowledge_technology', polarity: 'capacity', label: 'Research capability', description: 'Ability to perform, validate and operationalize scientific research.', consumers: ['knowledge', 'technology adoption', 'materials', 'medicine'] },
  { id: 'biotechnology', domain: 'knowledge_technology', polarity: 'capacity', label: 'Biotechnology', description: 'Biological production, medicine, food systems and life-support engineering.', consumers: ['health', 'food', 'closed-loop systems'] },

  { id: 'grid_capacity', domain: 'energy_industry', polarity: 'capacity', label: 'Grid capacity', description: 'Transmission, distribution, storage and controllability available to move electrical energy where it is needed.', consumers: ['industry', 'settlements', 'transport', 'life support'] },
  { id: 'firm_energy', domain: 'energy_industry', polarity: 'capacity', label: 'Firm energy', description: 'Dependable energy supply after intermittency, storage and local operating constraints.', consumers: ['industry', 'habitats', 'compute', 'ISRU'] },
  { id: 'fusion_maturity', domain: 'energy_industry', polarity: 'capacity', label: 'Fusion maturity', description: 'Practical maturity of fusion plants including materials, maintenance and fuel-cycle constraints.', consumers: ['energy', 'deep-space industry'] },
  { id: 'industrial_depth', domain: 'energy_industry', polarity: 'capacity', label: 'Industrial depth', description: 'Breadth of fabrication, refining, machine-tool and component supply chains.', consumers: ['build', 'vehicles', 'stations', 'repair'] },
  { id: 'maintenance_capacity', domain: 'energy_industry', polarity: 'capacity', label: 'Maintenance capacity', description: 'Ability to inspect, repair, refurbish and replace infrastructure instead of treating assets as permanent.', consumers: ['condition', 'vehicles', 'stations', 'industry'] },
  { id: 'circularity', domain: 'energy_industry', polarity: 'capacity', label: 'Circularity', description: 'Fraction of material flows that can be recovered, remanufactured and reused.', consumers: ['resource demand', 'waste', 'off-world settlements'] },
  { id: 'critical_material_security', domain: 'energy_industry', polarity: 'capacity', label: 'Critical material security', description: 'Reliability of access to strategically constrained materials and processing chains.', consumers: ['build', 'energy', 'electronics', 'propulsion'] },

  { id: 'surface_logistics', domain: 'economy_logistics', polarity: 'capacity', label: 'Surface logistics', description: 'Road, rail, rover, depot and local cargo throughput on planetary surfaces.', consumers: ['transport', 'market', 'construction'] },
  { id: 'orbital_logistics', domain: 'economy_logistics', polarity: 'capacity', label: 'Orbital logistics', description: 'Launch, docking, depots, transfer nodes, servicing and orbital cargo throughput.', consumers: ['orbit', 'travel', 'shipyards', 'market'] },
  { id: 'isru_maturity', domain: 'economy_logistics', polarity: 'capacity', label: 'ISRU maturity', description: 'Ability to extract and process useful materials away from Earth using local feedstocks.', consumers: ['Moon', 'Mars', 'asteroids', 'propellant'] },
  { id: 'closed_loop_life_support', domain: 'economy_logistics', polarity: 'capacity', label: 'Closed-loop life support', description: 'Recovery and recycling performance for water, atmosphere, nutrients and other settlement essentials.', consumers: ['habitats', 'stations', 'Mars', 'long-duration missions'] },

  { id: 'skills_depth', domain: 'population_society', polarity: 'capacity', label: 'Skills depth', description: 'Availability and redundancy of the skills needed to operate advanced infrastructure.', consumers: ['population', 'industry', 'research', 'maintenance'] },
  { id: 'demographic_pressure', domain: 'population_society', polarity: 'pressure', label: 'Demographic pressure', description: 'Age structure, dependency, migration and population imbalance that strain available institutions and labor.', consumers: ['population', 'labor', 'settlements'] },
  { id: 'social_cohesion', domain: 'population_society', polarity: 'capacity', label: 'Social cohesion', description: 'Ability of households, crews and communities to sustain cooperation under long-term pressure.', consumers: ['population', 'governance', 'settlement resilience'] },
  { id: 'food_security', domain: 'population_society', polarity: 'capacity', label: 'Food security', description: 'Resilience and adequacy of food production and distribution.', consumers: ['population', 'trade', 'settlements'] },

  { id: 'water_security', domain: 'climate_biosphere', polarity: 'capacity', label: 'Water security', description: 'Reliable access to usable water after local scarcity, infrastructure and competing demand.', consumers: ['population', 'agriculture', 'industry', 'ISRU'] },
  { id: 'climate_stress', domain: 'climate_biosphere', polarity: 'pressure', label: 'Climate stress', description: 'Combined physical pressure from heat, drought, flooding, fire and other climate-linked hazards.', consumers: ['land value', 'buildability', 'population', 'infrastructure'] },

  { id: 'institutional_capacity', domain: 'governance_institutions', polarity: 'capacity', label: 'Institutional capacity', description: 'Ability to coordinate rules, public infrastructure and crisis response at the required scale.', consumers: ['economy', 'population', 'infrastructure'] },
  { id: 'cyber_resilience', domain: 'governance_institutions', polarity: 'capacity', label: 'Cyber resilience', description: 'Ability of increasingly autonomous infrastructure to resist, contain and recover from digital failures or attacks.', consumers: ['AI', 'grid', 'logistics', 'stations'] },
  { id: 'information_trust', domain: 'governance_institutions', polarity: 'capacity', label: 'Information trust', description: 'Reliability, provenance and social acceptance of operational information in an AI-saturated environment.', consumers: ['governance', 'markets', 'research', 'population'] },
  { id: 'resource_law_framework', domain: 'governance_institutions', polarity: 'capacity', label: 'Resource-law framework', description: 'Legal clarity for ownership, extraction, liability and shared infrastructure beyond Earth.', consumers: ['claims', 'market', 'ISRU', 'orbital industry'] },
] as const

export interface WorldDevelopmentSignal {
  driverId: WorldDevelopmentDriverId
  /** Normalized explicit input. 0 = absent/minimal, 1 = maximal. */
  value: number
  /** Traceable authority/provenance. This module never invents a source. */
  sourceRef: string
}

export interface WorldDevelopmentPhase {
  id: 'electrification_autonomy' | 'offworld_bootstrap' | 'earth_moon_system' | 'solar_logistics'
  startYear: number
  endYear: number
  label: string
  character: string
}

export const NOXIA_BASELINE_PHASES: readonly WorldDevelopmentPhase[] = [
  { id: 'electrification_autonomy', startYear: 2045, endYear: 2059, label: 'Electrification & autonomy', character: 'Grid build-out, AI/robotics, climate adaptation and commercial orbital growth dominate bottlenecks.' },
  { id: 'offworld_bootstrap', startYear: 2060, endYear: 2079, label: 'Off-world industrial bootstrap', character: 'Robotic precursors, lunar ISRU, depots, servicing and early Mars infrastructure begin to reduce Earth-launch dependence.' },
  { id: 'earth_moon_system', startYear: 2080, endYear: 2099, label: 'Earth–Moon industrial system', character: 'Orbital yards, cislunar logistics, larger settlements and increasingly closed material loops become economically meaningful.' },
  { id: 'solar_logistics', startYear: 2100, endYear: 2125, label: 'Solar-system logistics', character: 'Lagrange nodes, asteroid resources, specialized off-world industry and interplanetary supply chains form a connected infrastructure economy.' },
] as const

export type WorldDevelopmentSignalState = 'critical' | 'constrained' | 'developing' | 'strong'

export interface EvaluatedWorldDevelopmentSignal extends WorldDevelopmentSignal {
  domain: WorldDevelopmentDomainId
  polarity: WorldDevelopmentPolarity
  label: string
  normalizedValue: number
  state: WorldDevelopmentSignalState
}

export interface WorldDevelopmentProjection {
  year: number
  phase: WorldDevelopmentPhase | null
  signals: EvaluatedWorldDevelopmentSignal[]
  bottlenecks: EvaluatedWorldDevelopmentSignal[]
  strengths: EvaluatedWorldDevelopmentSignal[]
}

const DRIVER_BY_ID = new Map<WorldDevelopmentDriverId, WorldDevelopmentDriverDefinition>(
  WORLD_DEVELOPMENT_DRIVERS.map(driver => [driver.id, driver]),
)

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function classify(definition: WorldDevelopmentDriverDefinition, value: number): WorldDevelopmentSignalState {
  if (definition.polarity === 'capacity') {
    if (value < 0.25) return 'critical'
    if (value < 0.5) return 'constrained'
    if (value < 0.75) return 'developing'
    return 'strong'
  }

  if (value >= 0.75) return 'critical'
  if (value >= 0.5) return 'constrained'
  if (value >= 0.25) return 'developing'
  return 'strong'
}

export function getWorldDevelopmentPhase(year: number): WorldDevelopmentPhase | null {
  if (!Number.isFinite(year)) return null
  return NOXIA_BASELINE_PHASES.find(phase => year >= phase.startYear && year <= phase.endYear) ?? null
}

/**
 * Builds a read-only causal/planning projection from explicit macro signals.
 *
 * Important: this result is not an unlock, modifier, market price, production
 * result or persisted simulation state. A future consumer must translate a
 * justified signal through the existing authoritative Core/domain command.
 */
export function deriveWorldDevelopmentProjection(input: {
  year: number
  signals: readonly WorldDevelopmentSignal[]
}): WorldDevelopmentProjection {
  const seen = new Set<WorldDevelopmentDriverId>()
  const evaluated = input.signals.map(signal => {
    if (seen.has(signal.driverId)) {
      throw new Error(`Duplicate world-development driver: ${signal.driverId}`)
    }
    seen.add(signal.driverId)

    const definition = DRIVER_BY_ID.get(signal.driverId)
    if (!definition) {
      throw new Error(`Unknown world-development driver: ${signal.driverId}`)
    }
    if (!signal.sourceRef.trim()) {
      throw new Error(`Missing sourceRef for world-development driver: ${signal.driverId}`)
    }

    const normalizedValue = clamp01(signal.value)
    return {
      ...signal,
      domain: definition.domain,
      polarity: definition.polarity,
      label: definition.label,
      normalizedValue,
      state: classify(definition, normalizedValue),
    }
  }).sort((a, b) => a.domain.localeCompare(b.domain) || a.driverId.localeCompare(b.driverId))

  return {
    year: input.year,
    phase: getWorldDevelopmentPhase(input.year),
    signals: evaluated,
    bottlenecks: evaluated.filter(signal => signal.state === 'critical' || signal.state === 'constrained'),
    strengths: evaluated.filter(signal => signal.state === 'strong'),
  }
}
