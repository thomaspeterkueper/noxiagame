export const PLAYER_IDENTITY_STATES = ['unknown', 'inferred', 'known'] as const
export type PlayerIdentityState = (typeof PLAYER_IDENTITY_STATES)[number]

export interface PlayerIdentityKnowledge {
  state: PlayerIdentityState
  observableDescription: string
  inferredName?: string | null
  knownName?: string | null
}

export function perceivedPersonLabel(input: PlayerIdentityKnowledge): string {
  if (input.state === 'known' && input.knownName?.trim()) return input.knownName.trim()
  if (input.state === 'inferred' && input.inferredName?.trim()) return input.inferredName.trim()
  return input.observableDescription.trim() || 'Person'
}

export function perceivedIdentityState(row: {
  identity_state?: string | null
  inferred_name?: string | null
  known_name?: string | null
} | null | undefined): PlayerIdentityState {
  if (row?.identity_state === 'known' && row.known_name?.trim()) return 'known'
  if (row?.identity_state === 'inferred' && row.inferred_name?.trim()) return 'inferred'
  return 'unknown'
}
