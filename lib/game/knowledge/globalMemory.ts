/**
 * NOXIA Global Memory – bounded, source-aware world history projection.
 *
 * The authoritative simulation may supply events, but an actor cannot read
 * world history merely because the runtime knows it. This is a pure domain
 * kernel: no persistence, surveillance, or implicit NPC memory writes.
 * Related: #618 (global memory), #617 (autobiography), #614 (forensics).
 */
export type HistoricalEvent = Readonly<{
  id: string
  tick: number
  kind: string
  summary: string
  /** Only non-personal or lawfully retained historical content is eligible. */
  retention: 'world-public' | 'restricted' | 'erased'
  provenanceRef: string
}>

export type HistoricalSource = Readonly<{
  id: string
  eventId: string
  kind: 'witness' | 'testimony' | 'archive' | 'institution'
  /** A public world chronicle is not the same as private forensic evidence. */
  visibility: 'public' | 'restricted'
  availableFromTick: number
  /** Actor IDs who can directly access this source when restricted. */
  permittedActorIds: readonly string[]
  /** What the source actually says – can disagree with the event. */
  claimText: string
}>

export type HistoricalExposure = Readonly<{
  actorId: string
  sourceId: string
  tick: number
  channel: 'observed' | 'read' | 'heard'
}>

export type HistoricalKnowledge = Readonly<{
  actorId: string
  eventId: string
  sourceId: string
  learnedAtTick: number
  claimText: string
  /** Event fact, subjective claim, and archive remain separate. */
  epistemicStatus: 'direct-observation' | 'reported'
}>

function nonempty(value: string, label: string) {
  if (!value.trim()) throw new Error('Missing ' + label)
  return value.trim()
}
function tick(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid tick')
  return value
}

export function recordHistoricalEvent(input: HistoricalEvent): HistoricalEvent {
  return Object.freeze({
    id: nonempty(input.id, 'event id'),
    tick: tick(input.tick),
    kind: nonempty(input.kind, 'event kind'),
    summary: nonempty(input.summary, 'event summary'),
    retention: input.retention,
    provenanceRef: nonempty(input.provenanceRef, 'provenance'),
  })
}

export function publishHistoricalSource(input: HistoricalSource): HistoricalSource {
  if (!['witness', 'testimony', 'archive', 'institution'].includes(input.kind))
    throw new Error('Invalid source kind')
  if (!['public', 'restricted'].includes(input.visibility))
    throw new Error('Invalid visibility')
  return Object.freeze({
    ...input,
    id: nonempty(input.id, 'source id'),
    eventId: nonempty(input.eventId, 'event id'),
    availableFromTick: tick(input.availableFromTick),
    claimText: nonempty(input.claimText, 'claim'),
    permittedActorIds: Object.freeze([...input.permittedActorIds]),
  })
}

/**
 * Explicit exposure is required even for a public source. A source becoming
 * public never silently uploads its contents into every NPC's memory.
 * This is NOT an authorization boundary for storage or API access: callers
 * must enforce permissions before fetching private source content.
 */
export function learnFromHistoricalSource(input: {
  event: HistoricalEvent
  source: HistoricalSource
  exposure: HistoricalExposure
}): HistoricalKnowledge {
  const { event, source, exposure } = input
  nonempty(exposure.actorId, 'actor id')
  if (event.retention !== 'world-public')
    throw new Error('Event is not eligible for global-memory projection')
  if (source.eventId !== event.id) throw new Error('Source/event mismatch')
  if (exposure.sourceId !== source.id) throw new Error('Exposure/source mismatch')
  tick(exposure.tick)
  if (source.availableFromTick < event.tick || exposure.tick < source.availableFromTick)
    throw new Error('Source not yet available')
  if (source.visibility === 'restricted' && !source.permittedActorIds.includes(exposure.actorId))
    throw new Error('Actor cannot access source')
  if (source.kind === 'witness' && exposure.channel !== 'observed')
    throw new Error('Witness source requires direct observation')
  if (source.kind !== 'witness' && exposure.channel === 'observed')
    throw new Error('Archive or testimony is not direct observation')
  return Object.freeze({
    actorId: exposure.actorId,
    eventId: event.id,
    sourceId: source.id,
    learnedAtTick: exposure.tick,
    claimText: source.claimText,
    epistemicStatus: source.kind === 'witness' ? 'direct-observation' : 'reported',
  })
}

/**
 * Explicit privacy lifecycle transition: do not keep identifying event text
 * in world-facing history after it has become ineligible. The authoritative
 * store, indexes, embeddings and backups still need a separate erasure flow.
 */
export function redactWorldEvent(event: HistoricalEvent): HistoricalEvent {
  return Object.freeze({
    ...event, summary: '[redacted]', provenanceRef: '[redacted]', retention: 'erased' as const,
  })
}
