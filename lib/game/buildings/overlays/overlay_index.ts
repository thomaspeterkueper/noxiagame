// lib/game/buildings/overlays/index.ts
// Erstellt:     24.06.2026
// Aktualisiert: 24.06.2026 — Saubere Re-Export-Struktur
// Version:      2.0.0
//
// Zentrale Exportstelle — enthält keine Logik.
// Struktur:
//   types.ts        → OverlayDef, Metric, Alert, Action, BuildingContext
//   mineOverlay.ts  → Mine als Referenz-Implementierung
//   overlayBuilder.ts → buildOverlayForBuilding (alle Gebäude)

export * from './types'
export * from './mineOverlay'
export * from './overlayBuilder'
