// lib/game/buildings/types.ts
// Erstellt:     22.06.2026
// Aktualisiert: 29.08.2026 — externe Technikobjekt-Provenienz ohne Balancing-Kopplung
// Version:      1.5.0

export type ResourceType = 'water' | 'energy' | 'metal' | 'components'
export type LocationSlug = string
export type OverlayId = 'BankOverlay' | 'SchoolOverlay' | 'ShipyardOverlay' | 'AdminOverlay' | null

export type BuildingCategory =
  | 'production'
  | 'housing'
  | 'service'
  | 'infrastructure'
  | 'special'

/**
 * Read-only provenance binding to an externally canonical technical object.
 *
 * This metadata deliberately contains no gameplay values. Costs, production,
 * unlocks, ranges and other balancing stay NOXIA-owned and must never be
 * mutated automatically when the external source changes.
 */
export interface ExternalTechnicalObjectBinding {
  sourceSystem: 'OTA'
  sourceDocumentId: string
  canonicalId: string
  objectId: string
  mappingRole: 'buildable' | 'reference'
  evidenceImpactPolicy: 'signal-only'
}

export interface BuildingDef {
  id: string
  name: string
  category: BuildingCategory
  description: string
  cost: number
  buildTimeTicks: number
  produces?: { resource: ResourceType; amount: number }
  consumes?: { resource: ResourceType; amount: number }
  populationBonus?: number
  allowedLocations?: LocationSlug[]
  blockedLocations?: LocationSlug[]
  overlay?: OverlayId
  planned?: boolean
  planHint?: string
  svgVariants?: Partial<Record<LocationSlug, string>>
  tileAsset?: string
  externalTechnicalObject?: ExternalTechnicalObjectBinding
}

export interface BuildingContext {
  locationSlug:  string
  locationName:  string
  isOwn:         boolean
  isCorp?:       boolean
  owner_class?:  string
  production:    Record<string, number>
  consumption:   Record<string, number>
  stocks:        Record<string, number>
  population?:   number
  populationMax?: number
  credits?:      number
}

export type OverlayTrend = 'up' | 'down' | 'stable' | 'critical'
export type OverlaySeverity = 'info' | 'success' | 'warning' | 'critical'

export interface OverlayMetric {
  id: string
  label: string
  value: number | string
  unit?: string
  trend?: OverlayTrend
  hint?: string
}

export interface OverlayAlert {
  id: string
  severity: OverlaySeverity
  text: string
}

export interface OverlayAction {
  id: string
  label: string
  disabled?: boolean
  primary?: boolean
}

export interface OverlayDef {
  id: string
  title: string
  subtitle?: string
  metrics: OverlayMetric[]
  alerts: OverlayAlert[]
  actions: OverlayAction[]
  insight?: string
}
