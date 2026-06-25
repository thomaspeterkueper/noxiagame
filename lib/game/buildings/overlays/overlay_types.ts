// lib/game/buildings/overlays/types.ts
// Erstellt:     24.06.2026
// Aktualisiert: 24.06.2026 — Initiale Version
// Version:      1.0.0
//
// Typen für das Overlay-System.
// Jedes Gebäude-Overlay beantwortet drei Fragen:
//   1. Was passiert hier?  → metrics
//   2. Was fehlt hier?     → alerts
//   3. Was kann ich tun?   → actions
// Plus: Warum ist das so? → insight

export type AlertLevel  = 'critical' | 'warning' | 'info' | 'good'
export type MetricTrend = 'up' | 'down' | 'stable'

export interface OverlayMetric {
  id:         string
  label:      string
  value:      string | number
  unit?:      string
  trend?:     MetricTrend
  warnBelow?: number        // Schwellenwert für automatische Warneinfärbung
  goodAbove?: number        // Schwellenwert für grüne Einfärbung
}

export interface OverlayAlert {
  id:      string
  level:   AlertLevel
  title:   string
  message: string
}

export interface OverlayAction {
  id:              string
  label:           string
  description?:    string
  disabled?:       boolean
  disabledReason?: string
}

export interface OverlayTab {
  id:    string
  label: string
}

export interface OverlayDef {
  id:       string
  title:    string
  subtitle: string

  metrics:  OverlayMetric[]   // Was passiert hier?
  alerts:   OverlayAlert[]    // Was fehlt / was läuft gut?
  actions:  OverlayAction[]   // Was kann ich tun?

  insight?: string            // Warum ist das so? (2–4 Sätze)
  tabs?:    OverlayTab[]      // Vertiefung für komplexe Gebäude
}

// ── Laufzeit-Kontext ──────────────────────────────────────────────────────────
// Alle Informationen die buildOverlayForBuilding zur Verfügung stehen.

export interface BuildingContext {
  entityId:     string
  locationSlug: string
  locationName: string
  builtAt?:     string

  population:    number
  populationMax: number
  stocks:        Record<string, number>   // { water: 120, energy: 80, metal: 200 }
  consumption:   Record<string, number>   // pro Tick gesamt
  production:    Record<string, number>   // pro Tick gesamt (alle Gebäude)

  prices:        Record<string, number>   // { metal: 45, energy: 62, water: 95 }

  credits:  number
  isOwn:    boolean
}
