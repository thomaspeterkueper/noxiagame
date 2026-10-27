import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: [
      'lib/game/science/geodynamoPilot.test.ts',
      'lib/game/science/geodynamoScenarios.test.ts',
    ],
    environment: 'node',
  },
})
