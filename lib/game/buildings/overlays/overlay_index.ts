// lib/game/buildings/overlays/overlay_index.ts
// Erstellt:     24.06.2026
// Aktualisiert: 25.06.2026 — Kompatibilitäts-Reexport auf aktuelle Overlay-Struktur
// Version:      2.0.1

export type {
  OverlayDef,
  BuildingContext,
  OverlayMetric,
  OverlayAlert,
  OverlayAction,
  OverlayTrend,
  OverlaySeverity,
} from '../types'

export * from './mine'
export * from './index'
