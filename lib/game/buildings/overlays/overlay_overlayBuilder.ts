// lib/game/buildings/overlays/overlayBuilder.ts
// Erstellt:     24.06.2026
// Aktualisiert: 24.06.2026 — Mine + Solar + Habitat + generischer Fallback
// Version:      1.0.0
//
// Zentrale buildOverlayForBuilding-Funktion.
// Neue Gebäude: eigene Builder-Funktion hier anlegen + case im switch eintragen.

import type { OverlayDef, OverlayMetric, OverlayAlert, BuildingContext } from './types'
import { buildMineOverlay } from './mineOverlay'

const RES: Record<string, string> = {
  metal: 'Metall', energy: 'Energie', water: 'Wasser',
}

// ── Solar ─────────────────────────────────────────────────────────────────────

function buildSolarOverlay(ctx: BuildingContext): OverlayDef {
  const energyOutput = ctx.production['energy'] ?? 4
  const energyStock  = ctx.stocks['energy']     ?? 0
  const energyPrice  = ctx.prices['energy']     ?? 60
  const energyCons   = ctx.consumption['energy'] ?? 0
  const surplus      = energyOutput - (energyCons / Math.max(1,
    Object.values(ctx.production).filter(v => v > 0).length))
  const ticksFull    = energyOutput > 0 ? Math.floor((1000 - energyStock) / energyOutput) : 99

  const metrics: OverlayMetric[] = [
    { id: 'energy_output', label: 'Energieproduktion', value: energyOutput, unit: '/Tick', trend: 'stable', goodAbove: 3 },
    { id: 'energy_value',  label: 'Produktionswert',   value: energyOutput * energyPrice, unit: 'Cr/Tick', trend: 'stable' },
    { id: 'energy_stock',  label: 'Lager Energie',     value: energyStock, unit: 't',
      trend: energyStock > 200 ? 'up' : energyStock < 30 ? 'down' : 'stable',
      warnBelow: 30, goodAbove: 150 },
    { id: 'energy_cons',   label: 'Kolonienverbrauch', value: energyCons, unit: '/Tick', trend: 'stable' },
  ]

  const alerts: OverlayAlert[] = []

  if (energyStock < 20) {
    alerts.push({ id: 'crit_energy', level: 'critical', title: 'Energiespeicher leer', message: 'Kolonie-Systeme laufen auf Reserve. Sofort nachliefern.' })
  } else if (energyCons > energyOutput * 2) {
    alerts.push({ id: 'deficit', level: 'warning', title: 'Energiedefizit', message: 'Verbrauch übersteigt Produktion. Weiteres Solarfeld empfohlen.' })
  } else if (surplus > 2) {
    alerts.push({ id: 'surplus', level: 'info', title: 'Energieüberschuss', message: `${surplus}t/Tick Überschuss. Export oder weiterer Ausbau möglich.` })
  } else {
    alerts.push({ id: 'ok', level: 'good', title: 'Energieversorgung stabil', message: `Lager für ca. ${ticksFull} Ticks. Produktion im Gleichgewicht.` })
  }

  const pickInsight = () => {
    if (energyStock < 20) return 'Energie ist die unsichtbare Engpassressource: Ohne Strom stoppen Minen, sinkt die Lebensqualität, sterben Habitate. Energieproduktion sollte immer 20–30% über dem Bedarf liegen.'
    if (energyCons > energyOutput * 2) return 'Solarfelder auf dem Mond produzieren konstant — unabhängig von Tag-Nacht-Zyklen, da die Panels auf sonnenzugewandten Kratern stehen. Pro Solarfeld: 4 Einheiten pro Tick, wartungsarm und ausfallsicher.'
    return 'Sonnenenergie ist im inneren Sonnensystem die effizienteste Quelle. Intensität nimmt mit dem Quadrat der Entfernung ab: Mars erhält nur 43% der Sonnenenergie der Erde — deshalb braucht Mars mehr Solarfelder für dieselbe Leistung.'
  }

  return {
    id: 'solar', title: 'Solarfeld', subtitle: `${ctx.locationName} · ${energyStock < 20 ? '⚠ Kritisch' : '✓ Normal'}`,
    metrics, alerts,
    actions: ctx.isOwn ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen' }] : [],
    insight: pickInsight(),
  }
}

// ── Habitat ───────────────────────────────────────────────────────────────────

