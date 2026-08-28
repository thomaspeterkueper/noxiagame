import { createServiceClient } from '@/lib/supabase/service'
import type { TesterState } from './types'

export async function loadTesterState(testerId: string): Promise<TesterState | null> {
  const db = createServiceClient()
  const { data, error } = await db.from('noxia_tester_state').select('*').eq('tester_id', testerId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    testerId: 'NOXIA_TESTER_INTELLIGENT_01',
    worldId: data.world_id,
    playerId: data.player_id,
    cycle: data.cycle,
    goals: data.goals ?? [],
    recentObservations: data.recent_observations ?? [],
    recentResults: data.recent_results ?? [],
    emittedFingerprints: data.emitted_fingerprints ?? [],
  }
}

export async function saveTesterState(state: TesterState): Promise<void> {
  if (!state.worldId.startsWith('tester-')) throw new Error('Tester state is restricted to disposable tester-* worlds')
  const db = createServiceClient()
  const { error } = await db.from('noxia_tester_state').upsert({
    tester_id: state.testerId,
    world_id: state.worldId,
    player_id: state.playerId,
    cycle: state.cycle,
    goals: state.goals,
    recent_observations: state.recentObservations.slice(-20),
    recent_results: state.recentResults.slice(-20),
    emitted_fingerprints: state.emittedFingerprints.slice(-20),
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
