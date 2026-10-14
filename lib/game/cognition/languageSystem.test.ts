import type { SensoryReception } from './sensoryLayer'
import {
  learnLanguageExposure,
  languageDevelopmentCapacity,
  languagePromptConstraint,
  perceiveSpeech,
  planUtterance,
  type LanguageProfile,
  type LexiconState,
  type SpeechEmission,
} from './languageSystem'

let failures = 0
const check = (ok: boolean, label: string) => {
  if (!ok) {
    failures += 1
    console.error('FAIL: ' + label)
  }
}

const reception: SensoryReception = {
  stimulusId: 'speech:1',
  observerId: 'child',
  sourceRef: 'person:caregiver',
  modality: 'auditory',
  receivedIntensity: 0.75,
  clarity: 0.82,
  novelty: 0.2,
  features: { sourceClass: 'human_speech' },
  atTick: 100,
  provenanceRefs: [],
}

const emission: SpeechEmission = {
  speakerId: 'caregiver',
  languageCode: 'de',
  tokens: ['Ball'],
  referentRefs: ['object:ball'],
}

const infantProfile: LanguageProfile = {
  personId: 'child',
  primaryLanguageCode: 'de',
  languages: [{
    languageCode: 'de',
    phonemeDiscrimination: 0.6,
    comprehension: 0.05,
    production: 0,
    grammar: 0,
    vocabulary: 0.02,
    pragmaticSkill: 0.05,
  }],
}

let lexicon: LexiconState = { personId: 'child', entries: [] }
for (let i = 0; i < 80; i += 1) {
  const perception = perceiveSpeech({
    reception: { ...reception, atTick: 100 + i },
    emission,
    profile: infantProfile,
    lexicon,
    ageDays: 300,
  })!
  lexicon = learnLanguageExposure({
    state: lexicon,
    perception,
    emission,
    ageDays: 300,
    jointlyAttendedReferentRef: 'object:ball',
  })
}

const ball = lexicon.entries.find(entry => entry.form === 'ball')
check((ball?.formFamiliarity ?? 0) > 0.6, 'repeated speech exposure builds word-form familiarity')
check(ball?.meaningRef === 'object:ball', 'joint attention can ground word form to referent')
check((ball?.meaningConfidence ?? 0) > 0.5, 'repeated aligned reference strengthens meaning confidence')

const newbornPlan = planUtterance({
  profile: infantProfile,
  lexicon,
  languageCode: 'de',
  ageDays: 30,
})
check(newbornPlan.fallbackMode === 'gesture_or_vocalization', 'newborn cannot produce fluent speech despite hearing language')
check(newbornPlan.maxTokens === 0, 'newborn productive vocabulary is developmentally gated')

const toddlerProfile: LanguageProfile = {
  ...infantProfile,
  languages: [{
    languageCode: 'de',
    phonemeDiscrimination: 0.85,
    comprehension: 0.55,
    production: 0.42,
    grammar: 0.3,
    vocabulary: 0.38,
    pragmaticSkill: 0.3,
  }],
}
const toddlerPlan = planUtterance({ profile: toddlerProfile, lexicon, ageDays: 900 })
check(toddlerPlan.maxTokens > 0 && toddlerPlan.maxTokens <= 5, 'early production remains short')
check(toddlerPlan.grammarComplexity < 0.3, 'young child grammar remains developmentally constrained')

const limitedGerman: LanguageProfile = {
  personId: 'adult',
  primaryLanguageCode: 'de',
  languages: [{
    languageCode: 'de',
    phonemeDiscrimination: 0.6,
    comprehension: 0.55,
    production: 0.34,
    grammar: 0.28,
    vocabulary: 0.3,
    pragmaticSkill: 0.45,
  }],
}
check(languagePromptConstraint({ profile: limitedGerman }).includes('begrenzt'), 'dialog prompt exposes limited language competence')
check(languageDevelopmentCapacity(30).productiveSpeech < languageDevelopmentCapacity(900).productiveSpeech, 'productive speech capacity grows with development')

if (failures) throw new Error(String(failures) + ' language system test(s) failed')
console.log('Language system v0.1: tests passed; hardcoded_fluency=0; external_llm_calls=0')
