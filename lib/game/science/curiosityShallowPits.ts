import type { EpistemicHypothesisDefinition } from '../population/hypothesis'

export const CURIOSITY_SHALLOW_PITS_SUBJECT = {
  subjectType: 'geologic_feature',
  subjectRef: 'mars:gale:mount-sharp:sols-4988-4994:shallow-pits',
} as const

const subject = CURIOSITY_SHALLOW_PITS_SUBJECT

/**
 * Open research case based on Curiosity observations reported in September 2026.
 * These are competing working hypotheses, not ground truth.
 */
export const curiosityShallowPitHypotheses: EpistemicHypothesisDefinition[] = [
  {
    id: 'mars-shallow-pits:weathered-inclusions',
    hypothesisType: 'weathered_resistant_inclusions',
    ...subject,
    prior: 0.18,
    supporting: [
      {...subject, knowledgeType:'pit_shape_population', weight:0.7},
      {...subject, knowledgeType:'remnant_inclusion_material', weight:1},
    ],
    contradicting: [
      {...subject, knowledgeType:'no_remnant_inclusion_material', weight:0.9},
      {...subject, knowledgeType:'chemistry_matches_host_bedrock', weight:0.5},
    ],
  },
  {
    id: 'mars-shallow-pits:differential-cementation',
    hypothesisType: 'differential_cementation_and_erosion',
    ...subject,
    prior: 0.18,
    supporting: [
      {...subject, knowledgeType:'pit_rim_chemistry_contrast', weight:0.9},
      {...subject, knowledgeType:'cement_or_vein_spatial_association', weight:0.8},
      {...subject, knowledgeType:'pit_microtopography_dem', weight:0.6},
    ],
    contradicting: [
      {...subject, knowledgeType:'chemistry_matches_host_bedrock', weight:0.7},
    ],
  },
  {
    id: 'mars-shallow-pits:selective-dissolution',
    hypothesisType: 'selective_mineral_dissolution_or_removal',
    ...subject,
    prior: 0.14,
    supporting: [
      {...subject, knowledgeType:'pit_rim_chemistry_contrast', weight:0.8},
      {...subject, knowledgeType:'soluble_mineral_signature', weight:1},
      {...subject, knowledgeType:'pit_microtopography_dem', weight:0.5},
    ],
    contradicting: [
      {...subject, knowledgeType:'no_soluble_mineral_signature', weight:0.9},
    ],
  },
  {
    id: 'mars-shallow-pits:mechanical-erosion',
    hypothesisType: 'preferential_mechanical_erosion',
    ...subject,
    prior: 0.16,
    supporting: [
      {...subject, knowledgeType:'pit_orientation_distribution', weight:0.7},
      {...subject, knowledgeType:'mechanical_weakness_texture', weight:0.9},
      {...subject, knowledgeType:'pit_microtopography_dem', weight:0.5},
    ],
    contradicting: [
      {...subject, knowledgeType:'mineralogical_control_signature', weight:0.8},
    ],
  },
]

export const curiosityShallowPitObservedEvidence = [
  'broad_shallow_pits_observed',
  'approx_one_centimeter_scale',
  'no_obvious_former_objects_observed',
  'stereo_imaging_available_for_dem',
] as const
