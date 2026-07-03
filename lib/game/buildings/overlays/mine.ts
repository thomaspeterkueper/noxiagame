// lib/game/buildings/overlays/mine.ts
// Erstellt:     25.06.2026
// Aktualisiert: 26.06.2026 — insight, hint, primary, kontextsensitive Alerts
// Version:      0.2.0

import type { OverlayDef, BuildingContext } from '../types'

export const MINE_OVERLAY_STATIC: OverlayDef = {
  id: 'mine', title: 'Mine', subtitle: 'Rohstoffförderung',
  metrics: [
    { id: 'metal_output', label: 'Metall Produktion', value: 5, unit: '/Tick', trend: 'stable' },
  ],
  alerts: [], actions: [],
}

function pickInsight(metalStock: number, energyTicks: number): string {
  if (energyTicks <= 3)
    return 'Minen benötigen kontinuierliche Energie. Ohne Strom stoppt die Förderrate sofort — kein Antrieb, kein Abbau.'
  if (metalStock > 500)
    return 'Hohe Lagerbestände zeigen entweder gute Versorgung oder fehlenden Absatz. Metall im Lager erwirtschaftet keine Zinsen.'
  if (metalStock < 20)
    return 'Kritisch niedriger Metallbestand. Zwei Minen statt einer verdoppeln den Puffer bei gleichen Fixkosten.'
  return 'Minen sind frühe Engpassgebäude: Sie erzeugen Rohstoffe, verbrauchen aber Energie. Wächst die Kolonie, muss die Förderung synchron steigen.'
}

export function buildMineOverlay(ctx: BuildingContext): OverlayDef {
  const metalOutput = ctx.production['metal']   ?? 0
  const metalStock  = ctx.stocks['metal']       ?? 0
  const energyStock = ctx.stocks['energy']      ?? 0
  const energyCons  = ctx.consumption['energy'] ?? 0
  const energyTicks = energyCons > 0 ? Math.floor(energyStock / energyCons) : 99

  const alerts: OverlayDef['alerts'] = []

  if (energyTicks <= 2) {
    alerts.push({ id: 'critical_energy', severity: 'critical',
      text: `Nur noch ${energyTicks} Tick${energyTicks === 1 ? '' : 's'} Energie-Reserve. Mine fördert bald nicht mehr.` })
  } else if (energyTicks <= 5) {
    alerts.push({ id: 'low_energy', severity: 'warning',
      text: `Noch ${energyTicks} Ticks Energiereserve. Lieferung einplanen.` })
  }

  if (metalOutput <= 0) {
    alerts.push({ id: 'no_output', severity: 'warning',
      text: 'Diese Mine produziert aktuell kein Metall.' })
  } else if (metalStock < 20) {
    alerts.push({ id: 'low_stock', severity: 'warning',
      text: 'Metallbestand fast leer. Kolonie braucht Metall für Wartung und Bau.' })
  } else if (metalStock > 600) {
    alerts.push({ id: 'surplus', severity: 'info',
      text: 'Metall-Überschuss vorhanden. Günstige Zeit für Export.' })
  } else {
    alerts.push({ id: 'ok', severity: 'success',
      text: `Förderung stabil · ${metalOutput}t/Tick.` })
  }

  return {
    id: 'mine', title: 'Mine', subtitle: ctx.locationName,
    metrics: [
      { id: 'metal_output', label: 'Metall Produktion', value: metalOutput, unit: '/Tick',
        trend: metalOutput > 0 ? 'stable' : 'critical',
        hint: 'Wird pro Tick direkt ins Kolonielager gebucht.' },
      { id: 'metal_stock',  label: 'Metall Lager',      value: metalStock,  unit: 't',
        trend: metalStock < 50 ? 'down' : metalStock > 300 ? 'up' : 'stable' },
      { id: 'energy_stock', label: 'Energie verfügbar', value: energyStock, unit: 't',
        trend: energyTicks < 5 ? 'down' : 'stable',
        hint: energyTicks < 99 ? `Reicht noch ${energyTicks} Ticks` : undefined },
    ],
    alerts,
    actions: ctx.isOwn
      ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen', primary: false }]
      : [],
    insight: pickInsight(metalStock, energyTicks),
  }
}
