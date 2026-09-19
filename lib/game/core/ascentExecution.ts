import 'server-only'

import type { AscentControlPhase } from '@/lib/game/ascentControl'
import {
  getAscentMissionForShip,
  transitionAscentCommand,
  type AscentCommandResult,
  type AscentTransitionAction,
} from '@/lib/game/core/ascentPersistence'

export type AscentExecutionPresentation = {
  phase: AscentControlPhase
  progress: number
  label: string
  nextAction: AscentTransitionAction | null
  terminal: boolean
}

/**
 * Client code never chooses a low-level phase transition. The trusted Core derives
 * the only valid command from persisted mission state.
 */
export function nextExecutionAction(phase: AscentControlPhase): AscentTransitionAction | null {
  switch (phase) {
    case 'ascent-authorized':
      return 'start'
    case 'ascending':
      return 'mark_insertion'
    case 'orbital-insertion':
      return 'mark_arrival'
    case 'surface':
    case 'orbital-arrival':
    case 'aborted':
      return null
  }
}

export function ascentExecutionPresentation(phase: AscentControlPhase): AscentExecutionPresentation {
  switch (phase) {
    case 'surface':
      return { phase, progress: 0, label: 'Auf Oberfläche', nextAction: null, terminal: true }
    case 'ascent-authorized':
      return { phase, progress: 0.1, label: 'Startfreigabe erteilt', nextAction: 'start', terminal: false }
    case 'ascending':
      return { phase, progress: 0.5, label: 'Aufstieg', nextAction: 'mark_insertion', terminal: false }
    case 'orbital-insertion':
      return { phase, progress: 0.82, label: 'Orbitale Insertion', nextAction: 'mark_arrival', terminal: false }
    case 'orbital-arrival':
      return { phase, progress: 1, label: 'Orbit erreicht', nextAction: null, terminal: true }
    case 'aborted':
      return { phase, progress: 0, label: 'Aufstieg abgebrochen', nextAction: null, terminal: true }
  }
}

export async function advanceAscentCommand(input: {
  commandId: string
  actorProfileId: string
  shipId: string
}): Promise<AscentCommandResult & { presentation: AscentExecutionPresentation }> {
  const mission = await getAscentMissionForShip(input.actorProfileId, input.shipId)
  if (!mission) throw new Error('NOXIA_ASCENT_MISSION_NOT_FOUND')
  if (mission.status !== 'active') throw new Error('NOXIA_ASCENT_MISSION_NOT_ACTIVE')

  const action = nextExecutionAction(mission.phase)
  if (!action) throw new Error('NOXIA_ASCENT_NO_EXECUTABLE_TRANSITION')

  const result = await transitionAscentCommand({
    commandId: input.commandId,
    actorProfileId: input.actorProfileId,
    missionId: mission.id,
    action,
  })

  return {
    ...result,
    presentation: ascentExecutionPresentation(result.phase),
  }
}
