import type { KnowledgeProgress } from '../../knowledge/types'
import { getResearchCapabilityRequirement } from '../../knowledge/researchCapability'
import {
  createMagnetobiologyExperiment,
  type MagnetobiologyExperimentInput,
  type Hypothesis,
  type ExperimentPlan,
} from './runtime'

export type MagnetobiologyResearchRequest = MagnetobiologyExperimentInput & {
  actorId: string
}

export type MagnetobiologyResearchCommandResult =
  | { ok: true; hypothesis: Hypothesis; experiment: ExperimentPlan }
  | {
      ok: false
      code: 'KNOWLEDGE_REQUIRED'
      requiredUnlock: string
      learningUrl: string
    }

export function planMagnetobiologyResearch(
  request: MagnetobiologyResearchRequest,
  knowledge: KnowledgeProgress,
): MagnetobiologyResearchCommandResult {
  const gate = getResearchCapabilityRequirement(
    'ACT:NOX:RESEARCH:MAGNETOBIOLOGY-EXPERIMENT-DESIGN',
    knowledge,
  )

  if (!gate.ok) {
    return {
      ok: false,
      code: 'KNOWLEDGE_REQUIRED',
      requiredUnlock: gate.requiredUnlock,
      learningUrl: gate.learningUrl,
    }
  }

  const research = createMagnetobiologyExperiment(request)
  return { ok: true, ...research }
}
