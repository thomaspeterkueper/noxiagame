import type { SensoryReception } from './sensoryLayer'
import {
  learnLanguageExposure,
  perceiveSpeech,
  planUtterance,
  type LanguageProfile,
  type LexiconState,
  type SpeechEmission,
  type UtterancePlan,
} from './languageSystem'

export interface LanguageDevelopmentSnapshot {
  ageDays: number
  heardCount: number
  formFamiliarity: number
  meaningConfidence: number
  utterancePlan: UtterancePlan
}

export interface EarlyLanguageSimulationResult {
  snapshots: LanguageDevelopmentSnapshot[]
  lexicon: LexiconState
}

const childId = 'child:language-sim'
const caregiverId = 'caregiver'

function competenceAtAge(ageDays: number): LanguageProfile {
  const years = ageDays / 365
  const ramp = (start:number, full:number) =>
    years <= start ? 0 : years >= full ? 1 : Math.max(0, Math.min(1, (years - start) / (full - start)))
  return {
    personId: childId,
    primaryLanguageCode: 'de',
    languages: [{
      languageCode: 'de',
      phonemeDiscrimination: Math.min(1, 0.45 + ramp(0, 1.2) * 0.5),
      comprehension: Math.min(1, ramp(0.45, 5) * 0.82),
      production: Math.min(1, ramp(0.75, 6) * 0.82),
      grammar: Math.min(1, ramp(1.2, 9) * 0.86),
      vocabulary: Math.min(1, ramp(0.7, 7) * 0.9),
      pragmaticSkill: Math.min(1, ramp(1.2, 10) * 0.85),
    }],
  }
}

function heardSpeech(ageDays:number):SensoryReception {
  return {
    stimulusId: 'caregiver:ball:' + ageDays,
    observerId: childId,
    sourceRef: 'person:' + caregiverId,
    modality: 'auditory',
    receivedIntensity: 0.72,
    clarity: 0.82,
    novelty: 0.12,
    features: { sourceClass: 'human_speech' },
    atTick: ageDays * 24,
    provenanceRefs: ['shared-attention:ball'],
  }
}

const emission: SpeechEmission = {
  speakerId: caregiverId,
  languageCode: 'de',
  tokens: ['Ball'],
  intentRef: 'name_object',
  referentRefs: ['object:ball'],
}

export function simulateEarlyLanguage(endAgeDays = 3 * 365): EarlyLanguageSimulationResult {
  const end = Math.max(1, Math.floor(endAgeDays))
  let lexicon: LexiconState = { personId: childId, entries: [] }
  const snapshots: LanguageDevelopmentSnapshot[] = []
  const checkpoints = new Set([30, 180, 270, 365, 540, 730, 1095, end].filter(day => day <= end))

  for (let ageDays = 1; ageDays <= end; ageDays += 1) {
    // Repeated naming during shared attention. Before joint-attention capacity
    // develops this mostly strengthens the auditory form, not its semantics.
    const repetitions = ageDays < 120 ? 1 : 2
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const profile = competenceAtAge(ageDays)
      const perception = perceiveSpeech({
        reception: heardSpeech(ageDays),
        emission,
        profile,
        lexicon,
        ageDays,
      })
      if (!perception) continue
      lexicon = learnLanguageExposure({
        state: lexicon,
        perception,
        emission,
        ageDays,
        jointlyAttendedReferentRef: ageDays >= 210 ? 'object:ball' : null,
      })
    }

    if (checkpoints.has(ageDays)) {
      const profile = competenceAtAge(ageDays)
      const entry = lexicon.entries.find(value => value.languageCode === 'de' && value.form === 'ball')
      snapshots.push({
        ageDays,
        heardCount: entry?.heardCount ?? 0,
        formFamiliarity: entry?.formFamiliarity ?? 0,
        meaningConfidence: entry?.meaningConfidence ?? 0,
        utterancePlan: planUtterance({ profile, lexicon, ageDays }),
      })
    }
  }

  return { snapshots, lexicon }
}
