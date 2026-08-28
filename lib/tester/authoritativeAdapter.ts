import type { TesterAction, TesterActionResult, TesterGameAdapter, TesterObservation, TesterState } from './types'

/**
 * The tester never mutates game tables directly. These handlers must be wired to
 * the same application services/routes used by human gameplay. This is the
 * explicit authority boundary for v0.1 and keeps provider/LLM code outside it.
 */
export type AuthoritativeGamePort = {
  observe(state: TesterState): Promise<Omit<TesterObservation, 'cycle' | 'worldId' | 'playerId'>>
  travel(destination: string): Promise<TesterActionResult>
  trade(mode: 'buy' | 'sell', resource: string, amount: number): Promise<TesterActionResult>
  build(buildingId: string, row: number, col: number): Promise<TesterActionResult>
  learn(moduleId: string): Promise<TesterActionResult>
  wait(): Promise<TesterActionResult>
}

export class AuthoritativeTesterAdapter implements TesterGameAdapter {
  constructor(private readonly port: AuthoritativeGamePort) {}

  async observe(state: TesterState): Promise<TesterObservation> {
    const observation = await this.port.observe(state)
    return { ...observation, cycle: state.cycle, worldId: state.worldId, playerId: state.playerId }
  }

  async execute(_state: TesterState, action: TesterAction): Promise<TesterActionResult> {
    switch (action.type) {
      case 'TRAVEL': return this.port.travel(action.destination)
      case 'BUY': return this.port.trade('buy', action.resource, action.amount)
      case 'SELL': return this.port.trade('sell', action.resource, action.amount)
      case 'BUILD': return this.port.build(action.buildingId, action.row, action.col)
      case 'LEARN': return this.port.learn(action.moduleId)
      case 'WAIT': return this.port.wait()
    }
  }
}