function buildHabitatOverlay(ctx: BuildingContext): OverlayDef {
  const popCap       = ctx.populationMax
  const pop          = ctx.population
  const utilization  = popCap > 0 ? Math.round((pop / popCap) * 100) : 0
  const waterStock   = ctx.stocks['water']       ?? 0
  const waterCons    = ctx.consumption['water']  ?? 0
  const ticksWater   = waterCons > 0 ? Math.floor(waterStock / waterCons) : 99

  const metrics: OverlayMetric[] = [
    { id: 'population',   label: 'Bevölkerung',    value: pop,       unit: 'Einw.',  trend: pop > popCap * 0.9 ? 'up' : 'stable' },
    { id: 'pop_cap',      label: 'Kapazität',      value: popCap,    unit: 'Einw.',  trend: 'stable' },
    { id: 'utilization',  label: 'Auslastung',     value: utilization, unit: '%',    trend: 'stable', warnBelow: 30, goodAbove: 70 },
    { id: 'water_ticks',  label: 'Wasservorrat',   value: ticksWater < 99 ? ticksWater : '∞', unit: ticksWater < 99 ? 'Ticks' : '',
      trend: ticksWater < 5 ? 'down' : 'stable', warnBelow: 3 },
  ]

  const alerts: OverlayAlert[] = []

  if (pop > popCap) {
    alerts.push({ id: 'overcrowded', level: 'critical', title: 'Überbelegung', message: `${pop - popCap} Einwohner über Kapazität. Bevölkerung schrumpft aktiv.` })
  } else if (ticksWater <= 2) {
    alerts.push({ id: 'no_water', level: 'critical', title: 'Wasserknappheit', message: 'Wasserversorgung bricht in Kürze zusammen. Sofort nachliefern.' })
  } else if (utilization < 30) {
    alerts.push({ id: 'low_util', level: 'info', title: 'Unterauslastung', message: `Nur ${utilization}% belegt. Habitat arbeitet unrentabel — Bevölkerung muss wachsen.` })
  } else if (utilization >= 90) {
    alerts.push({ id: 'near_full', level: 'warning', title: 'Fast voll belegt', message: 'Weitere Einwohner können nicht aufgenommen werden. Zweites Habitat empfohlen.' })
  } else {
    alerts.push({ id: 'ok', level: 'good', title: 'Belegung stabil', message: `${utilization}% Auslastung · Bevölkerung wächst mit 1%/Tick.` })
  }

  const pickInsight = () => {
    if (pop > popCap)    return 'Überbelegung ist keine theoretische Größe: Menschen teilen sich Luftschleusen, Küchen und Schlafsäle. Die Kolonie reagiert mit erhöhtem Ressourcenverbrauch und sinkendem Wachstum bis die Kapazität wiederhergestellt ist.'
    if (ticksWater <= 3) return 'Wasser ist die limitierende Ressource jeder Marskolonie. 6× teurer als auf der Erde, da jeder Tropfen aus Gletschereis geschmolzen und gefiltert wird. Eine Kolonie ohne Wasser verliert Einwohner schneller als sie neue gewinnen kann.'
    if (utilization < 30) return 'Habitate sind Kapitalanlage: 2.000 Cr investiert, aber erst bei 70%+ Auslastung rentabel. Leerstehende Habitate zeigen an, dass Wachstum durch andere Engpässe gebremst wird — meist fehlende Ressourcen oder zu niedriger Wohlstand.'
    return 'Habitate begrenzen das Bevölkerungswachstum durch ihre Kapazität. Jedes Habitat bietet Platz für 100 weitere Einwohner, die täglich Wasser, Energie und Metall verbrauchen. Wachstum und Versorgung müssen synchron steigen.'
  }

  return {
    id: 'habitat', title: 'Habitat', subtitle: `${ctx.locationName} · ${utilization}% belegt`,
    metrics, alerts,
    actions: ctx.isOwn ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen' }] : [],
    insight: pickInsight(),
  }
}

// ── Generischer Fallback ──────────────────────────────────────────────────────

function buildGenericOverlay(entityId: string, ctx: BuildingContext): OverlayDef {
  const metrics: OverlayMetric[] = []

  for (const [res, amount] of Object.entries(ctx.production).filter(([, v]) => v > 0)) {
    metrics.push({ id: `${res}_out`, label: `${RES[res] ?? res} Produktion`, value: amount, unit: '/Tick', trend: 'stable' })
    metrics.push({ id: `${res}_stock`, label: `${RES[res] ?? res} Lager`, value: ctx.stocks[res] ?? 0, unit: 't', trend: 'stable' })
  }

  return {
    id:       entityId,
    title:    entityId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    subtitle: ctx.locationName,
    metrics,
    alerts:  [],
    actions: ctx.isOwn ? [{ id: 'sell_building', label: 'Gebäude bewerten & verkaufen' }] : [],
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function buildOverlayForBuilding(entityId: string, ctx: BuildingContext): OverlayDef {
  switch (entityId) {
    case 'mine':           return buildMineOverlay(ctx)
    case 'solar':          return buildSolarOverlay(ctx)
    case 'habitat':        return buildHabitatOverlay(ctx)
    default:               return buildGenericOverlay(entityId, ctx)
  }
}
