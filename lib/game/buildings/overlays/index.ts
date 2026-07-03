// lib/game/buildings/overlays/index.ts
// Erstellt:     24.06.2026
// Aktualisiert: 26.06.2026 — ice_drill, water_recycler, scanner eingetragen
// Version:      1.2.0
//
// Zentrale Funktion für das Overlay-System.
// Aufruf: buildOverlayForBuilding(entityId, context)
//
// Neue Gebäude: eigene Datei in overlays/ anlegen, hier eintragen.
// Fallback: generischer Overlay für alle unbekannten Gebäude.

import type { OverlayDef, BuildingContext } from '../types'
import { buildMineOverlay, MINE_OVERLAY_STATIC } from './mine'
import { buildSolarOverlay } from './solar'
import { buildHabitatOverlay } from './habitat'
import { buildIceDrillOverlay } from './ice_drill'
import { buildWaterRecyclerOverlay } from './water_recycler'
import { buildScannerOverlay } from './scanner'

export function buildOverlayForBuilding(
  entityId: string,
  ctx: BuildingContext
): OverlayDef {
  switch (entityId) {
    case 'mine': return buildMineOverlay(ctx)
    case 'solar': return buildSolarOverlay(ctx)
    case 'habitat': return buildHabitatOverlay(ctx)
    case 'ice_drill': return buildIceDrillOverlay(ctx)
    case 'water_recycler': return buildWaterRecyclerOverlay(ctx)
    case 'scanner': return buildScannerOverlay(ctx)
    default:
      return buildGenericOverlay(entityId, ctx)
  }
}

export const STATIC_OVERLAYS: Record<string, OverlayDef> = {
  mine: MINE_OVERLAY_STATIC,
}

function buildGenericOverlay(entityId: string, ctx: BuildingContext): OverlayDef {
  const metrics = []
  const produced = Object.entries(ctx.production).filter(([, v]) => v > 0)

  for (const [res, amount] of produced) {
    metrics.push({
      id: `${res}_output`,
      label: resLabel(res) + ' Produktion',
      value: amount,
      unit: '/Tick',
      trend: 'stable' as const,
    })
  }

  for (const [res] of produced) {
    const stock = ctx.stocks[res] ?? 0
    metrics.push({
      id: `${res}_stock`,
      label: resLabel(res) + ' Lager',
      value: stock,
      unit: 't',
      trend: 'stable' as const,
    })
  }

  return {
    id: entityId,
    title: entityId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    subtitle: ctx.locationName,
    metrics,
    alerts: [],
    actions: ctx.isOwn ? [{
      id: 'sell_building',
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
