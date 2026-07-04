// moduleLifecycle.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; Modul-Lebenszyklus
// Version:      0.1.0
// lib/game/moduleLifecycle.ts
// ─────────────────────────────────────────────────────────────────────────────
// NOXIA — Modul- & Schiffs-Lebenszyklus (reine Logik, ohne DB)
//
// Dauern und Beträge für die Vorgänge install / remove / sell, die
// /api/game/build in player_builds schreibt und beim Tick abschließt.
// Wertminderung & Reparatur kommen aus condition.ts — EIN Modell für Teile,
// Häuser und Schiffe. Hier: die Schiffs-Seite (Module + Rahmen).
// ─────────────────────────────────────────────────────────────────────────────

import { SHIP_MODULES, SHIP_FRAMES, ShipInstance } from './ships';
import { depreciatedValue, getRepairQuote, Condition } from './condition';

export type ModuleOp = 'install' | 'remove' | 'sell';

export const MODULE_LIFECYCLE = {
  INSTALL_TICKS: 1,             // Module sind keine Gebäude — schnell
  REMOVE_TICKS: 1,
  SELL_TICKS: 2,                // wie regulärer Gebäude-Verkauf
  INSTANT_SELL_DISCOUNT: 0.15,  // Sofortverkauf-Abschlag (wie Gebäude)
  SALVAGE_PCT: 0.50,            // Ausbau: Anteil der Kosten zurück (Teile, zustandsUNabhängig)
  RESALE_PCT: 0.70,             // Marktverkauf: Anteil (gebraucht), DANN × Zustand
} as const;

const moduleCost = (id: string) => SHIP_MODULES[id]?.cost ?? 0;
const frameCost  = (id: string) => SHIP_FRAMES[id]?.cost ?? 0;

// ── Einzelne Module ──────────────────────────────────────────────────────────
/** Einbau: Kosten = Modulkosten, fällig nach INSTALL_TICKS. */
export function getInstallPlan(moduleId: string): { cost: number; ticks: number } {
  return { cost: moduleCost(moduleId), ticks: MODULE_LIFECYCLE.INSTALL_TICKS };
}

/** Ausbau: Bergungswert (Teile zurück) — zustandsunabhängig. */
export function getRemoveQuote(moduleId: string): { salvage: number; ticks: number } {
  return {
    salvage: Math.round(moduleCost(moduleId) * MODULE_LIFECYCLE.SALVAGE_PCT),
    ticks: MODULE_LIFECYCLE.REMOVE_TICKS,
  };
}

/** Verkauf am Markt: gebraucht, × Zustand (depreciatedValue). Regulär + Sofort. */
export function getModuleSaleQuote(
  moduleId: string, condition: Condition = 100,
): { valueNormal: number; valueInstant: number; ticks: number } {
  const value = depreciatedValue(moduleCost(moduleId) * MODULE_LIFECYCLE.RESALE_PCT, condition);
  return {
    valueNormal: value,
    valueInstant: Math.round(value * (1 - MODULE_LIFECYCLE.INSTANT_SELL_DISCOUNT)),
    ticks: MODULE_LIFECYCLE.SELL_TICKS,
  };
}

/** Reparatur eines Moduls auf 100. */
export function getModuleRepairQuote(moduleId: string, condition: Condition) {
  return getRepairQuote(moduleCost(moduleId), condition);
}

// ── Schiff als Ganzes (Rahmen + alle Module) ─────────────────────────────────
/** Gesamt-Verkaufswert: geminderter Rahmen + Summe der geminderten Module. */
export function getShipSaleQuote(ship: ShipInstance): {
  frameValue: number; modulesValue: number; valueNormal: number; valueInstant: number; ticks: number;
} {
  const frameValue = depreciatedValue(frameCost(ship.frameId) * MODULE_LIFECYCLE.RESALE_PCT, ship.condition);
  const modulesValue = ship.modules.reduce(
    (s, m) => s + getModuleSaleQuote(m.moduleId, m.condition).valueNormal, 0);
  const valueNormal = frameValue + modulesValue;
  return {
    frameValue, modulesValue, valueNormal,
    valueInstant: Math.round(valueNormal * (1 - MODULE_LIFECYCLE.INSTANT_SELL_DISCOUNT)),
    ticks: MODULE_LIFECYCLE.SELL_TICKS,
  };
}

/** Gesamt-Reparatur: Rahmen + alle Module auf 100. */
export function getShipRepairQuote(ship: ShipInstance): {
  frame: number; modules: number; total: number;
} {
  const frame = getRepairQuote(frameCost(ship.frameId), ship.condition).cost;
  const modules = ship.modules.reduce(
    (s, m) => s + getModuleRepairQuote(m.moduleId, m.condition).cost, 0);
  return { frame, modules, total: frame + modules };
}

/** Zulässige Abschluss-Übergänge — die Route schließt offene Vorgänge so ab. */
export const STATUS_FLOW: Record<string, string> = {
  installing: 'installed',
  removing: 'removed',
  selling: 'sold',
};
