// lib/game/buildings/overlays/scanner.ts
// Erstellt:     26.06.2026
// Aktualisiert: 26.06.2026 — Initiale Version
// Version:      0.1.0

import type { OverlayDef, BuildingContext } from '../types'

export function buildScannerOverlay(ctx: BuildingContext): OverlayDef {
  const pop = ctx.population ?? 0
  const popMax = ctx.populationMax ?? 0
  const util = popMax > 0 ? Math.round((pop / popMax) * 100) : 0
  const lowRes = Object.entries(ctx.stocks).filter(([, v]) => v < 30).map(([k]) => k)

  const alerts: OverlayDef['alerts'] = []

  if (lowRes.length > 0) {
    const names: Record<string, string> = { water: 'Wasser', energy: 'Energie', metal: 'Metall' }
    alerts.push({ id: 'low_resources', severity: 'warning', text: `Kritisch niedrige Bestände: ${lowRes.map(r => names[r] ?? r).join(', ')}.` })
  }
  if (pop > popMax) {
    alerts.push({ id: 'overcrowded', severity: 'critical', text: 'Überbelegung erkannt. Bevölkerung übersteigt Kapazität.' })
  }
  if (lowRes.length === 0 && pop <= popMax) {
    alerts.push({ id: 'all_clear', severity: 'success', text: 'Keine kritischen Anomalien. Kolonie im Normalbetrieb.' })
  }

  return {
    id: 'scanner',
    title: 'Scanner',
    subtitle: `${ctx.locationName} · Prospektion`,
    metrics: [
      { id: 'population', label: 'Bevölkerung', value: pop, unit: 'Einw.', trend: pop > popMax ? 'critical' : 'stable' },
      { id: 'utilization', label: 'Auslastung', value: util, unit: '%', trend: util > 95 ? 'critical' : util > 80 ? 'up' : 'stable', hint: `${pop} / ${popMax} Einwohner` },
    ],
    alerts,
    actions: ctx.isOwn ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen' }] : [],
    insight: 'Scanner vermessen die Kolonie elektromagnetisch und seismisch. Sie erkennen Hohlräume, Erzadern und strukturelle Schwachstellen bevor sie zum Problem werden. Anomalien erscheinen als Markierungen im Grid.',
  }
}
