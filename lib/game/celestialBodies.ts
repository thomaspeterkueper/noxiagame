'use client'
// lib/game/celestialBodies.ts
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — Phase 1: Typen + Reisezeit-Konstanten
// Version:      1.0.0

export type BodyType = 'star' | 'planet' | 'moon' | 'asteroid' | 'lagrange' | 'belt'
export type LocationType = 'colony' | 'station' | 'outpost' | 'relay'
export type OrbitClass = 'LEO' | 'MEO' | 'GEO' | 'HEO'

export interface CelestialBody {
  id:                string
  name:              string
  slug:              string
  body_type:         BodyType
  parent_id:         string | null
  orbit_radius_au:   number | null
  orbit_period_d:    number | null
  surface_gravity:   number
  radius_km:         number | null
  has_atmosphere:    boolean
  atmosphere_type:   string | null
  map_x:             number
  map_y:             number
  description:       string | null
}

export interface LocationExtended {
  id:                string
  name:              string
  slug:              string
  location_type:     LocationType
  celestial_body_id: string | null
  surface_lat:       number | null
  surface_lon:       number | null
  grid_radius:       number
  orbit_altitude_km: number | null
  orbit_class:       OrbitClass | null
  orbit_inclination: number | null
  owner_id:          string | null
  founded_at:        string | null
  is_public:         boolean
  // Joined
  celestial_body?:   CelestialBody
}

// ── Orbit-Klassen ─────────────────────────────────────────────────────────────
export const ORBIT_CLASSES: Record<OrbitClass, {
  label:     string
  altitude:  number   // km
  period_h:  number   // ungefähre Umlaufzeit in Stunden (Erd-Referenz)
  cost_mult: number   // Kostenmultiplikator für Gründung
  desc:      string
}> = {
  LEO: {
    label:    'Niedriger Orbit (LEO)',
    altitude: 400,
    period_h: 1.5,
    cost_mult: 1.0,
    desc:     '~400 km — schnell erreichbar, häufige Überflüge, günstig',
  },
  MEO: {
    label:    'Mittlerer Orbit (MEO)',
    altitude: 2000,
    period_h: 3.0,
    cost_mult: 1.8,
    desc:     '~2.000 km — stabil, weniger Atmosphärenwiderstand',
  },
  GEO: {
    label:    'Geostationärer Orbit (GEO/Areo)',
    altitude: 36000,
    period_h: 24.0,
    cost_mult: 3.5,
    desc:     '~36.000 km — immer über gleichem Punkt, teuer aber strategisch wertvoll',
  },
  HEO: {
    label:    'Hoher Orbit / Lagrange (HEO)',
    altitude: 150000,
    period_h: 168.0,
    cost_mult: 6.0,
    desc:     'Lagrange-Punkte, sehr weit entfernt, maximale Stabilität',
  },
}

// ── Gründungskosten ────────────────────────────────────────────────────────────
export const FOUNDING_COSTS: Record<LocationType, number> = {
  colony:  25000,   // Planetare Kolonie — Terraforming-Ausrüstung nötig
  station: 15000,   // Raumstation — Modular, flexibler
  outpost:  8000,   // Kleiner Außenposten — minimal
  relay:    5000,   // Relaisstation — nur Kommunikation
}

// ── Reisezeit-Schätzung (Client-seitig, grob) ────────────────────────────────
// Genaue Berechnung via calc_travel_time_seconds() RPC
export function estimateTravelSeconds(
  fromOrbitAu: number,
  toOrbitAu:   number,
  speedMult:   number = 1.0
): number {
  const diff = Math.abs(fromOrbitAu - toOrbitAu)
  if (diff < 0.01) return 30                        // gleicher Körper
  const base = Math.sqrt(diff) * 86400 * 8          // vereinfachter Hohmann
  return Math.max(30, Math.round(base / speedMult))
}

// ── Bekannte Körper (IDs) ─────────────────────────────────────────────────────
export const CELESTIAL_IDS = {
  SUN:       '10000000-0000-0000-0000-000000000001',
  EARTH:     '10000000-0000-0000-0000-000000000002',
  MOON:      '10000000-0000-0000-0000-000000000003',
  MARS:      '10000000-0000-0000-0000-000000000004',
  PHOBOS:    '10000000-0000-0000-0000-000000000005',
  DEIMOS:    '10000000-0000-0000-0000-000000000006',
  CERES:     '10000000-0000-0000-0000-000000000007',
  JUPITER:   '10000000-0000-0000-0000-000000000008',
} as const
