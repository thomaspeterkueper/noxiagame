// ships.ts
// Aktualisiert: 20.07.2026 — Phase 2: Erkundungs- und Konstruktionsschiff
// Version:      0.4.0
// lib/game/ships.ts
// ─────────────────────────────────────────────────────────────────────────────
// NOXIA — Schiffs-Spec + lebende Schicht
//
// Prinzip: Schiff = RAHMEN × LADUNG.
//   • ShipLoadout  = BAUPLAN (frameId + Modultyp-IDs) — für Werft/Planung.
//   • ShipInstance = LEBEND, aus tile_entities-Modulzeilen hydratisiert: jedes
//     Modul mit eigener UUID, Slot, condition (0..100) und status.
// Alle Kapazitäts-/Masse-/Tempo-Helfer akzeptieren BEIDES (ShipLoadout|ShipInstance).
//
// Wichtig: ein beschädigtes/abgeschaltetes Modul BELEGT seinen Slot weiter,
// trägt aber NICHTS zur Kapazität bei — der greifbare Sinn von Adressierbarkeit.
//
// Hängt an buildings.ts (Resource, RESOURCE_PHASE). Rückwärtskompatibel:
// SHIP_CARGO_MAX (=100) ist abgeleitet (Mk.I, 5×20 t).
// ─────────────────────────────────────────────────────────────────────────────

import { Resource, RESOURCE_PHASE } from './resources';
import { orbitalBaseSeconds, ORBITS } from './orbits';

// ── Achsen ───────────────────────────────────────────────────────────────────
export type ShipyardLocation = 'start' | 'earth' | 'moon' | 'mars' | 'phobos' | 'prometheus';
export type LocationSlug = 'earth' | 'moon' | 'mars' | 'phobos' | 'prometheus';
export type ModuleType = 'cargo' | 'tank' | 'habitat' | 'equipment';
export type ModuleStatus = 'active' | 'damaged' | 'disabled';

export type ShipFunction =
  | 'long_range_scan'   // Terrain + Ressourcen scannen (Erkundung)
  | 'deep_scan'         // Detaillierte Deposit-Analyse (mit SENSOR:SPECTRAL)
  | 'construction'      // Basisinfrastruktur errichten (Gründung)
  | 'colony_supplies'   // Erstversorgung transportieren (Gründung)
  | 'boosted_drive'     // Schnellerer Antrieb
  | 'shielding'         // Strahlungsschutz
  | 'refrigeration';    // Kühltransport

export const MODULE_TONNES = 20;

// ── Rahmen ───────────────────────────────────────────────────────────────────
export interface ShipFrame {
  id: string; name: string; slots: number; baseSpeed: number;
  cost: number; shipyard: ShipyardLocation; hullMass: number; unlocked: boolean;
}
export const SHIP_FRAMES: Record<string, ShipFrame> = {
  mk1:   { id: 'mk1',   name: 'Frachter Mk.I',   slots: 5,  baseSpeed: 1.0,  cost: 0,     shipyard: 'start', hullMass: 8,  unlocked: true },
  fast:  { id: 'fast',  name: 'Schnellfrachter', slots: 3,  baseSpeed: 1.7,  cost: 8000,  shipyard: 'moon',  hullMass: 5,  unlocked: true },
  heavy:   { id: 'heavy',   name: 'Schwerfrachter',       slots: 10, baseSpeed: 0.77, cost: 15000,  shipyard: 'moon',  hullMass: 20, unlocked: true },
  scout:   { id: 'scout',   name: 'Erkundungsschiff',      slots: 4,  baseSpeed: 1.5,  cost: 12000,  shipyard: 'moon',  hullMass: 6,  unlocked: false },
  pioneer: { id: 'pioneer', name: 'Pionier-Konstrukteur',  slots: 8,  baseSpeed: 0.6,  cost: 35000,  shipyard: 'mars',  hullMass: 30, unlocked: false },
};

// ── Unlock-Keys für neue Schiffstypen ────────────────────────────────────────
// Voraussetzungen für Gründung neuer Standorte
export const SHIP_UNLOCKS = {
  // Erkundungsschiff
  scout:             'UNL:NOX:SHIP:SCOUT',        // Scout-Frame kaufen
  deep_scan:         'UNL:NOX:SENSOR:SPECTRAL',   // Tiefen-Scanner (PHY-L1-000001)
  // Konstruktionsschiff
  pioneer:           'UNL:NOX:SHIP:PIONEER',      // Pioneer-Frame kaufen
  colony_found:      'UNL:NOX:COLONY:FOUND',      // Kolonie gründen dürfen
  station_found:     'UNL:NOX:STATION:FOUND',     // Station gründen dürfen
} as const

