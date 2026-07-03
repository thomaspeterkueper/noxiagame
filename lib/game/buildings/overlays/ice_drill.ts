// lib/game/buildings/overlays/ice_drill.ts
// Erstellt:     26.06.2026
// Aktualisiert: 26.06.2026 — Initiale Version
// Version:      0.1.0

import type { OverlayDef, BuildingContext } from '../types'

export function buildIceDrillOverlay(ctx: BuildingContext): OverlayDef {
  const waterOutput = ctx.production['water'] ?? 4
  const waterStock = ctx.stocks['water'] ?? 0
  const energyStock = ctx.stocks['energy'] ?? 0
  const energyCons = ctx.consumption['energy'] ?? 0
  const energyTicks = energyCons > 0 ? Math.floor(energyStock / energyCons) : 99
  const ticksFull = waterOutput > 0 ? Math.floor((1000 - waterStock) / waterOutput) : 99

  const alerts: OverlayDef['alerts'] = []

  if (energyTicks <= 2) {
    alerts.push({ id: 'no_energy', severity: 'critical', text: `Nur noch ${energyTicks} Tick${energyTicks === 1 ? '' : 's'} Energie. Bohrung stoppt bald.` })
  } else if (waterStock < 30) {
    alerts.push({ id: 'low_water', severity: 'warning', text: 'Wasservorrat kritisch niedrig. Kolonie ist auf diese Quelle angewiesen.' })
  } else if (waterStock > 500) {
    alerts.push({ id: 'surplus', severity: 'info', text: 'Wasserüberschuss. Export oder zweite Lieferroute sinnvoll.' })
  } else {
    alerts.push({ id: 'ok', severity: 'success', text: `Bohrung läuft stabil · ${waterOutput}t/Tick · Lager für ca. ${ticksFull} Ticks.` })
  }

  return {
    id: 'ice_drill',
    title: 'Eisbohrung',
    subtitle: ctx.locationName,
    metrics: [
      { id: 'water_output', label: 'Wasser Produktion', value: waterOutput, unit: '/Tick', trend: waterOutput > 0 ? 'stable' : 'critical', hint: 'Schmilzt Kratereis und filtert es zu Trinkwasser.' },
      { id: 'water_stock', label: 'Wasser Lager', value: waterStock, unit: 't', trend: waterStock < 30 ? 'down' : waterStock > 300 ? 'up' : 'stable' },
      { id: 'energy_stock', label: 'Energie verfügbar', value: energyStock, unit: 't', trend: energyTicks < 5 ? 'down' : 'stable', hint: energyTicks < 99 ? `Reicht noch ${energyTicks} Ticks` : undefined },
    ],
    alerts,
    actions: ctx.isOwn ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen' }] : [],
    insight: 'Die Mondpole enthalten Wassereis in ewig beschatteten Kratern — eingeschlossen vor Milliarden Jahren durch Kometeneinschläge. Die Bohrung schmilzt das Eis mit Abwärme der Reaktoren und filtert es zu Trinkwasser. Energieaufwand: etwa 3 kWh pro Liter.',
  }
}
