// lib/game/buildings/overlays/habitat.ts
// Erstellt:     26.06.2026
// Aktualisiert: 26.06.2026 — Initiale Version
// Version:      0.1.0

import type { OverlayDef, BuildingContext } from '../types'

function pickInsight(pop: number, popMax: number, waterTicks: number): string {
  if (pop > popMax)
    return 'Überbelegung erhöht Ressourcenverbrauch und bremst Wachstum bis die Kapazität wiederhergestellt ist. Abriss eines Habitats kostet Umsiedlungsgebühren.'
  if (waterTicks <= 3)
    return 'Wasser ist die limitierende Ressource jeder Kolonie: 6× teurer als auf der Erde, da jeder Tropfen aus Eis geschmolzen und gefiltert wird.'
  const util = popMax > 0 ? Math.round((pop / popMax) * 100) : 0
  if (util < 30)
    return 'Habitate sind Kapitalanlage: erst ab ca. 70% Auslastung rentabel. Niedrige Belegung zeigt, dass Wachstum durch andere Engpässe gebremst wird — meist Ressourcenmangel.'
  return 'Habitate begrenzen das Bevölkerungswachstum durch ihre Kapazität. Jedes Habitat bietet Platz für 100 Einwohner — Wachstum und Versorgung müssen synchron steigen.'
}

export function buildHabitatOverlay(ctx: BuildingContext): OverlayDef {
  const pop        = ctx.population    ?? 0
  const popMax     = ctx.populationMax ?? 0
  const util       = popMax > 0 ? Math.round((pop / popMax) * 100) : 0
  const waterStock = ctx.stocks['water']      ?? 0
  const waterCons  = ctx.consumption['water'] ?? 0
  const waterTicks = waterCons > 0 ? Math.floor(waterStock / waterCons) : 99

  const alerts: OverlayDef['alerts'] = []

  if (pop > popMax) {
    alerts.push({ id: 'overcrowded', severity: 'critical',
      text: `${pop - popMax} Einwohner über Kapazität. Bevölkerung schrumpft aktiv.` })
  } else if (waterTicks <= 2) {
    alerts.push({ id: 'no_water', severity: 'critical',
      text: 'Wasserversorgung bricht in Kürze zusammen. Sofort nachliefern.' })
  } else if (waterTicks <= 5) {
    alerts.push({ id: 'low_water', severity: 'warning',
      text: `Nur noch ${waterTicks} Ticks Wasserreserve. Lieferung einplanen.` })
  } else if (util >= 90) {
    alerts.push({ id: 'near_full', severity: 'warning',
      text: 'Fast voll belegt. Weiteres Habitat empfohlen für weiteres Wachstum.' })
  } else if (util < 30) {
    alerts.push({ id: 'low_util', severity: 'info',
      text: `Nur ${util}% belegt. Bevölkerung wächst sobald Versorgung stabil ist.` })
  } else {
    alerts.push({ id: 'ok', severity: 'success',
      text: `${util}% Auslastung · Bevölkerung wächst mit 1%/Tick.` })
  }

  return {
    id: 'habitat', title: 'Habitat', subtitle: `${ctx.locationName} · ${util}% belegt`,
    metrics: [
      { id: 'population',  label: 'Bevölkerung',   value: pop,    unit: 'Einw.',
        trend: pop > popMax ? 'critical' : pop > popMax * 0.9 ? 'up' : 'stable' },
      { id: 'capacity',    label: 'Kapazität',      value: popMax, unit: 'Einw.',
        hint: '+100 durch dieses Habitat.' },
      { id: 'water_ticks', label: 'Wasser reicht',
        value: waterTicks < 99 ? waterTicks : '∞',
        unit:  waterTicks < 99 ? 'Ticks' : '',
        trend: waterTicks < 5 ? 'down' : 'stable' },
    ],
    alerts,
    actions: ctx.isOwn
      ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen', primary: false }]
      : [],
    insight: pickInsight(pop, popMax, waterTicks),
  }
}
