// vitest.config.mts
// Konfiguration für die vitest-Tests (describe/it/expect).
//
// Bewusst eine explizite Dateiliste: Die übrigen *.test.ts im Projekt sind
// eigenständige Assert-Skripte, die über die test:*-Skripte in package.json
// mit tsc + node laufen. vitest würde sie als "No test suite found" melden.
// Neue vitest-Tests hier eintragen.
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: [
      'lib/game/buildings/technicalProvenance.test.ts',
      'lib/game/core/facilityIncidents.test.ts',
      'lib/game/core/facilityMaintenance.test.ts',
      'lib/game/core/facilityProductionWear.test.ts',
      'lib/game/infrastructure/earthAccess.test.ts',
      'lib/game/infrastructure/network.test.ts',
      'lib/game/population/canonicalCharacter.test.ts',
      'lib/game/population/health.test.ts',
      'lib/game/population/healthEffects.test.ts',
      'lib/game/population/localVisit.test.ts',
      'lib/game/population/settlementCapabilities.test.ts',
      'lib/game/population/settlementCapabilityGraph.test.ts',
      'lib/game/population/settlementCapabilityProjection.test.ts',
    ],
  },
})
