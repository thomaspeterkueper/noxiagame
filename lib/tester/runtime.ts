import type { TesterActionResult, TesterAnomaly, TesterGameAdapter, TesterPlanner, TesterState } from './types'

const MEMORY_LIMIT = 20
const MAX_CYCLES_PER_RUN = 8

function fingerprint(kind: string, expected: string, actual: string) {
  const input = `${kind}|${expected}|${actual}`
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619)
  return `NOXIA-${kind}-${(hash >>> 0).toString(16)}`
}

function detectAnomaly(result: TesterActionResult): TesterAnomaly | null {
  if (result.ok) return null
  const kind = result.evidence?.deadEnd === true ? 'DEAD_END' : 'BUG'
  const expected = `Action ${result.action.type} succeeds or returns a reachable alternative.`
  const actual = result.summary
  return {
    kind,
    fingerprint: fingerprint(kind, expected, actual),
    title: `${kind}: ${result.action.type} blocked tester progression`,
    reproduction: [`Start in disposable tester world`, `Execute ${JSON.stringify(result.action)}`],
    expected,
    actual,
    confidence: result.evidence?.deadEnd === true ? 0.95 : 0.8,
    evidence: result.evidence ?? {},
  }
}

export async function runTesterCycles(
  initial: TesterState,
  adapter: TesterGameAdapter,
  planner: TesterPlanner,
  requestedCycles = 1,
): Promise<{ state: TesterState; anomalies: TesterAnomaly[] }> {
  let state = structuredClone(initial)
  const anomalies: TesterAnomaly[] = []
  const cycles = Math.max(1, Math.min(requestedCycles, MAX_CYCLES_PER_RUN))

  for (let i = 0; i < cycles; i++) {
    const observation = await adapter.observe(state)
    const goal = await planner.chooseGoal(state, observation)
    if (!goal) break
    const action = await planner.chooseAction(state, observation, goal)
    const result = await adapter.execute(state, action)
    const anomaly = detectAnomaly(result)

    if (anomaly && !state.emittedFingerprints.includes(anomaly.fingerprint)) {
      anomalies.push(anomaly)
      state.emittedFingerprints = [...state.emittedFingerprints, anomaly.fingerprint].slice(-MEMORY_LIMIT)
    }

    state = {
      ...state,
      cycle: state.cycle + 1,
      goals: state.goals.some(g => g.id === goal.id) ? state.goals : [...state.goals, goal],
      recentObservations: [...state.recentObservations, observation].slice(-MEMORY_LIMIT),
      recentResults: [...state.recentResults, result].slice(-MEMORY_LIMIT),
    }
  }

  return { state, anomalies }
}

export function createInitialTesterState(worldId: string, playerId: string): TesterState {
  if (!worldId.startsWith('tester-')) throw new Error('Autonomous tester may only run in disposable tester-* worlds')
  return {
    testerId: 'NOXIA_TESTER_INTELLIGENT_01', worldId, playerId, cycle: 0,
    goals: [], recentObservations: [], recentResults: [], emittedFingerprints: [],
  }
}
