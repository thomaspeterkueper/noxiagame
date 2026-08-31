// unlockRegistry.ts
// Kanonische NOXIA-Semantik fuer Wissens-Unlocks.
// NOXIA ist Source of Truth fuer Identitaet, Scope und Spielwirkung.

import type { UnlockId } from './types';

export type UnlockDefinition = {
  id: UnlockId;
  label: string;
  scope: string;
  requiresUnlocks: UnlockId[];
  grants: string[];
  ssfMapping: 'module.unlocks[]';
  tier: 'foundation' | 'component' | 'subsystem' | 'integration';
};

export type BlockedUnlock = {
  id: string;
  missingUnlocks: UnlockId[];
};

export const UNLOCK_REGISTRY: Record<string, UnlockDefinition> = {
  'UNL:NOX:resource-extraction': {
    id: 'UNL:NOX:resource-extraction',
    label: 'Rohstoffgewinnung I',
    scope: 'Grundlegende Prozesskette vom Deposit zum nutzbaren Rohstoff bzw. Handelsgut: Entnahme/Abbau, Zerkleinerung, Trennung/Anreicherung, Aufbereitung, Ausbeute, Reinheit, Energie-/Wasserbedarf und Reststoffe.',
    requiresUnlocks: [],
    grants: ['BLD:NOX:mine-1', 'Basale Rohstoffgewinnung aus Deposits'],
    ssfMapping: 'module.unlocks[]',
    tier: 'foundation',
  },
  'UNL:NOX:power-generation': {
    id: 'UNL:NOX:power-generation',
    label: 'Energieerzeugung I',
    scope: 'Grundlagen elektrischer Energieerzeugung und ihrer Bereitstellung fuer technische Systeme.',
    requiresUnlocks: [],
    grants: ['BLD:NOX:solarfeld-1'],
    ssfMapping: 'module.unlocks[]',
    tier: 'foundation',
  },
  'UNL:NOX:water-processing': {
    id: 'UNL:NOX:water-processing',
    label: 'Wasseraufbereitung I',
    scope: 'Rohwasser beurteilen und eine geeignete Aufbereitungskette aus mechanischer Trennung, Adsorption, Desinfektion sowie Verfahren fuer geloeste Stoffe/Salze zusammenstellen; einschliesslich Recycling- und extraterrestrischer Versorgung.',
    requiresUnlocks: [],
    grants: ['BLD:NOX:wasseraufbereitung-1', 'Basale Wasseraufbereitung und Recyclingwasser-Behandlung'],
    ssfMapping: 'module.unlocks[]',
    tier: 'foundation',
  },
  'UNL:NOX:pressure-systems': {
    id: 'UNL:NOX:pressure-systems', label: 'Drucksysteme I',
    scope: 'Druck, Gasverhalten, drucktragende und gasdichte Huelle sowie kontrollierter Druckraum.',
    requiresUnlocks: [], grants: ['Einfache Druckkabine'], ssfMapping: 'module.unlocks[]', tier: 'component',
  },
  'UNL:NOX:airlock': {
    id: 'UNL:NOX:airlock', label: 'Luftschleusen I',
    scope: 'Kontrollierter Personen-/Materialtransfer zwischen Atmosphaeren mit unterschiedlichem Druck und Gasinventar.',
    requiresUnlocks: ['UNL:NOX:pressure-systems'], grants: ['Luftschleuse'], ssfMapping: 'module.unlocks[]', tier: 'component',
  },
  'UNL:NOX:life-support': {
    id: 'UNL:NOX:life-support', label: 'Lebenserhaltung I',
    scope: 'Sauerstoffversorgung, CO2-Abscheidung, Luftumwaelzung und Kopplung mit Wasser- und Energieversorgung.',
    requiresUnlocks: ['UNL:NOX:pressure-systems', 'UNL:NOX:water-processing', 'UNL:NOX:power-generation'],
    grants: ['Lebenserhaltungsmodul'], ssfMapping: 'module.unlocks[]', tier: 'subsystem',
  },
  'UNL:NOX:thermal-control': {
    id: 'UNL:NOX:thermal-control', label: 'Thermische Kontrolle I',
    scope: 'Waermeisolierung, Heizen, Kuehlen und Waermetransport in geschlossenen Habitaten.',
    requiresUnlocks: ['UNL:NOX:power-generation'], grants: ['Thermisches Kontrollsystem'], ssfMapping: 'module.unlocks[]', tier: 'subsystem',
  },
  'UNL:NOX:radiation-protection': {
    id: 'UNL:NOX:radiation-protection', label: 'Strahlenschutz I',
    scope: 'Grundlegende Schutzprinzipien gegen die fuer extraterrestrische Habitate relevanten ionisierenden Strahlungsfelder.',
    requiresUnlocks: [], grants: ['Geschuetzter Aufenthaltsbereich'], ssfMapping: 'module.unlocks[]', tier: 'component',
  },
  'UNL:NOX:environment-monitoring': {
    id: 'UNL:NOX:environment-monitoring', label: 'Umweltueberwachung I',
    scope: 'Sensorische Ueberwachung kritischer Habitatparameter und Erkennen gefaehrlicher Abweichungen.',
    requiresUnlocks: ['UNL:NOX:power-generation'], grants: ['Habitat-Umweltsensorik'], ssfMapping: 'module.unlocks[]', tier: 'component',
  },
  'UNL:NOX:habitat-redundancy': {
    id: 'UNL:NOX:habitat-redundancy', label: 'Systemredundanz I',
    scope: 'Single Points of Failure erkennen und kritische Habitatfunktionen fehlertolerant bzw. redundant auslegen.',
    requiresUnlocks: ['UNL:NOX:life-support', 'UNL:NOX:environment-monitoring'], grants: ['Redundante Habitatversorgung'], ssfMapping: 'module.unlocks[]', tier: 'subsystem',
  },
  'UNL:NOX:mars-habitat': {
    id: 'UNL:NOX:mars-habitat', label: 'Mars-Habitat I',
    scope: 'Integrations-/Master-Unlock: ein Mars-Habitat als gekoppeltes System aus Druckhuelle, Schleuse, Lebenserhaltung, Wasser, Energie, thermischer Kontrolle, Strahlenschutz, Sensorik und Fehlertoleranz verstehen und betreiben.',
    requiresUnlocks: [
      'UNL:NOX:water-processing', 'UNL:NOX:power-generation', 'UNL:NOX:pressure-systems',
      'UNL:NOX:airlock', 'UNL:NOX:life-support', 'UNL:NOX:thermal-control',
      'UNL:NOX:radiation-protection', 'UNL:NOX:environment-monitoring', 'UNL:NOX:habitat-redundancy',
    ],
    grants: ['BLD:NOX:mars-habitat-1'], ssfMapping: 'module.unlocks[]', tier: 'integration',
  },
  'UNL:NOX:smelting': {
    id: 'UNL:NOX:smelting', label: 'Metallurgie I', scope: 'Thermische Metallgewinnung und Weiterverarbeitung.',
    requiresUnlocks: ['UNL:NOX:resource-extraction'], grants: ['BLD:NOX:schmelze-1'], ssfMapping: 'module.unlocks[]', tier: 'subsystem',
  },
};

export function getUnlockDefinition(id: string) { return UNLOCK_REGISTRY[id] ?? null; }
export function getUnlockLabel(id: string) { return getUnlockDefinition(id)?.label ?? id; }

export function getMissingUnlockPrerequisites(id: string, unlocked: Iterable<string>): UnlockId[] {
  const definition = getUnlockDefinition(id);
  if (!definition) return [];
  const unlockedSet = unlocked instanceof Set ? unlocked : new Set(unlocked);
  return definition.requiresUnlocks.filter(required => !unlockedSet.has(required));
}

export function resolveGrantableUnlocks(candidateIds: string[], existingIds: Iterable<string>) {
  const unlocked = new Set(existingIds);
  const pending = [...new Set(candidateIds)].filter(id => !unlocked.has(id));
  const grantable: string[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const id = pending[i];
      if (getMissingUnlockPrerequisites(id, unlocked).length === 0) {
        grantable.push(id);
        unlocked.add(id);
        pending.splice(i, 1);
        changed = true;
      }
    }
  }

  const blocked: BlockedUnlock[] = pending.map(id => ({
    id,
    missingUnlocks: getMissingUnlockPrerequisites(id, unlocked),
  }));

  return { grantable, blocked };
}
