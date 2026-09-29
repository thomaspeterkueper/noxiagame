import { getResearchCapabilityRequirement } from './researchCapability';
import type { KnowledgeProgress } from './types';

const capability = 'ACT:NOX:RESEARCH:MAGNETOBIOLOGY-EXPERIMENT-DESIGN' as const;

const untrained: KnowledgeProgress = { completedModules: [], unlocked: [] };
const trained: KnowledgeProgress = {
  completedModules: [],
  unlocked: ['UNL:NOX:research:magnetobiology-experiment-design'],
};

const denied = getResearchCapabilityRequirement(capability, untrained);
if (denied.ok) throw new Error('untrained player must not design magnetobiology experiments');
if (denied.requiredUnlock !== 'UNL:NOX:research:magnetobiology-experiment-design') {
  throw new Error('wrong research unlock requirement');
}
if (!denied.learningUrl.includes(encodeURIComponent(denied.requiredUnlock))) {
  throw new Error('denied research action must link to its learning path lookup');
}

const allowed = getResearchCapabilityRequirement(capability, trained);
if (!allowed.ok) throw new Error('trained player should be allowed to design magnetobiology experiments');

console.log('research capability gate test passed');
