// lib/game/buildings/overlays/mineOverlay.ts
// Erstellt:     24.06.2026
// Aktualisiert: 24.06.2026 — Initiale Version
// Version:      1.0.0
//
// Mine — Referenz-Overlay für das gesamte System.
// Enthält alles: Produktion, Verbrauch, Lagerwirkung, Engpasslogik, Aktion, Wissenssatz.
// Dient als Vorlage für solar.ts, habitat.ts, raumhafen.ts usw.

import type {
  OverlayDef,
  OverlayMetric,
  OverlayAlert,
  OverlayAction,
  BuildingContext,
} from './types'

// ── Statische Vorlage (Fallback ohne Laufzeit-Kontext) ─────────────────────────

export const MINE_OVERLAY_STATIC: OverlayDef = {
  id:       'mine',
  title:    'Mine',
  subtitle: 'Rohstoffförderung · Basisanlage',

  metrics: [
    { id: 'metal_output', label: 'Metallförderung',  value: 5,   unit: '/Tick', trend: 'stable' },
    { id: 'energy_use',   label: 'Energieverbrauch', value: 0,   unit: '/Tick', trend: 'stable' },
    { id: 'metal_stock',  label: 'Lagerbestand',     value: '—', unit: 't' },
  ],

  alerts:  [],
  actions: [{
    id:          'sell_building',
    label:       'Gebäude bewerten & verkaufen',
    description: 'Zeigt den aktuellen Marktwert und Verkaufsoptionen.',
  }],

  insight: 'Minen sind frühe Engpassgebäude: Sie erzeugen Rohstoffe, verbrauchen aber Energie und Wartung. Eine Kolonie wächst nur dann stabil, wenn Förderung, Energie und Lager synchron steigen.',
}

// ── Insight-Varianten je nach Situation ───────────────────────────────────────

function pickInsight(ctx: BuildingContext): string {
  const energyStock = ctx.stocks['energy'] ?? 0
  const metalStock  = ctx.stocks['metal']  ?? 0
  const energyCons  = ctx.consumption['energy'] ?? 0
  const ticksEnergy = energyCons > 0 ? Math.floor(energyStock / energyCons) : 99

  if (ticksEnergy <= 3) {
    return 'Minen benötigen kontinuierliche Energie. Ohne Strom sinkt die Förderrate auf null — das ist kein Fehler, sondern Physik: ohne Antrieb kein Abbau.'
  }
  if (metalStock > 500) {
    return 'Hohe Lagerbestände signalisieren entweder gute Versorgung oder fehlenden Absatz. Prüfe ob Händler regelmäßig kaufen — Metall im Lager erwirtschaftet keine Zinsen.'
  }
  if (metalStock < 20) {
    return 'Kritisch niedriger Lagerbestand: Die Kolonie braucht Metall für Wartung und Bau. Eine Mine allein reicht bei wachsender Bevölkerung oft nicht aus — zwei Minen verdoppeln die Pufferzeit.'
  }
  return 'Minen sind frühe Engpassgebäude: Sie erzeugen Rohstoffe, verbrauchen aber Energie und Wartung. Eine Kolonie wächst nur dann stabil, wenn Förderung, Energie und Lager synchron steigen.'
}

// ── Dynamischer Builder ───────────────────────────────────────────────────────

export function buildMineOverlay(ctx: BuildingContext): OverlayDef {
  const metalOutput = ctx.production['metal']  ?? 5
  const energyCons  = ctx.consumption['energy'] ?? 0
  const metalStock  = ctx.stocks['metal']       ?? 0
  const energyStock = ctx.stocks['energy']      ?? 0
  const metalPrice  = ctx.prices['metal']       ?? 30
  const ticksEnergy = energyCons > 0 ? Math.floor(energyStock / energyCons) : 99
  const ticksFull   = metalOutput > 0 ? Math.floor((1000 - metalStock) / metalOutput) : 99

  // ── Metrics ──
  const metrics: OverlayMetric[] = [
    {
      id: 'metal_output', label: 'Metallförderung',
      value: metalOutput, unit: '/Tick', trend: 'stable', goodAbove: 4,
    },
    {
      id: 'metal_value', label: 'Förderwert',
      value: metalOutput * metalPrice, unit: 'Cr/Tick', trend: 'stable',
    },
    {
      id: 'metal_stock', label: 'Lager Metall',
      value: metalStock, unit: 't',
      trend: metalStock > 200 ? 'up' : metalStock < 50 ? 'down' : 'stable',
      warnBelow: 50, goodAbove: 200,
    },
    {
      id: 'energy_stock', label: 'Energie verfügbar',
      value: energyStock, unit: 't',
      trend: ticksEnergy < 5 ? 'down' : 'stable',
      warnBelow: energyCons * 3,
    },
  ]

  // ── Alerts ──
  const alerts: OverlayAlert[] = []

  if (ticksEnergy <= 2) {
    alerts.push({
      id: 'critical_energy', level: 'critical',
      title:   'Energie kritisch',
      message: `Nur noch ${ticksEnergy} Tick${ticksEnergy === 1 ? '' : 's'} Reserve. Mine fördert bald nicht mehr.`,
    })
  } else if (ticksEnergy <= 5) {
    alerts.push({
      id: 'low_energy', level: 'warning',
      title:   'Energie wird knapp',
      message: `Noch ${ticksEnergy} Ticks Energiereserve. Lieferung einplanen.`,
    })
  }

  if (metalStock < 20) {
    alerts.push({
      id: 'low_metal', level: 'warning',
      title:   'Metallbestand niedrig',
      message: 'Kolonie benötigt Metall für Wartung und Bau. Lager ist fast leer.',
    })
  } else if (metalStock > 600) {
    alerts.push({
      id: 'high_metal', level: 'info',
      title:   'Lager gut gefüllt',
      message: 'Metall-Überschuss vorhanden. Günstige Zeit um zu exportieren.',
    })
  } else {
    alerts.push({
      id: 'production_ok', level: 'good',
      title:   'Förderung läuft stabil',
      message: `${metalOutput}t/Tick · Lager für ca. ${ticksFull} Ticks Puffer.`,
    })
  }

  // ── Actions ──
  const actions: OverlayAction[] = []
  if (ctx.isOwn) {
    actions.push({ id: 'sell_building', label: 'Gebäude bewerten & verkaufen' })
  }

  // ── Subtitle ──
  const status = ticksEnergy <= 2 ? '⚠ Energie kritisch'
    : ticksEnergy <= 5            ? '⚠ Energie niedrig'
    : metalStock < 20             ? '⚠ Lager leer'
    : '✓ Normal'

  return {
    id:      'mine',
    title:   'Mine',
    subtitle: `${ctx.locationName} · ${status}`,
    metrics,
    alerts,
    actions,
    insight: pickInsight(ctx),
  }
}
