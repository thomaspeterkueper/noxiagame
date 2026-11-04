import type { LanguageProfile } from './languageSystem'

type SupabaseLike = any

const unit = (value: unknown, fallback: number) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback
}

export interface PersistedLanguageRow {
  language_code: string
  proficiency: number
  is_native: boolean
  comprehension?: number | null
  production?: number | null
  grammar?: number | null
  vocabulary?: number | null
  pragmatic_skill?: number | null
  phoneme_discrimination?: number | null
}

export interface LanguageRuntimeContext {
  profile: LanguageProfile | null
  originalLanguageCode: string | null
  translatedForPlayer: boolean
}

function competence(row: PersistedLanguageRow) {
  const base = unit(row.proficiency, 0)
  return {
    languageCode: String(row.language_code),
    phonemeDiscrimination: unit(row.phoneme_discrimination, base),
    comprehension: unit(row.comprehension, base),
    production: unit(row.production, base),
    grammar: unit(row.grammar, base),
    vocabulary: unit(row.vocabulary, base),
    pragmaticSkill: unit(row.pragmatic_skill, base),
  }
}

export function languageProfileFromRows(personId: string, rows: PersistedLanguageRow[]): LanguageProfile | null {
  const valid = rows
    .filter(row => typeof row.language_code === 'string' && row.language_code.trim())
    .map(row => ({ row, competence: competence(row) }))
    .sort((a, b) =>
      Number(b.row.is_native) - Number(a.row.is_native)
        || b.competence.production - a.competence.production
        || a.competence.languageCode.localeCompare(b.competence.languageCode),
    )
  if (!valid.length) return null
  return {
    personId,
    primaryLanguageCode: valid[0].competence.languageCode,
    languages: valid.map(entry => entry.competence),
  }
}

/**
 * Runtime-safe loader. Deployments remain functional before the migration is
 * applied; missing-table errors mean "no explicit language data yet", never
 * "guess a language from identity".
 */
export async function loadPersonLanguageProfile(
  supabase: SupabaseLike,
  personId: string,
): Promise<LanguageProfile | null> {
  const { data, error } = await supabase
    .from('person_languages')
    .select('language_code, proficiency, is_native, comprehension, production, grammar, vocabulary, pragmatic_skill, phoneme_discrimination')
    .eq('person_id', personId)

  if (error) {
    const missingTable = error.code === '42P01' || error.code === 'PGRST205'
    if (missingTable) return null
    throw error
  }
  return languageProfileFromRows(personId, (data ?? []) as PersistedLanguageRow[])
}

export function selectConversationLanguage(
  profile: LanguageProfile | null,
  playerLanguageCode = 'de',
): LanguageRuntimeContext {
  if (!profile?.languages.length) {
    return { profile: null, originalLanguageCode: null, translatedForPlayer: false }
  }
  const primary = profile.primaryLanguageCode ?? profile.languages[0].languageCode
  return {
    profile,
    originalLanguageCode: primary,
    translatedForPlayer: primary !== playerLanguageCode,
  }
}
