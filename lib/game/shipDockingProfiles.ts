// lib/game/shipDockingProfiles.ts
// Canonical bridge between existing NOXIA ship/frame identifiers and docking.
//
// The game currently exposes two identifier layers:
// - engineering/gameplay frame ids in lib/game/ships.ts (mk1, fast, heavy, ...)
// - runtime ship_type ids from the DB/API (freighter_mk1, fast_courier, ...)
//
// This file normalizes both without inventing a third ship taxonomy.

import type { DockingVesselClass } from './docking'

export interface ShipDockingProfile {
  canonicalFrameId: string
  vesselClass: DockingVesselClass
  label: string
}

const SHIP_DOCKING_PROFILES: Readonly<Record<string, ShipDockingProfile>> = {
  mk1: {
    canonicalFrameId: 'mk1',
    vesselClass: 'intersolar-standard',
    label: 'Frachter Mk.I',
  },
  freighter_mk1: {
    canonicalFrameId: 'mk1',
    vesselClass: 'intersolar-standard',
    label: 'Frachter Mk.I',
  },
  fast: {
    canonicalFrameId: 'fast',
    vesselClass: 'intersolar-standard',
    label: 'Schnellfrachter',
  },
  fast_courier: {
    canonicalFrameId: 'fast',
    vesselClass: 'intersolar-standard',
    label: 'Schnellfrachter',
  },
  heavy: {
    canonicalFrameId: 'heavy',
    vesselClass: 'intersolar-heavy',
    label: 'Schwerfrachter',
  },
  heavy_hauler: {
    canonicalFrameId: 'heavy',
    vesselClass: 'intersolar-heavy',
    label: 'Schwerfrachter',
  },
  scout: {
    canonicalFrameId: 'scout',
    vesselClass: 'intersolar-standard',
    label: 'Erkundungsschiff',
  },
  pioneer: {
    canonicalFrameId: 'pioneer',
    vesselClass: 'intersolar-heavy',
    label: 'Pionier-Konstrukteur',
  },
  'asce-0.3p': {
    canonicalFrameId: 'asce-0.3p',
    vesselClass: 'surface-transfer-shuttle',
    label: 'ASCE 0.3P',
  },
}

export function getShipDockingProfile(shipTypeOrFrameId: string | null | undefined): ShipDockingProfile | null {
  if (!shipTypeOrFrameId) return null
  return SHIP_DOCKING_PROFILES[shipTypeOrFrameId] ?? null
}

export function getShipDockingVesselClass(shipTypeOrFrameId: string | null | undefined): DockingVesselClass | null {
  return getShipDockingProfile(shipTypeOrFrameId)?.vesselClass ?? null
}
