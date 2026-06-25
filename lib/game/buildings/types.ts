// lib/game/buildings/types.ts
// Erstellt:     22.06.2026
// Aktualisiert: 25.06.2026 — OverlayDef und BuildingContext ergänzt
// Version:      1.1.0
//
// Single Source of Truth für alle Gebäude-Metadaten.

export type ResourceType = 'water' | 'energy' | 'metal'
export type LocationSlug = string
export type OverlayId = 'BankOverlay' | 'SchoolOverlay' | 'ShipyardOverlay' | 'AdminOverlay' | null

export type BuildingCategory =
  | 'production'
  | 'housing'
  | 'service'
  | 'infrastructure'
  | 'special'

export interface BuildingDef {
  id: string
  name: string
  category: BuildingCategory
  description: string
  cost: number
  buildTimeTicks: number
  produces?: {
    resource: ResourceType
    amount: number
  }
  populationBonus?: number
  allowedLocations?: LocationSlug[]
  blockedLocations?: LocationSlug[]
  overlay?: OverlayId
  planned?: boolean
  planHint?: string
  svgVariants?: Partial<Record<LocationSlug, string>>
  tileAsset?: string
}

export interface BuildingContext {
  locationSlug: string
  locationName: string
  isOwn: boolean
  production: Record<string, number>
  consumption: Record<string, number>
  stocks: Record<string, number>
  population?: number
  populationMax?: number
  credits?: number
}

export type OverlayTrend = 'up' | 'down' | 'stable' | 'critical'
export type OverlaySeverity = 'info' | 'success' | 'warning' | 'critical'

export interface OverlayMetric {
  id: string
  label: string
  value: number | string
  unit?: string
  trend?: OverlayTrend
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
}

export interface OverlayDef {
  id: string
  title: string
  subtitle?: string
  metrics: OverlayMetric[]
  alerts: OverlayAlert[]
  actions: OverlayAction[]
}
