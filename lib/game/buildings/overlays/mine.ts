// lib/game/buildings/overlays/mine.ts
// Erstellt: 25.06.2026
// Version: 0.1.0

import type { OverlayDef, BuildingContext } from '../types'

export const MINE_OVERLAY_STATIC: OverlayDef = {
  id: 'mine',
  title: 'Mine',
  subtitle: 'Rohstoffförderung',
  metrics: [
    { id: 'metal_output', label: 'Metall Produktion', value: 5, unit: '/Tick', trend: 'stable' },
  ],
  alerts: [],
  actions: [],
}

export function buildMineOverlay(ctx: BuildingContext): OverlayDef {
  const metalOutput = ctx.production.metal ?? 0
  const metalStock = ctx.stocks.metal ?? 0

  return {
    id: 'mine',
    title: 'Mine',
    subtitle: ctx.locationName,
    metrics: [
      { id: 'metal_output', label: 'Metall Produktion', value: metalOutput, unit: '/Tick', trend: 'stable' },
      { id: 'metal_stock', label: 'Metall Lager', value: metalStock, unit: 't', trend: 'stable' },
    ],
    alerts: metalOutput <= 0
      ? [{ id: 'no_output', severity: 'warning', text: 'Diese Mine produziert aktuell kein Metall.' }]
      : [],
    actions: ctx.isOwn ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen' }] : [],
  }
}
