import type { SensoryReception } from './sensoryLayer'

export interface LanguageCompetence {
  languageCode: string
  phonemeDiscrimination: number
  comprehension: number
  production: number
  grammar: number
  vocabulary: number
  pragmaticSkill: number
}

export interface LanguageProfile {
  personId: string
  languages: LanguageCompetence[]
  primaryLanguageCode: string | null
}

export interface LexiconEntry {
  languageCode: string
  form: string
  meaningRef: string | null
  formFamiliarity: number
  meaningConfidence: number
  heardCount: number
  producedCount: number
  lastTick: number
}

export interface LexiconState {
  personId: string
  entries: LexiconEntry[]
}

export interface SpeechEmission {
  speakerId: string
  languageCode: string
  tokens: string[]
  intentRef?: string | null
  referentRefs?: string[]
}

export interface SpeechPerception {
  speakerRef: string
  languageCode: string
  heardForms: string[]
  recognizedForms: string[]
  comprehension: number
  atTick: number
}

export interface UtterancePlan {
  languageCode: string
  allowedForms: string[]
  maxTokens: number
  grammarComplexity: number
  productionConfidence: number
  fallbackMode: 'speech' | 'fragment' | 'gesture_or_vocalization'
}

const unit = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback

const normalizeForm = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

export function emptyLanguageProfile(personId: string): LanguageProfile {
  return { personId, languages: [], primaryLanguageCode: null }
}

export function competenceFor(profile: LanguageProfile, languageCode: string): LanguageCompetence | null {
  return profile.languages.find(language => language.languageCode === languageCode) ?? null
}

/**
 * Development policy for language acquisition. This is deliberately smooth and
 * approximate, not a claim of universal developmental milestones.
 */
export function languageDevelopmentCapacity(ageDays: number) {
  const years = Math.max(0, ageDays) / 365
  const ramp = (start: number, full: number) =>
    years <= start ? 0 : years >= full ? 1 : unit((years - start) / (full - start))

  return {
    phonemeLearning: unit(0.35 + ramp(0, 1.2) * 0.65),
    wordSegmentation: ramp(0.25, 1.8),
    referentialLearning: ramp(0.55, 3),
    productiveSpeech: ramp(0.75, 4),
    grammarLearning: ramp(1.2, 8),
    pragmaticLearning: ramp(1.5, 10),
  }
}

export function perceiveSpeech(input: {
  reception: SensoryReception
  emission: SpeechEmission
  profile: LanguageProfile
  lexicon: LexiconState
  ageDays: number
}): SpeechPerception | null {
  if (input.reception.modality !== 'auditory') return null
  if (input.reception.sourceRef !== 'person:' + input.emission.speakerId) return null
  if (input.reception.features.sourceClass !== 'human_speech') return null

  const development = languageDevelopmentCapacity(input.ageDays)
  const competence = competenceFor(input.profile, input.emission.languageCode)
  const phonemeSkill = unit(
    (competence?.phonemeDiscrimination ?? 0.18) * 0.55
      + development.phonemeLearning * 0.45,
  )
  const signalQuality = unit(input.reception.clarity * 0.7 + input.reception.receivedIntensity * 0.3)
  const segmentation = unit(development.wordSegmentation * 0.55 + phonemeSkill * 0.25 + signalQuality * 0.20)
  const hearLimit = Math.max(0, Math.min(input.emission.tokens.length, Math.floor(input.emission.tokens.length * (0.28 + segmentation * 0.72))))
  const heardForms = input.emission.tokens.slice(0, hearLimit).map(normalizeForm).filter(Boolean)

  const known = new Map(input.lexicon.entries
    .filter(entry => entry.languageCode === input.emission.languageCode)
    .map(entry => [normalizeForm(entry.form), entry]))
  const recognizedForms = heardForms.filter(form => (known.get(form)?.formFamiliarity ?? 0) >= 0.35)
  const knownMeaning = recognizedForms.reduce((sum, form) => sum + (known.get(form)?.meaningConfidence ?? 0), 0)
  const lexicalCoverage = heardForms.length ? knownMeaning / heardForms.length : 0
  const comprehension = unit(
    lexicalCoverage * 0.58
      + (competence?.comprehension ?? 0) * 0.25
      + development.referentialLearning * 0.17,
  )

  return {
    speakerRef: input.reception.sourceRef,
    languageCode: input.emission.languageCode,
    heardForms,
    recognizedForms,
    comprehension,
    atTick: input.reception.atTick,
  }
}

