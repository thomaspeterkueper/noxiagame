// lib/game/buildings/overlays/solar.ts
// Erstellt:     26.06.2026
// Aktualisiert: 26.06.2026 — Initiale Version
// Version:      0.1.0

import type { OverlayDef, BuildingContext } from '../types'

function pickInsight(energyStock: number, deficit: boolean): string {
  if (energyStock < 20)
    return 'Energie ist die unsichtbare Engpassressource: Ohne Strom stoppen Minen, sinkt Lebensqualität, schrumpft die Bevölkerung. Energieproduktion sollte immer 20–30% über dem Bedarf liegen.'
  if (deficit)
    return 'Solarfelder auf dem Mond produzieren konstant — unabhängig von Tageszeit, da die Panels auf dauerhaft sonnenbeschienenen Kratern stehen. Pro Solarfeld: 4 Einheiten pro Tick.'
  return 'Sonnenenergie ist im inneren Sonnensystem die effizienteste Quelle. Mars erhält nur 43% der Erdenergie — deshalb braucht Mars mehr Solarfelder für dieselbe Leistung.'
}

export function buildSolarOverlay(ctx: BuildingContext): OverlayDef {
  const energyOutput = ctx.production['energy']  ?? 4
  const energyStock  = ctx.stocks['energy']      ?? 0
  const energyCons   = ctx.consumption['energy'] ?? 0
  const deficit      = energyCons > energyOutput * 2
  const ticksFull    = energyOutput > 0 ? Math.floor((1000 - energyStock) / energyOutput) : 99

  const alerts: OverlayDef['alerts'] = []

  if (energyStock < 20) {
    alerts.push({ id: 'crit', severity: 'critical',
      text: 'Energiespeicher leer. Kolonie-Systeme laufen auf Reserve — sofort nachliefern.' })
  } else if (deficit) {
    alerts.push({ id: 'deficit', severity: 'warning',
      text: 'Verbrauch übersteigt Produktion deutlich. Weiteres Solarfeld empfohlen.' })
  } else if (energyCons > energyOutput) {
    alerts.push({ id: 'tight', severity: 'info',
      text: 'Energiebilanz knapp positiv. Puffer für Wachstum einplanen.' })
  } else {
    alerts.push({ id: 'ok', severity: 'success',
      text: `Energieversorgung stabil · ${energyOutput}t/Tick · Lager für ca. ${ticksFull} Ticks.` })
  }

  return {
    id: 'solar', title: 'Solarfeld', subtitle: ctx.locationName,
    metrics: [
      { id: 'energy_output', label: 'Energie Produktion', value: energyOutput, unit: '/Tick',
        trend: 'stable', hint: 'Konstante Produktion unabhängig von Tageszeit.' },
      { id: 'energy_stock',  label: 'Energie Lager',      value: energyStock,  unit: 't',
        trend: energyStock < 30 ? 'down' : 'stable' },
      { id: 'energy_cons',   label: 'Verbrauch Kolonie',  value: energyCons,   unit: '/Tick',
        trend: deficit ? 'critical' : 'stable',
        hint: deficit ? 'Verbrauch übersteigt Produktion' : undefined },
    ],
    alerts,
    actions: ctx.isOwn
      ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen', primary: false }]
      : [],
    insight: pickInsight(energyStock, deficit),
  }
}
