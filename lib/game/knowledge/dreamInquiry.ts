import type { DreamEpisode } from './dreamKnowledge'

/** Dreams can motivate questions, never certify facts. */
export type DreamInquiry = Readonly<{
  id: string
  npcId: string
  dreamId: string
  createdAtTick: number
  question: string
  motivation: 'curiosity' | 'reassurance'
  state: 'unverified'
  sourceIds: readonly string[]
}>

export function proposeDreamInquiry(input: {
  dream: DreamEpisode
  awake: boolean
  atTick: number
  curiosity: number
}): DreamInquiry | null {
  const { dream, awake, atTick, curiosity } = input
  if (!Number.isSafeInteger(atTick) || atTick < dream.atTick) throw new Error('Invalid wake tick')
  if (!Number.isFinite(curiosity) || curiosity < 0 || curiosity > 1) throw new Error('Invalid curiosity')
  if (!awake || !dream.motifs.length || curiosity < 0.5) return null
  if (dream.epistemicStatus !== 'subjective-dream') throw new Error('Invalid dream epistemic status')
  const motif = dream.motifs[0].slice(0, 120).replace(/[\r\n]+/g, ' ').trim()
  if (!motif) return null
  return Object.freeze({
    id: 'dream-inquiry:' + dream.id,
    npcId: dream.npcId,
    dreamId: dream.id,
    createdAtTick: atTick,
    question: 'Why did I dream about ' + motif + '?',
    motivation: dream.emotionalTone === 'nightmare' ? 'reassurance' as const : 'curiosity' as const,
    state: 'unverified' as const,
    sourceIds: Object.freeze([...dream.sourceIds]),
  })
}
