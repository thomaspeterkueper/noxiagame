import { describe, expect, it } from 'vitest'
import {
  effectiveModuleUnlocks,
  equivalentModuleIds,
  moduleTeachesUnlock,
  unlockDisplayLabel,
  unlocksForModule,
} from './learningCatalog'
import { resolveModuleForUnlock, normalizeModule, type SsfKnowledgeModule } from '@/lib/ssfKnowledge'
import { gateOpen, gateStatuses, learningGatesFor } from '@/lib/game/interiors/learningGates'

// So liefert die SSF die Module am 28.10.2026 (governed Finanzpfade ohne unlocks).
function ssf(id: string, legacyId: string, unlocks: string[], title = id): SsfKnowledgeModule {
  return {
    id, legacyId, pathId: null, title, domain: 'ECO', difficulty: 1, durationMinutes: 14,
    summary: '', unlocks, sourceEntityIds: [], ssfUrl: '', detailUrl: '',
  }
}

const SSF_MODULES = [
  ssf('LRN:SSF:ECO-L0-000001', 'ECO-L0-000001', [], 'Was kostet geliehenes Kapital wirklich?'),
  ssf('LRN:SSF:ECO-L0-000002', 'ECO-L0-000002', []),
  ssf('LRN:SSF:ENG-POWER-GENERATION-0001', 'ENG-L1-000001', ['UNL:NOX:power-generation']),
  ssf('LRN:SSF:NOX-WATER-PROCESSING', 'SSF-NOX-WATER-0001', ['UNL:NOX:water-processing']),
].map(normalizeModule)

describe('Lernverzeichnis: Voraussetzung → Lernmodul', () => {
  it('findet das Kreditmodul, obwohl die SSF keine Freischaltung einträgt', () => {
    expect(resolveModuleForUnlock(SSF_MODULES, 'UNL:NOX:bank-credit')?.id).toBe('LRN:SSF:ECO-L0-000001')
  })

  it('findet das Solarfeld-Modul über die SSF-Angabe', () => {
    expect(resolveModuleForUnlock(SSF_MODULES, 'UNL:NOX:power-generation')?.id).toBe('LRN:SSF:ENG-POWER-GENERATION-0001')
  })

  it('ergänzt beim Normalisieren die NOXIA-Freischaltung', () => {
    expect(SSF_MODULES[0].unlocks).toContain('UNL:NOX:bank-credit')
    expect(SSF_MODULES[1].unlocks).toContain('UNL:NOX:bank-compound')
    expect(SSF_MODULES[2].unlocks).toEqual(['UNL:NOX:power-generation'])
  })

  it('ordnet Abschlüsse unter SSF-Kennung und Kurzkennung demselben Modul zu', () => {
    expect(unlocksForModule('LRN:SSF:ECO-L0-000001')).toEqual(['UNL:NOX:bank-credit'])
    expect(unlocksForModule('ECO-L0-000001')).toEqual(['UNL:NOX:bank-credit'])
    expect(equivalentModuleIds('ECO-L0-000001')).toContain('LRN:SSF:ECO-L0-000001')
    expect(unlocksForModule('LRN:SSF:UNBEKANNT')).toEqual([])
  })

  it('akzeptiert SSF-Unlocks als { key } und dedupliziert', () => {
    expect(effectiveModuleUnlocks({ id: 'LRN:SSF:ECO-L0-000001', unlocks: [{ key: 'UNL:NOX:bank-credit' }] }))
      .toEqual(['UNL:NOX:bank-credit'])
    expect(moduleTeachesUnlock({ id: 'X', legacyId: 'ENG-L1-000001' }, 'UNL:NOX:power-generation')).toBe(true)
  })

  it('zeigt lesbare Namen statt Kennungen', () => {
    expect(unlockDisplayLabel('UNL:NOX:power-generation')).toBe('Energieerzeugung I')
    expect(unlockDisplayLabel('UNL:NOX:bank-credit')).toBe('Kredit aufnehmen')
    expect(unlockDisplayLabel('UNL:NOX:gibt-es-nicht')).toBe('UNL:NOX:gibt-es-nicht')
  })
})

describe('Bank: Lernschwelle Kredit', () => {
  it('öffnet das Kreditmodul in der Bank wieder', () => {
    const credit = gateStatuses('bank', null, SSF_MODULES).find(s => s.gate.id === 'bank-credit')
    expect(credit?.moduleId).toBe('LRN:SSF:ECO-L0-000001')
  })

  it('gilt als erfüllt, wenn der Abschluss unter der SSF-Kennung gespeichert ist', () => {
    const credit = learningGatesFor('bank').find(g => g.id === 'bank-credit')!
    expect(gateOpen(credit, { unlocks: [], completedModules: ['LRN:SSF:ECO-L0-000001'] })).toBe(true)
    expect(gateOpen(credit, { unlocks: [], completedModules: ['ECO-L0-000001'] })).toBe(true)
    expect(gateOpen(credit, { unlocks: [], completedModules: [] })).toBe(false)
  })
})
