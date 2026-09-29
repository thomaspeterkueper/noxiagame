// researchCapability.ts
// Knowledge gates for research actions. Learning authorizes an attempt; it never asserts a finding.

import type { KnowledgeProgress, UnlockId } from './types';
import { getUnlockLabel } from './unlockRegistry';

export type ResearchCapabilityId =
  | 'ACT:NOX:RESEARCH:MAGNETOBIOLOGY-EXPERIMENT-DESIGN';

const REQUIRED_UNLOCK: Record<ResearchCapabilityId, UnlockId> = {
  'ACT:NOX:RESEARCH:MAGNETOBIOLOGY-EXPERIMENT-DESIGN':
    'UNL:NOX:research:magnetobiology-experiment-design',
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
