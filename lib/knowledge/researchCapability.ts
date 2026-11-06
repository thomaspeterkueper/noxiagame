// researchCapability.ts
// Knowledge gates for research actions. Learning authorizes an attempt; it never asserts a finding.

import type { KnowledgeProgress, UnlockId } from './types';
import { getUnlockLabel } from './unlockRegistry';

export type ResearchCapabilityId =
  | 'ACT:NOX:RESEARCH:MAGNETOBIOLOGY-EXPERIMENT-DESIGN'
  | 'ACT:NOX:RESEARCH:GOLD-TRANSMUTATION-DESIGN'
  | 'ACT:NOX:RESEARCH:OPTOMECHANICS-EXPERIMENT-DESIGN';

const REQUIRED_UNLOCK: Record<ResearchCapabilityId, UnlockId> = {
  'ACT:NOX:RESEARCH:MAGNETOBIOLOGY-EXPERIMENT-DESIGN':
    'UNL:NOX:research:magnetobiology-experiment-design',
  'ACT:NOX:RESEARCH:GOLD-TRANSMUTATION-DESIGN':
    'UNL:NOX:research:gold-transmutation-design',
  'ACT:NOX:RESEARCH:OPTOMECHANICS-EXPERIMENT-DESIGN':
    'UNL:NOX:research:optomechanics-experiment-design',
};

export type ResearchCapabilityCheck = {
  capabilityId: ResearchCapabilityId;
  ok: boolean;
  requiredUnlock: UnlockId;
  requiredLabel: string;
  learningUrl: string;
};

export function getResearchCapabilityRequirement(
  capabilityId: ResearchCapabilityId,
  progress: KnowledgeProgress,
): ResearchCapabilityCheck {
  const requiredUnlock = REQUIRED_UNLOCK[capabilityId];
  return {
    capabilityId,
    ok: progress.unlocked.includes(requiredUnlock),
    requiredUnlock,
    requiredLabel: getUnlockLabel(requiredUnlock),
    learningUrl: `/academy/learn?unlock=${encodeURIComponent(requiredUnlock)}`,
  };
}