// ── Module ───────────────────────────────────────────────────────────────────
export interface ShipModule {
  id: string; name: string; type: ModuleType; capacity: number; mass: number;
  cost: number; fluidOnly?: boolean; provides?: ShipFunction[]; unlocked: boolean;
}
export const SHIP_MODULES: Record<string, ShipModule> = {
  cargo:        { id: 'cargo',         name: 'Frachtmodul',     type: 'cargo',     capacity: MODULE_TONNES, mass: 1,   cost: 400,  unlocked: true },
  tank:         { id: 'tank',          name: 'Tankmodul',       type: 'tank',      capacity: 30,            mass: 1.5, cost: 600,  fluidOnly: true, unlocked: false },
  habitat_pod:  { id: 'habitat_pod',   name: 'Wohncontainer',   type: 'habitat',   capacity: 25,            mass: 3,   cost: 1500, unlocked: false },
  scanner:      { id: 'scanner',       name: 'Sensorausleger',  type: 'equipment', capacity: 0,             mass: 2,   cost: 2500, provides: ['long_range_scan'], unlocked: false },
  drive_booster:  { id: 'drive_booster',  name: 'Schubverstärker',    type: 'equipment', capacity: 0,   mass: 2,   cost: 3000,  provides: ['boosted_drive'],              unlocked: false },
  // Erkundungs-Module
  deep_scanner:   { id: 'deep_scanner',  name: 'Tiefen-Scanner',      type: 'equipment', capacity: 0,   mass: 3,   cost: 8000,  provides: ['long_range_scan','deep_scan'], unlocked: false },
  survey_drone:   { id: 'survey_drone',  name: 'Kartierungsdrohne',    type: 'equipment', capacity: 0,   mass: 1.5, cost: 4000,  provides: ['long_range_scan'],             unlocked: false },
  // Konstruktions-Module
  construction_rig: { id: 'construction_rig', name: 'Bau-Ausrüstung', type: 'equipment', capacity: 0,   mass: 8,   cost: 15000, provides: ['construction'],                unlocked: false },
  colony_pod:     { id: 'colony_pod',    name: 'Kolonisierungsmodul',  type: 'habitat',   capacity: 50,  mass: 5,   cost: 10000, provides: ['colony_supplies'],             unlocked: false },
};

// ── Schicht-0-Naht: die EINE Quelle der Basis-Reisezeit ──────────────────────
// Basiszeit in Sekunden (Tempo 1.0, vor Schiffsfaktoren) zwischen zwei Orten.
// Seit Schicht 2 aus der Orbital-Engine berechnet: distanz(from,to,tick) ×
// SEC_PER_UNIT, geclampt — Mond↔Mars schwankt damit ~25–50s über den Zyklus.
// `tick` = aktueller Spiel-Tick (Abflug-Snapshot). Ohne Tick → Tick 0.
// Generisch über Orts-IDs (Stationen/Planeten/Belt/andere Systeme = nur Daten).
// null = keine bekannte Bahn für from/to → keine Route.
export function baseTravelSeconds(from: LocationSlug, to: LocationSlug, tick = 0): number | null {
  if (!ORBITS[from] || !ORBITS[to]) return null
  return orbitalBaseSeconds(from, to, tick)
}

// ── Energie-Flugkosten (Treibstoff aus Laderaum) ─────────────────────────────
// Asymmetrisch: Aufstieg aus Gravitationsfeld kostet mehr als Abstieg.
// Erde→Mond teuer (Erd-Escape 11.2 km/s), Mond→Erde günstig.
// Erde startet neuer Spieler mit 20t Energie im Schiff (Erdsubvention).
//
// Prometheus (L5-Lagrange): kein nennenswertes Gravitationsfeld — nur Bahnkorrektur.
// Alle Flüge zu/von Prometheus sind günstig (5t). Anreiz: Energie dort tanken.
export const FLIGHT_ENERGY: Partial<Record<string, Partial<Record<string, number>>>> = {
  earth:      { moon: 20, mars: 35, phobos: 38, prometheus: 5  },
  moon:       { earth: 8, mars: 12, phobos: 10, prometheus: 5  },
  mars:       { earth: 30, moon: 12, phobos: 4, prometheus: 30 },
  phobos:     { earth: 32, moon: 10, mars: 6,   prometheus: 30 },
  prometheus: { earth: 5,  moon: 5,  mars: 30,  phobos: 30     },
}

