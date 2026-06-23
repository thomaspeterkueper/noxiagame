// lib/game/buildings/types.ts
// Erstellt:     22.06.2026
// Aktualisiert: 22.06.2026 — Initiale Version: zentrales BuildingDef-Schema
// Version:      1.0.0
//
// Single Source of Truth für alle Gebäude-Metadaten.
// Ersetzt schrittweise:
//   - BUILDABLE_ITEMS in config.ts      (Kosten, Produktion)
//   - BUILDING_NAMES in ColonyGrid.tsx  (Anzeigenamen)
//   - PRODUCES in tick.ts               (Ressourcenproduktion, dupliziert)
//   - BuildableId in buildingSale.ts    (hartcodierte Union)
//   - PLANNED_BUILDINGS in config.ts    (geplante Gebäude)
//
// Migration: Bestehende Importe zeigen weiter auf config.ts bis alle
// Aufrufer migriert sind. buildings/index.ts re-exportiert kompatible
// Formen für den Übergang.

export type ResourceType   = 'water' | 'energy' | 'metal'
export type LocationSlug   = string
export type OverlayId      = 'BankOverlay' | 'SchoolOverlay' | 'ShipyardOverlay' | 'AdminOverlay' | null

export type BuildingCategory =
  | 'production'    // Mine, Solar, Eisbohrung, Wasserrecycler
  | 'housing'       // Habitat
  | 'service'       // Bank, Akademie, Verwaltung
  | 'infrastructure'// Werft, Warenhaus, Scanner
  | 'special'       // NPCs, Events, einmalig

export interface BuildingDef {
  // ── Identität ───────────────────────────────────────────────────────────
  id:          string               // entity_id in DB, z.B. 'mine'
  name:        string               // Anzeigename, z.B. 'Mine'
  category:    BuildingCategory
  description: string               // Kurzbeschreibung für Tooltip + BauDialog

  // ── Ökonomie ────────────────────────────────────────────────────────────
  cost:          number             // Baukosten in Cr
  buildTimeTicks: number            // Bauzeit in Ticks (1 Tick = 1 Cron-Lauf)

  // ── Produktion (optional) ───────────────────────────────────────────────
  produces?: {
    resource: ResourceType
    amount:   number                // Einheiten pro Tick
  }
  populationBonus?: number          // +N max. Bevölkerung (Habitat)

  // ── Geo-Gating ──────────────────────────────────────────────────────────
  allowedLocations?: LocationSlug[] // undefined = überall baubar
  blockedLocations?: LocationSlug[] // Ausschlussliste (alternativ)

  // ── UI ──────────────────────────────────────────────────────────────────
  overlay?:  OverlayId              // welches Overlay öffnet Klick auf dieses Gebäude?
  planned?:  boolean                // true = im Bau-Dialog sichtbar aber nicht baubar
  planHint?: string                 // Hinweis für geplante Gebäude

  // ── Visuals (zukunftssicher) ─────────────────────────────────────────────
  // Aktuell: BuildingSVG.tsx rendert nach entity_id.
  // Später: SVG-String oder Asset-Pfad direkt hier.
  svgVariants?: Partial<Record<LocationSlug, string>>  // location-spezifische SVG-Overrides
  tileAsset?:  string               // Pfad unter /public/images/grid/{slug}/{id}.png
}
