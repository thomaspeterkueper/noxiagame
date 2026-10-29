/**
 * Pure, bounded feedback signals from voluntary player/NPC interactions.
 * This is an evaluation layer, NOT a policy that rewrites personalities or
 * silently learns from private conversations. Raw message bodies are excluded.
 */
export type InteractionOutcome = 'helpful' | 'unhelpful' | 'unclear'
export type InteractionContext = 'everyday' | 'chronimap'
export interface InteractionSignal {
  id: string
  npcId: string
  topic: string
  context: InteractionContext
  outcome: InteractionOutcome
  actor: 'player' | 'npc'
  feedbackOptIn: boolean
  sourceRef: string
  simulationTick: number
  historicalEvidence?: 'documented' | 'hypothesis' | 'simulation'
}
export interface InteractionSummary {
  npcId: string
  context: InteractionContext
  topic: string
  positive: number
  negative: number
  unclear: number
  independentSources: number
  status: 'insufficient' | 'needs-review' | 'candidate-improvement'
}

/** One source may contribute at most once per NPC/topic/context review batch. */
export function summarizeInteractionSignals(signals: readonly InteractionSignal[]): InteractionSummary[] {
  const groups = new Map<string, InteractionSignal[]>()
  for (const signal of signals) {
    if (!signal.feedbackOptIn || !signal.npcId || !signal.sourceRef || !Number.isFinite(signal.simulationTick)) continue
    // Historical simulations alone do not validate empirical human behaviour.
    if (signal.context === 'chronimap' && signal.historicalEvidence === 'simulation') continue
    const key = JSON.stringify([signal.npcId,signal.context,signal.topic])
    groups.set(key,[...(groups.get(key) ?? []),signal])
  }
  return [...groups.values()].map(rows => {
    const unique = new Map<string,InteractionSignal>()
    for (const row of rows) {
      const prior = unique.get(row.sourceRef)
      if (!prior || row.simulationTick < prior.simulationTick ||
        (row.simulationTick === prior.simulationTick && row.id < prior.id)) unique.set(row.sourceRef,row)
    }
    const accepted = [...unique.values()]
    const positive = accepted.filter(r => r.outcome === 'helpful').length
    const negative = accepted.filter(r => r.outcome === 'unhelpful').length
    const unclear = accepted.filter(r => r.outcome === 'unclear').length
    const n = accepted.length
    const status: InteractionSummary['status'] = n < 5
      ? 'insufficient'
      : negative >= 3 && negative > positive ? 'needs-review' : 'candidate-improvement'
    return {npcId:rows[0].npcId,context:rows[0].context,topic:rows[0].topic,positive,negative,unclear,independentSources:n,status}
  }).sort((a,b)=>a.npcId.localeCompare(b.npcId)||a.context.localeCompare(b.context)||a.topic.localeCompare(b.topic))
}
