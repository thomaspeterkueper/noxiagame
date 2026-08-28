import { createInitialTesterState, runTesterCycles } from './runtime'
import type { TesterAction, TesterGameAdapter, TesterObservation, TesterPlanner, TesterState } from './types'

class DeterministicPlanner implements TesterPlanner {
  async chooseGoal() { return { id: 'reach-moon', description: 'Reach the Moon through normal gameplay', done: false } }
  async chooseAction(_state: TesterState, observation: TesterObservation): Promise<TesterAction> {
    return observation.availableActions[0] ?? { type: 'WAIT' }
  }
}

class HarnessAdapter implements TesterGameAdapter {
  constructor(private mode: 'normal' | 'dead-end') {}
  async observe(state: TesterState): Promise<TesterObservation> {
    return {
      cycle: state.cycle, worldId: state.worldId, playerId: state.playerId,
      location: 'earth', credits: 5000, cargo: {},
      availableActions: [{ type: 'TRAVEL', destination: 'moon' }],
      facts: { deterministic: true },
    }
  }
  async execute(_state: TesterState, action: TesterAction) {
    if (this.mode === 'normal') return { ok: true, action, summary: 'Travel accepted', evidence: { destination: 'moon' } }
    return { ok: false, action, summary: 'No reachable action can satisfy the current goal', evidence: { deadEnd: true, location: 'earth' } }
  }
}

export async function runDeterministicTesterHarness() {
  const planner = new DeterministicPlanner()
  const normal = await runTesterCycles(createInitialTesterState('tester-normal', 'tester-01'), new HarnessAdapter('normal'), planner, 1)
  const anomaly = await runTesterCycles(createInitialTesterState('tester-dead-end', 'tester-01'), new HarnessAdapter('dead-end'), planner, 1)
  if (normal.anomalies.length !== 0) throw new Error('Normal cycle unexpectedly emitted anomaly')
  if (anomaly.anomalies.length !== 1 || anomaly.anomalies[0].kind !== 'DEAD_END') throw new Error('Dead-end cycle did not emit exactly one DEAD_END')
  return { normal, anomaly }
}