// Energie-Kosten für einen Flug (t). 0 = kein Antrieb nötig (Orbit-Korrektur).
export function flightEnergyCost(from: string, to: string): number {
  return FLIGHT_ENERGY[from]?.[to] ?? 10  // Fallback 10t für unbekannte Routen
}

// Schwerkraft-Faktor je Standort (für spätere Lander-Mechanik)
export const GRAVITY_MS2: Record<string, number> = {
  earth:      9.81,
  moon:       1.62,
  mars:       3.72,
  phobos:     0.0057,
  prometheus: 0.0,    // Lagrange-Punkt: keine Eigengravitation
}

// ── Bauplan vs. lebende Instanz ──────────────────────────────────────────────
export interface ShipLoadout { frameId: string; modules: string[]; }      // Bauplan

export interface ModuleInstance {                                          // eine DB-Modulzeile
  entityId: string;       // tile_entities.id — die adressierbare UUID
  moduleId: string;       // entity_id: 'cargo' | 'tank' | …
  slot: number;
  condition: number;      // 0..100
  status: ModuleStatus;
}
export interface ShipInstance {
  entityId: string;       // tile_entities.id des Schiff-Ankers
  frameId: string;        // entity_id der Schiff-Zeile
  ownerId: string;        // profile_id
  condition: number;      // Zustand des RAHMENS selbst (0..100)
  status: ModuleStatus;   // Rahmen-Status
  modules: ModuleInstance[];
}

export function getFrame(id: string): ShipFrame | undefined { return SHIP_FRAMES[id]; }
export function getModule(id: string): ShipModule | undefined { return SHIP_MODULES[id]; }

// ── Normalisierung (Bauplan ODER Instanz → Modul-ID-Listen) ──────────────────
function isInstance(s: ShipLoadout | ShipInstance): s is ShipInstance {
  return (s as ShipInstance).entityId !== undefined;
}
/** Alle Module, die einen Slot belegen — inkl. beschädigter. */
function occupyingModuleIds(s: ShipLoadout | ShipInstance): string[] {
  return isInstance(s) ? s.modules.map(m => m.moduleId) : s.modules;
}
/** Nur funktionierende Module — beschädigte/abgeschaltete zählen nicht. */
function operationalModuleIds(s: ShipLoadout | ShipInstance): string[] {
  return isInstance(s) ? s.modules.filter(m => m.status === 'active').map(m => m.moduleId) : s.modules;
}
function sumCapacity(ids: string[], pred: (m: ShipModule) => boolean): number {
  return ids.reduce((sum, id) => { const m = SHIP_MODULES[id]; return m && pred(m) ? sum + m.capacity : sum; }, 0);
}

// ── Pure Helfer (ohne DB, testbar) ───────────────────────────────────────────
export function canTankHold(r: Resource): boolean { return RESOURCE_PHASE[r] === 'fluid'; }

/** Laderaum allgemeine Güter (nur aktive Frachtmodule). Ersetzt SHIP_CARGO_MAX. */
export function cargoCapacity(s: ShipLoadout | ShipInstance): number {
  return sumCapacity(operationalModuleIds(s), m => m.type === 'cargo');
}
export function fluidCapacity(s: ShipLoadout | ShipInstance): number {
  return sumCapacity(operationalModuleIds(s), m => m.type === 'tank');
}
export function populationCapacity(s: ShipLoadout | ShipInstance): number {
  return sumCapacity(operationalModuleIds(s), m => m.type === 'habitat');
}
export function shipFunctions(s: ShipLoadout | ShipInstance): ShipFunction[] {
  const fns = new Set<ShipFunction>();
  for (const id of operationalModuleIds(s))
    for (const f of SHIP_MODULES[id]?.provides ?? []) fns.add(f);
  return [...fns];
}
export function slotsUsed(s: ShipLoadout | ShipInstance): number { return occupyingModuleIds(s).length; }
export function slotsFree(s: ShipLoadout | ShipInstance): number {
  const f = SHIP_FRAMES[s.frameId];
  return f ? f.slots - slotsUsed(s) : 0;
}
/** Gesamtmasse — alle Module physisch, egal welcher Status. */
export function totalMass(s: ShipLoadout | ShipInstance): number {
  const f = SHIP_FRAMES[s.frameId];
  const hull = f?.hullMass ?? 0;
  return hull + occupyingModuleIds(s).reduce((sum, id) => sum + (SHIP_MODULES[id]?.mass ?? 0), 0);
}
/** Tempo. Standard = reines Rahmen-Tempo. Last-Strafe optional (Default AUS). */
export function effectiveSpeed(s: ShipLoadout | ShipInstance, opts: { massPenalty?: boolean; k?: number } = {}): number {
  const f = SHIP_FRAMES[s.frameId];
  if (!f) return 1;
  if (!opts.massPenalty) return f.baseSpeed;
  const k = opts.k ?? 0.15, ref = f.hullMass, load = totalMass(s) - ref;
  return f.baseSpeed / (1 + k * (load / ref));
}
export function travelTime(from: LocationSlug, to: LocationSlug, s: ShipLoadout | ShipInstance, opts?: { massPenalty?: boolean }): number {
  const base = baseTravelSeconds(from, to);
  if (base == null) return Infinity;
  let speed = effectiveSpeed(s, opts);
  if (shipFunctions(s).includes('boosted_drive')) speed *= 1.15;
  return base / speed;
}
export interface LoadoutCheck { ok: boolean; errors: string[] }
export function validateLoadout(s: ShipLoadout | ShipInstance): LoadoutCheck {
  const errors: string[] = [];
  const f = SHIP_FRAMES[s.frameId];
  const ids = occupyingModuleIds(s);
  if (!f) errors.push(`Unbekannter Rahmen: ${s.frameId}`);
  else if (ids.length > f.slots) errors.push(`Zu viele Module: ${ids.length}/${f.slots} Slots`);
  for (const id of ids) if (!SHIP_MODULES[id]) errors.push(`Unbekanntes Modul: ${id}`);
  return { ok: errors.length === 0, errors };
}

