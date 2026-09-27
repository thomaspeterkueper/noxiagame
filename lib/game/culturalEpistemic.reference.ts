import {
  BeliefState,
  CesCommunity,
  CesControversy,
  CesControversyPosition,
  CesInstitution,
  CesMemoryClaim,
  evaluateCesActivation,
  classifyCesMemoryClaim,
  validateCesControversy,
  validateCesInstitution,
} from './culturalEpistemic'

export interface CesReferenceActor {
  id: string
  label: string
  belief: BeliefState
  traditionTags: string[]
  interpretationTags: string[]
}

export const CES_REFERENCE_CENTRE: CesInstitution = {
  id: 'ces-ref-resonance-centre',
  kind: 'resonance_centre',
  name: 'CES Reference Resonance Centre',
  traditionTags: [],
  activityTags: ['dialogue', 'archive', 'meditation', 'public_debate'],
  pluralUse: true,
}

export const CES_REFERENCE_ACTORS: CesReferenceActor[] = [
  {
    id: 'ces-ref-archivist',
    label: 'Archivist',
    belief: { commitment: 0.45, socialBinding: 0.3, revisability: 0.9, salience: 0.35 },
    traditionTags: ['secular'],
    interpretationTags: ['provenance_first'],
  },
  {
    id: 'ces-ref-omnizedenz',
    label: 'Omnizedenz participant',
    belief: { commitment: 0.78, socialBinding: 0.65, revisability: 0.55, salience: 0.5 },
    traditionTags: ['omnizedenz'],
    interpretationTags: ['resonance_ethics'],
  },
  {
    id: 'ces-ref-religious',
    label: 'Religious participant',
    belief: { commitment: 0.82, socialBinding: 0.72, revisability: 0.42, salience: 0.45 },
    traditionTags: ['religious'],
    interpretationTags: ['compatible_reading'],
  },
  {
    id: 'ces-ref-sceptic',
    label: 'Sceptical participant',
    belief: { commitment: 0.62, socialBinding: 0.2, revisability: 0.72, salience: 0.25 },
    traditionTags: ['secular'],
    interpretationTags: ['anti_metaphysical'],
  },
]

export const CES_REFERENCE_COMMUNITY: CesCommunity = {
  id: 'ces-ref-community',
  name: 'CES Reference Dialogue Community',
  memberActorIds: CES_REFERENCE_ACTORS.map(actor => actor.id),
  institutionIds: [CES_REFERENCE_CENTRE.id],
  traditionTags: ['plural'],
}

export const CES_REFERENCE_POSITIONS: CesControversyPosition[] = [
  {
    id: 'archive-correction',
    label: 'Correct the public attribution and foreground archival provenance',
    sourceRef: 'record:archive-review',
    communityIds: [CES_REFERENCE_COMMUNITY.id],
  },
  {
    id: 'received-meaning',
    label: 'Preserve the received formulation while documenting its later provenance',
    sourceRef: 'record:community-hearing',
    communityIds: [CES_REFERENCE_COMMUNITY.id],
  },
]

export const CES_REFERENCE_CONTROVERSY: CesControversy = {
  id: 'ces-ref-misattributed-quotation',
  subjectRef: 'claim:received-quotation',
  positionIds: CES_REFERENCE_POSITIONS.map(position => position.id),
  salience: 0.65,
  openedByEventRef: 'event:archive-discovery',
}

export const CES_REFERENCE_MEMORY_CLAIM: CesMemoryClaim = {
  id: 'received-quotation',
  text: 'Reference-only later formulation',
  attributedSourceId: 'source:early-text',
  provenanceSourceId: 'source:later-pamphlet',
  confidence: 0.85,
}

export function runCesReferenceScenario() {
  const relevance = 0.9
  return {
    institutionErrors: validateCesInstitution(CES_REFERENCE_CENTRE),
    controversyErrors: validateCesControversy(
      CES_REFERENCE_CONTROVERSY,
      CES_REFERENCE_POSITIONS,
    ),
    memoryClassification: classifyCesMemoryClaim(CES_REFERENCE_MEMORY_CLAIM),
    actorActivations: CES_REFERENCE_ACTORS.map(actor => ({
      actorId: actor.id,
      ...evaluateCesActivation({
        belief: actor.belief,
        relevance,
        intensity: 0.75,
      }),
    })),
  }
}
