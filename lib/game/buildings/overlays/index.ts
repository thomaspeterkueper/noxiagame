// lib/game/buildings/overlays/index.ts
// Erstellt:     24.06.2026
// Aktualisiert: 24.06.2026 — Initiale Version: Dispatcher + Generischer Fallback
// Version:      1.0.0
//
// Zentrale Funktion für das Overlay-System.
// Aufruf: buildOverlayForBuilding(entityId, context)
//
// Neue Gebäude: eigene Datei in overlays/ anlegen, hier eintragen.
// Fallback: generischer Overlay für alle unbekannten Gebäude.

import type { OverlayDef, BuildingContext } from '../types'
import { buildMineOverlay,  MINE_OVERLAY_STATIC  } from './mine'
// Weitere Imports kommen hier dazu:
// import { buildSolarOverlay,   SOLAR_OVERLAY_STATIC  } from './solar'
// import { buildHabitatOverlay, HABITAT_OVERLAY_STATIC } from './habitat'

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function buildOverlayForBuilding(
  entityId: string,
  ctx: BuildingContext
): OverlayDef {
  switch (entityId) {
    case 'mine':
      return buildMineOverlay(ctx)
    // case 'solar':
    //   return buildSolarOverlay(ctx)
    // case 'habitat':
    //   return buildHabitatOverlay(ctx)
    default:
      return buildGenericOverlay(entityId, ctx)
  }
}

// ── Statische Vorlagen (für Server-Side oder Fallback ohne Kontext) ─────────────

export const STATIC_OVERLAYS: Record<string, OverlayDef> = {
  mine: MINE_OVERLAY_STATIC,
}

// ── Generischer Fallback ──────────────────────────────────────────────────────
// Für alle Gebäude ohne eigene Overlay-Datei.
// Zeigt Basisinfos aus BuildingContext — immer besser als nichts.

function buildGenericOverlay(entityId: string, ctx: BuildingContext): OverlayDef {
  const metrics = []

  // Produktion falls vorhanden
  const produced = Object.entries(ctx.production)
    .filter(([, v]) => v > 0)
  for (const [res, amount] of produced) {
    metrics.push({
      id:    `${res}_output`,
      label: resLabel(res) + ' Produktion',
      value: amount,
      unit:  '/Tick',
      trend: 'stable' as const,
    })
  }

  // Relevante Lagerbestände
  for (const [res, amount] of produced) {
    const stock = ctx.stocks[res] ?? 0
    metrics.push({
      id:    `${res}_stock`,
      label: resLabel(res) + ' Lager',
      value: stock,
      unit:  't',
      trend: 'stable' as const,
    })
  }

  return {
    id:       entityId,
    title:    entityId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    subtitle: ctx.locationName,
    metrics,
    alerts:  [],
    actions: ctx.isOwn ? [{
      id:    'sell_building',
      label: 'Gebäude bewerten & verkaufen',
    }] : [],
  }
}

function resLabel(res: string): string {
  const map: Record<string, string> = {
    metal: 'Metall', energy: 'Energie', water: 'Wasser',
  }
  return map[res] ?? res
}