// ── DB-Brücke (Hydratisierung) ───────────────────────────────────────────────
/** Minimal benötigte Spalten aus tile_entities (Namen ggf. anpassen). */
export interface TileEntityRow {
  id: string; profile_id: string; entity_type: string; entity_id: string;
  parent_id: string | null; slot: number | null; condition: number; status: string;
}
/** Schiff-Ankerzeile + dessen Modulzeilen → lebende ShipInstance. */
export function hydrateShip(shipRow: TileEntityRow, moduleRows: TileEntityRow[]): ShipInstance {
  const modules: ModuleInstance[] = moduleRows
    .filter(r => r.parent_id === shipRow.id && r.entity_type === 'module')
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    .map(r => ({ entityId: r.id, moduleId: r.entity_id, slot: r.slot ?? 0, condition: r.condition, status: r.status as ModuleStatus }));
  return { entityId: shipRow.id, frameId: shipRow.entity_id, ownerId: shipRow.profile_id, condition: shipRow.condition, status: shipRow.status as ModuleStatus, modules };
}

/** Bauplan → einzufügende Modulzeilen (für Schiffsbau & Backfill). */
export interface NewModuleRow { profile_id: string; parent_id: string; slot: number; entity_type: 'module'; entity_id: string; }
export function loadoutToModuleRows(shipEntityId: string, ownerId: string, loadout: ShipLoadout): NewModuleRow[] {
  return loadout.modules.map((moduleId, slot) => ({ profile_id: ownerId, parent_id: shipEntityId, slot, entity_type: 'module', entity_id: moduleId }));
}

// ── Migration / Standard-Baupläne ────────────────────────────────────────────
export function fullCargoLoadout(frameId: string): ShipLoadout {
  const f = SHIP_FRAMES[frameId];
  return { frameId, modules: Array(f ? f.slots : 0).fill('cargo') };
}
export const CLASSIC_SHIPS: Record<string, ShipLoadout> = {
  mk1:     fullCargoLoadout('mk1'),
  fast:    fullCargoLoadout('fast'),
  heavy:   fullCargoLoadout('heavy'),
  // Standard-Konfigurationen für neue Typen
  scout:   { frameId: 'scout',   modules: ['scanner', 'deep_scanner', 'survey_drone', 'tank'] },
  pioneer: { frameId: 'pioneer', modules: ['construction_rig', 'colony_pod', 'cargo', 'cargo', 'tank', 'tank', 'habitat_pod', 'habitat_pod'] },
};
// ── Gründungs-Checks ─────────────────────────────────────────────────────────
/** Kann dieses Schiff einen Standort erkunden? (Scout + Scanner-Modul) */
export function canExplore(s: ShipLoadout | ShipInstance): boolean {
  return shipFunctions(s).includes('long_range_scan')
}

/** Kann dieses Schiff eine Kolonie/Station gründen? (Pioneer + Bau-Ausrüstung) */
export function canFoundLocation(s: ShipLoadout | ShipInstance): boolean {
  return shipFunctions(s).includes('construction')
    && shipFunctions(s).includes('colony_supplies')
}

export const FRAME_MENU  = Object.values(SHIP_FRAMES).filter(f => f.unlocked);
export const MODULE_MENU = Object.values(SHIP_MODULES).filter(m => m.unlocked);
