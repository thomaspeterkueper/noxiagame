// NOXIA_TESTER_INTELLIGENT_01 — bounded runtime contracts
// v0.1.0 · 2026-08-28

export type TesterAnomalyKind = 'BUG' | 'DEAD_END'

export type TesterObservation = {
  cycle: number
  worldId: string
  playerId: string
  location: string
  credits: number
  cargo: Record<string, number>
  availableActions: TesterAction[]
  facts: Record<string, unknown>
}

export type TesterAction =
  | { type: 'WAIT' }
  | { type: 'TRAVEL'; destination: string }
  | { type: 'BUY'; resource: string; amount: number }
  | { type: 'SELL'; resource: string; amount: number }
  | { type: 'BUILD'; buildingId: string; row: number; col: number }
  | { type: 'LEARN'; moduleId: string }

export type TesterActionResult = {
  ok: boolean
  action: TesterAction
  summary: string
  evidence?: Record<string, unknown>
}

export type TesterGoal = {
  id: string
  description: string
  done: boolean
}

export type TesterAnomaly = {
  kind: TesterAnomalyKind
  fingerprint: string
  title: string
  reproduction: string[]
  expected: string
  actual: string
  confidence: number
  evidence: Record<string, unknown>
}

export type TesterState = {
  testerId: 'NOXIA_TESTER_INTELLIGENT_01'
  worldId: string
  playerId: string
  cycle: number
  goals: TesterGoal[]
  recentObservations: TesterObservation[]
  recentResults: TesterActionResult[]
  emittedFingerprints: string[]
}

export interface TesterGameAdapter {
  observe(state: TesterState): Promise<TesterObservation>
  execute(state: TesterState, action: TesterAction): Promise<TesterActionResult>
}

export interface TesterPlanner {
  chooseGoal(state: TesterState, observation: TesterObservation): Promise<TesterGoal | null>
  chooseAction(state: TesterState, observation: TesterObservation, goal: TesterGoal): Promise<TesterAction>
}
