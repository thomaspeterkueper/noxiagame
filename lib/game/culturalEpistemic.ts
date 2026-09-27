export type CesOntologyClass =
  | 'determinate'
  | 'determinate_hidden'
  | 'generative'
  | 'open'

export interface BeliefState {
  commitment: number
  socialBinding: number
  revisability: number
  salience: number
}

export type CesSemanticRole =
  | 'source_object'
  | 'interpretation'
  | 'received_tradition'
  | 'institutional_position'
  | 'individual_belief'
  | 'public_memory'

export interface CesQuestion<T = unknown> {
  id: string
  ontology: CesOntologyClass
  value?: T
}

export interface CesActivationInput {
  belief: BeliefState
  relevance: number
  intensity?: number
}

export interface CesActivation {
  active: boolean
  effectiveSalience: number
}

export function clampCesUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function normalizeBeliefState(state: BeliefState): BeliefState {
  return {
    commitment: clampCesUnit(state.commitment),
    socialBinding: clampCesUnit(state.socialBinding),
    revisability: clampCesUnit(state.revisability),
    salience: clampCesUnit(state.salience),
  }
}

/**
 * Cheap deterministic gate for event-driven CES work.
 * This does not interpret a belief and does not call an LLM.
 */
export function evaluateCesActivation(input: CesActivationInput): CesActivation {
  const belief = normalizeBeliefState(input.belief)
  const relevance = clampCesUnit(input.relevance)
  const intensity = clampCesUnit(input.intensity ?? 1)
  const effectiveSalience = clampCesUnit(
    belief.salience + (1 - belief.salience) * relevance * intensity,
  )

  return {
    active: relevance > 0 && effectiveSalience >= 0.25,
    effectiveSalience,
  }
}

/**
 * OPEN is intentionally not a hidden boolean. It remains undefined even to
 * developer-facing consumers unless the ontology itself is changed explicitly.
 */
export function resolveCesQuestion<T>(question: CesQuestion<T>): T | undefined {
  if (question.ontology === 'open') return undefined
  return question.value
}

export type CesReceptionRelation =
  | 'interprets'
  | 'transmits'
  | 'endorses'
  | 'rejects'
  | 'remembers_as'
  | 'attributes_to'
  | 'revises'

export interface CesReceptionNode {
  id: string
  role: CesSemanticRole
  label: string
  sourceRef?: string
  createdTick?: number
}

export interface CesReceptionEdge {
  fromId: string
  toId: string
  relation: CesReceptionRelation
  confidence: number
  sourceRef: string
}

export interface CesReceptionGraph {
  nodes: CesReceptionNode[]
  edges: CesReceptionEdge[]
}

export interface CesMemoryClaim {
  id: string
  text: string
  attributedSourceId?: string
  provenanceSourceId?: string
  confidence: number
}

export function validateCesReceptionGraph(graph: CesReceptionGraph): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const node of graph.nodes) {
    if (ids.has(node.id)) errors.push(`duplicate node id: ${node.id}`)
    ids.add(node.id)
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.fromId)) errors.push(`missing from node: ${edge.fromId}`)
    if (!ids.has(edge.toId)) errors.push(`missing to node: ${edge.toId}`)
    if (!edge.sourceRef.trim()) errors.push(`missing provenance: ${edge.fromId}->${edge.toId}`)
  }
  return errors
}

export function classifyCesMemoryClaim(
  claim: CesMemoryClaim,
): 'unattributed' | 'aligned' | 'contested_attribution' {
  if (!claim.attributedSourceId || !claim.provenanceSourceId) return 'unattributed'
  return claim.attributedSourceId === claim.provenanceSourceId
    ? 'aligned'
    : 'contested_attribution'
}

export type CesInstitutionKind =
  | 'resonance_centre'
  | 'church'
  | 'mosque'
  | 'synagogue'
  | 'temple'
  | 'meditation_centre'
  | 'secular_association'
  | 'philosophical_society'
  | 'other'

export interface CesInstitution {
  id: string
  kind: CesInstitutionKind
  name: string
  locationId?: string
  traditionTags: string[]
  activityTags: string[]
  pluralUse: boolean
}

export interface CesCommunity {
  id: string
  name: string
  memberActorIds: string[]
  institutionIds: string[]
  traditionTags: string[]
}

export interface CesControversyPosition {
  id: string
  label: string
  sourceRef: string
  institutionIds?: string[]
  communityIds?: string[]
}

export interface CesControversy {
  id: string
  subjectRef: string
  positionIds: string[]
  salience: number
  openedByEventRef: string
  resolvedByEventRef?: string
}

export function validateCesInstitution(institution: CesInstitution): string[] {
  const errors: string[] = []
  if (!institution.id.trim()) errors.push('institution id required')
  if (!institution.name.trim()) errors.push('institution name required')
  if (institution.kind === 'resonance_centre' && !institution.pluralUse) {
    errors.push('resonance centre must default to plural use')
  }
  return errors
}

export function validateCesControversy(
  controversy: CesControversy,
  positions: CesControversyPosition[],
): string[] {
  const errors: string[] = []
  const ids = new Set(positions.map(position => position.id))
  if (controversy.positionIds.length < 2) errors.push('controversy requires at least two positions')
  for (const id of controversy.positionIds) {
    if (!ids.has(id)) errors.push(`missing controversy position: ${id}`)
  }
  if (!controversy.openedByEventRef.trim()) errors.push('controversy requires opening event provenance')
  return errors
}

export function normalizeCesControversy(controversy: CesControversy): CesControversy {
  return { ...controversy, salience: clampCesUnit(controversy.salience) }
}
