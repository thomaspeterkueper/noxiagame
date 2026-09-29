import { planMagnetobiologyResearch } from './magnetobiologyResearch'
import type { KnowledgeProgress } from '../../knowledge/types'

let failures = 0
const check = (ok:boolean,label:string) => { if(!ok){ failures++; console.error('FAIL: '+label) } }

const request = {
  actorId: 'researcher-1',
  subjectRef: 'station-a:bio-lab-1',
  groupId: 'magbio-team-a',
  organismContext: 'model-organism:controlled-line-a',
  baselineMicrotesla: 45,
  exposureMicrotesla: 0.005,
  durationTicks: 48,
  measurements: ['mitochondrial_respiration','superoxide_proxy'],
  evidenceRefs: ['OTA-SCI-0096-2026-DE'],
}

const untrained: KnowledgeProgress = { completedModules: [], unlocked: [] }
const denied = planMagnetobiologyResearch(request, untrained)
check(!denied.ok && denied.code === 'KNOWLEDGE_REQUIRED', 'untrained researcher cannot create ExperimentPlan')

const trained: KnowledgeProgress = { completedModules: [], unlocked: ['UNL:NOX:research:magnetobiology-experiment-design'] }
const allowed = planMagnetobiologyResearch(request, trained)
check(allowed.ok && allowed.experiment.status === 'planned', 'trained researcher can create ExperimentPlan')
if (allowed.ok) {
  check(allowed.hypothesis.evidenceFor.includes('OTA-SCI-0096-2026-DE'), 'experiment preserves OTA evidence provenance')
  check(allowed.experiment.measurements.includes('superoxide_proxy'), 'experiment preserves declared measurements')
}

if(failures) throw new Error(String(failures)+' magnetobiology research command test(s) failed')
console.log('Magnetobiology research command: tests passed')
