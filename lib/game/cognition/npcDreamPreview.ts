import { synthesizeNpcDream, type DreamEpisode, type DreamSource } from '../knowledge/dreamKnowledge'
import type { NpcMemoryState } from './npcRelationalMemory'

/**
 * Read-only bridge to relational NPC memory.
 * A caller must supply a validated sleep event and an approved cached source pool.
 * No persistence, web requests or canonical world mutations occur here.
 */
export function previewRelationalNpcDream(input: {
  state: NpcMemoryState
  sleeping: boolean
  tick: number
  worldYear: number
  cachedSources: readonly DreamSource[]
}): DreamEpisode | null {
  const memories = input.state.memories
    .filter(m => m.npcId === input.state.npcId && m.state !== 'forgotten' &&
      input.state.traces.some(t => t.id === m.traceId && t.active))
    .map(m => ({
      id: m.id,
      summary: m.subjectRef + ' / ' + m.attribute,
      emotionalWeight: m.salience,
    }))
  return synthesizeNpcDream({
    npcId: input.state.npcId,
    sleeping: input.sleeping,
    tick: input.tick,
    worldYear: input.worldYear,
    memories,
    sources: input.cachedSources,
  })
}
