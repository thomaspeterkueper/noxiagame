// lib/game/buildings/overlays/water_recycler.ts
// Erstellt:     26.06.2026
// Aktualisiert: 26.06.2026 — Initiale Version
// Version:      0.1.0

import type { OverlayDef, BuildingContext } from '../types'

export function buildWaterRecyclerOverlay(ctx: BuildingContext): OverlayDef {
  const waterOutput = ctx.production['water'] ?? 2
  const waterStock = ctx.stocks['water'] ?? 0
  const waterCons = ctx.consumption['water'] ?? 0
  const balance = waterOutput - waterCons
  const ticksFull = waterOutput > 0 ? Math.floor((1000 - waterStock) / waterOutput) : 99

  const alerts: OverlayDef['alerts'] = []

  if (waterStock < 20) {
    alerts.push({ id: 'crit', severity: 'critical', text: 'Wasservorrat erschöpft. Koloniesysteme unter kritischem Minimum.' })
  } else if (waterCons > waterOutput * 3) {
    alerts.push({ id: 'deficit', severity: 'warning', text: 'Verbrauch übersteigt Recycler-Kapazität stark. Eisbohrung oder Import nötig.' })
  } else if (balance < 0) {
    alerts.push({ id: 'negative', severity: 'info', text: `Nettobilanz: ${balance}t/Tick. Recycler allein reicht bei dieser Bevölkerung nicht.` })
  } else {
    alerts.push({ id: 'ok', severity: 'success', text: `Recycler läuft stabil · ${waterOutput}t/Tick · Lager für ca. ${ticksFull} Ticks.` })
  }

  return {
    id: 'water_recycler',
    title: 'Wasserrecycler',
    subtitle: ctx.locationName,
    metrics: [
      { id: 'water_output', label: 'Wasser Rückgewinnung', value: waterOutput, unit: '/Tick', trend: 'stable', hint: 'Gewinnt Wasser aus Luft, Abwasser und Kondensation.' },
      { id: 'water_stock', label: 'Wasser Lager', value: waterStock, unit: 't', trend: waterStock < 20 ? 'down' : 'stable' },
      { id: 'water_cons', label: 'Verbrauch Kolonie', value: waterCons, unit: '/Tick', trend: waterCons > waterOutput * 2 ? 'critical' : 'stable' },
    ],
    alerts,
    actions: ctx.isOwn ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen' }] : [],
    insight: 'Mars hat kaum flüssiges Wasser — aber die Atmosphäre enthält Spuren davon. Der Recycler kondensiert Wasserdampf aus Abluft und Abwasser mit 90%+ Effizienz zurück. Jede Tonne Wasser die nicht importiert werden muss spart ca. 300–600 Cr Frachtkosten.',
  }
}
