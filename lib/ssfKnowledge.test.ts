// ssfKnowledge.test.ts
// Integrationstest: Unlock → SSF-Lernmodul (KG/SSF-Vertrag)
// EXT-KG-NOX-20260901-POWER-GENERATION-MAPPING:
//   NOXIA-local:      UNL:NOX:power-generation
//   KnowledgeDomain:  KD:ENG-POWER-GENERATION:N2
//   LearningModule:   ENG-L1-000001
//   KXF/Consumer-ID:  LRN:SSF:ENG-POWER-GENERATION-0001
//
// Muster wie lib/game/*.test.ts: reines node:assert, kompiliert via tsc und
// mit `node` ausgefuehrt (siehe .github/workflows/ssf-knowledge-domain.yml).

import assert from 'node:assert/strict'
import {
  normalizeModule,
  resolveModuleForUnlock,
  type SsfKnowledgeModule,
} from './ssfKnowledge'
import { getUnlockDefinition, UNLOCK_REGISTRY } from './knowledge/unlockRegistry'

function makeModule(overrides: Partial<SsfKnowledgeModule>): SsfKnowledgeModule {
  return {
    id: 'LRN:SSF:OTHER-000001',
    legacyId: null,
    pathId: null,
    title: 'Anderes Modul',
    domain: 'SSF',
    difficulty: 1,
    durationMinutes: 10,
    summary: 'Dekoy-Modul ohne Power-Generation-Bezug.',
    unlocks: [],
    sourceEntityIds: [],
    ssfUrl: 'https://solarsciencefoundation.vercel.app/learn',
    detailUrl: 'https://solarsciencefoundation.vercel.app/api/noxia/modules/LRN%3ASSF%3AOTHER-000001',
    ...overrides,
  }
}

// Kanonisches Modul exakt wie im SSF-Feed (api/noxia/modules) geliefert.
const canonicalPowerGenerationModule = makeModule({
  id: 'LRN:SSF:ENG-POWER-GENERATION-0001',
  legacyId: 'ENG-L1-000001',
  pathId: 'PATH:SSF:NOX-POWER-GENERATION-0001',
  title: 'Wie wird aus einer Energiequelle nutzbarer elektrischer Strom?',
  domain: 'KD',
  durationMinutes: 28,
  unlocks: ['UNL:NOX:power-generation'],
  sourceEntityIds: ['KD:ENG-POWER-GENERATION:N2', 'ENG-L1-000001'],
})

// ── Resolver: UNL:NOX:power-generation → kanonisches Modul ───────────────────
{
  const resolved = resolveModuleForUnlock(
    [canonicalPowerGenerationModule, makeModule({})],
    'UNL:NOX:power-generation',
  )
  assert.ok(resolved, 'Unlock muss auf genau ein SSF-Modul aufloesen')
  assert.equal(resolved.id, 'LRN:SSF:ENG-POWER-GENERATION-0001')
  assert.equal(resolved.legacyId, 'ENG-L1-000001')
  assert.equal(resolved.pathId, 'PATH:SSF:NOX-POWER-GENERATION-0001')
}

// ── SSF liefert unlocks z.T. als { key, condition } statt String ─────────────
{
  const raw = normalizeModule({
    ...canonicalPowerGenerationModule,
    unlocks: [
      { key: 'UNL:NOX:power-generation', condition: { type: 'module_completed' } },
    ],
  } as unknown as SsfKnowledgeModule)
  const resolved = resolveModuleForUnlock([raw], 'UNL:NOX:power-generation')
  assert.ok(resolved, 'Objektform der unlocks muss normalisiert matchen')
  assert.equal(resolved.id, 'LRN:SSF:ENG-POWER-GENERATION-0001')
}

// ── Fehleransicht darf nur bei echt fehlendem Modul erscheinen ───────────────
{
  assert.equal(resolveModuleForUnlock([], 'UNL:NOX:power-generation'), null)
  assert.equal(
    resolveModuleForUnlock([makeModule({})], 'UNL:NOX:power-generation'),
    null,
  )
}

// ── Keine Verwechslung mit anderen Unlocks ───────────────────────────────────
{
  const otherUnlockModule = makeModule({ unlocks: ['UNL:NOX:water-processing'] })
  assert.equal(
    resolveModuleForUnlock([otherUnlockModule], 'UNL:NOX:power-generation'),
    null,
  )
  const resolved = resolveModuleForUnlock(
    [canonicalPowerGenerationModule],
    'UNL:NOX:water-processing',
  )
  assert.equal(resolved, null)
}

// ── normalizeModule: null-sichere Felder ─────────────────────────────────────
{
  const normalized = normalizeModule(makeModule({}))
  assert.equal(normalized.pathId, null)
  assert.equal(normalized.legacyId, null)
  assert.deepEqual(normalized.unlocks, [])
}

// ── NOXIA bleibt Source of Truth: lokale Unlock-ID unveraendert ──────────────
{
  const definition = getUnlockDefinition('UNL:NOX:power-generation')
  assert.ok(definition, 'Lokale Unlock-Definition muss bestehen bleiben')
  assert.equal(definition.id, 'UNL:NOX:power-generation')
  assert.equal(definition.ssfMapping, 'module.unlocks[]')
  assert.ok(definition.grants.includes('BLD:NOX:solarfeld-1'))
  // Keine alternativen KD:*- oder LearningModule-IDs im lokalen Registry.
  for (const key of Object.keys(UNLOCK_REGISTRY)) {
    assert.ok(key.startsWith('UNL:NOX:'), `Registry-Key muss NOXIA-lokal sein: ${key}`)
  }
}

console.log('ssfKnowledge.test.ts: alle Assertions bestanden')