export function learnLanguageExposure(input: {
  state: LexiconState
  perception: SpeechPerception
  emission: SpeechEmission
  ageDays: number
  jointlyAttendedReferentRef?: string | null
}): LexiconState {
  const development = languageDevelopmentCapacity(input.ageDays)
  const entries = new Map(input.state.entries.map(entry => [
    entry.languageCode + '|' + normalizeForm(entry.form),
    { ...entry },
  ]))

  for (const form of input.perception.heardForms) {
    const key = input.perception.languageCode + '|' + form
    const old = entries.get(key) ?? {
      languageCode: input.perception.languageCode,
      form,
      meaningRef: null,
      formFamiliarity: 0,
      meaningConfidence: 0,
      heardCount: 0,
      producedCount: 0,
      lastTick: input.perception.atTick,
    }

    const heardCount = old.heardCount + 1
    const formGain = (1 - old.formFamiliarity) * (0.018 + development.wordSegmentation * 0.042)
    let meaningRef = old.meaningRef
    let meaningConfidence = old.meaningConfidence

    const referent = input.jointlyAttendedReferentRef ?? null
    const emittedReferents = new Set(input.emission.referentRefs ?? [])
    if (referent && emittedReferents.has(referent) && development.referentialLearning > 0) {
      if (!meaningRef || meaningRef === referent) {
        meaningRef = referent
        meaningConfidence = unit(
          meaningConfidence
            + (1 - meaningConfidence) * (0.015 + development.referentialLearning * 0.055),
        )
      } else {
        meaningConfidence = unit(meaningConfidence * 0.985)
      }
    }

    entries.set(key, {
      ...old,
      formFamiliarity: unit(old.formFamiliarity + formGain),
      meaningRef,
      meaningConfidence,
      heardCount,
      lastTick: input.perception.atTick,
    })
  }

  return {
    personId: input.state.personId,
    entries: [...entries.values()].sort((a, b) =>
      b.meaningConfidence - a.meaningConfidence
        || b.formFamiliarity - a.formFamiliarity
        || a.form.localeCompare(b.form),
    ),
  }
}

export function planUtterance(input: {
  profile: LanguageProfile
  lexicon: LexiconState
  languageCode?: string | null
  ageDays?: number
}): UtterancePlan {
  const languageCode = input.languageCode
    ?? input.profile.primaryLanguageCode
    ?? input.profile.languages[0]?.languageCode
    ?? 'und'
  const competence = competenceFor(input.profile, languageCode)
  const development = input.ageDays == null
    ? { productiveSpeech: 1, grammarLearning: 1 }
    : languageDevelopmentCapacity(input.ageDays)

  const production = unit((competence?.production ?? 0) * development.productiveSpeech)
  const grammar = unit((competence?.grammar ?? 0) * development.grammarLearning)
  const vocabulary = unit(competence?.vocabulary ?? 0)
  const allowedForms = input.lexicon.entries
    .filter(entry =>
      entry.languageCode === languageCode
      && entry.formFamiliarity >= 0.45
      && entry.meaningConfidence >= 0.3,
    )
    .sort((a, b) => b.meaningConfidence - a.meaningConfidence || b.formFamiliarity - a.formFamiliarity)
    .map(entry => entry.form)

  const maxTokens = production < 0.08 ? 0
    : production < 0.22 ? 1
      : production < 0.4 ? 3
        : Math.max(5, Math.round(5 + production * 20 + vocabulary * 12))

  return {
    languageCode,
    allowedForms,
    maxTokens,
    grammarComplexity: grammar,
    productionConfidence: production,
    fallbackMode: production < 0.08
      ? 'gesture_or_vocalization'
      : production < 0.35
        ? 'fragment'
        : 'speech',
  }
}

export function languagePromptConstraint(input: {
  profile: LanguageProfile
  lexicon?: LexiconState
  preferredLanguageCode?: string
}): string {
  const code = input.preferredLanguageCode
    ?? input.profile.primaryLanguageCode
    ?? input.profile.languages[0]?.languageCode
    ?? 'de'
  const competence = competenceFor(input.profile, code)
  if (!competence) {
    return `Sprachregel: Du beherrschst ${code} nicht verlässlich. Verstehe nur sehr einfache Äußerungen und antworte höchstens mit einzelnen vertrauten Wörtern, Gesten oder indem du Verständigungsprobleme zeigst.`
  }

  const production = unit(competence.production)
  const grammar = unit(competence.grammar)
  const vocabulary = unit(competence.vocabulary)
  const level = production >= 0.82 && grammar >= 0.78 && vocabulary >= 0.78
    ? 'fluent'
    : production >= 0.58 && grammar >= 0.5
      ? 'functional'
      : production >= 0.3
        ? 'limited'
        : 'minimal'

  const lexiconHint = input.lexicon
    ? input.lexicon.entries
        .filter(entry => entry.languageCode === code && entry.meaningConfidence >= 0.45)
        .slice(0, 24)
        .map(entry => entry.form)
    : []

  if (level === 'fluent') return `Sprachregel: Du sprichst ${code} flüssig, aber nur entsprechend deiner Biografie und deines Wissens.`
  if (level === 'functional') return `Sprachregel: Du sprichst ${code} funktional, aber nicht perfekt. Verwende eher kurze, klare Sätze und vermeide unnötig komplexe Grammatik.`
  if (level === 'limited') return `Sprachregel: Deine aktive Kompetenz in ${code} ist begrenzt. Verwende kurze Fragmente, einfache Satzmuster und gelegentliche Verständigungsprobleme. Tue nicht so, als wärst du muttersprachlich flüssig.`
  return `Sprachregel: Deine aktive Kompetenz in ${code} ist minimal. Nutze nur sehr einfache Wörter oder Fragmente${lexiconHint.length ? `; besonders verfügbar sind: ${lexiconHint.join(', ')}` : ''}. Erfinde keine flüssige Sprachfähigkeit.`
}
