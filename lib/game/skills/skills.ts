// Kompetenzen nach NOXIA-SCHOOL-0001.
//
// Ein Modell für Personen (`person_skills`) und Spieler (`profile_skills`): gleiches
// Schema, gleiche Regeln. Erfahrung ist die Wahrheit, die Stufe (0–1) folgt aus ihr.
// Reine Funktionen ohne Datenbank – die SQL-Funktionen in der Migration
// `20261027063000_school_skills_foundation.sql` rechnen dieselben Formeln.

/** Ein Tick ist eine Spielstunde (NOXIA-TIME-0001). */
export const TICKS_PER_GAME_DAY = 24

/** Erfahrung, bei der die Stufe 1 − 1/e ≈ 0,63 erreicht. */
export const SKILL_XP_SCALE = 100

/** Ab dieser Stufe darf eine Person eine Übung anleiten. */
export const GUIDE_MIN_LEVEL = 0.7

/** Ungeübt bleibt eine Kompetenz so lange unverändert. */
export const DECAY_GRACE_TICKS = 14 * TICKS_PER_GAME_DAY

/** Anteil des Abstands zum Sockel, der je ungeübtem Spieltag verloren geht. */
export const DECAY_PER_GAME_DAY = 0.01

/** Was man einmal konnte, ist nie ganz weg: Sockel als Anteil der höchsten erreichten Stufe. */
export const DECAY_FLOOR_SHARE = 0.5

/** Anteil der Übungserfahrung, den die anleitende Person selbst bekommt. */
export const GUIDE_XP_SHARE = 0.25

/** Anteil der Erfahrung bei misslungener Übung – auch Misslingen lehrt. */
export const FAILURE_XP_SHARE = 0.4

export type SkillState = {
  skillCode: string
  experience: number
  level: number
  peakLevel: number
  lastPracticedTick: number | null
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Stufe aus Erfahrung: wächst schnell am Anfang, langsam gegen Meisterschaft. */
export function levelFromExperience(experience: number): number {
  if (!(experience > 0)) return 0
  return clamp01(1 - Math.exp(-experience / SKILL_XP_SCALE))
}

/** Umkehrung für das Verblassen: welche Erfahrung gehört zu einer Stufe. */
export function experienceForLevel(level: number): number {
  const l = clamp01(level)
  if (l <= 0) return 0
  if (l >= 0.9999) return SKILL_XP_SCALE * 9.21 // wie in SQL: Meisterschaft gedeckelt
  return -SKILL_XP_SCALE * Math.log(1 - l)
}

export function emptySkill(skillCode: string): SkillState {
  return { skillCode, experience: 0, level: 0, peakLevel: 0, lastPracticedTick: null }
}

/** Stufe nach Verblassen zum Zeitpunkt `tick` – ohne den gespeicherten Zustand zu ändern. */
export function decayedLevel(skill: SkillState, tick: number): number {
  if (skill.lastPracticedTick == null) return skill.level
  const idle = tick - skill.lastPracticedTick - DECAY_GRACE_TICKS
  if (idle <= 0) return skill.level
  const floor = skill.peakLevel * DECAY_FLOOR_SHARE
  if (skill.level <= floor) return skill.level
  const days = idle / TICKS_PER_GAME_DAY
  return floor + (skill.level - floor) * Math.pow(1 - DECAY_PER_GAME_DAY, days)
}

/** Verblassen anwenden (vor jedem Gewinn, damit Üben nach langer Pause beim echten Stand ansetzt). */
export function applyDecay(skill: SkillState, tick: number): SkillState {
  const level = decayedLevel(skill, tick)
  if (level === skill.level) return skill
  return { ...skill, level, experience: experienceForLevel(level) }
}

/** Erfahrung gutschreiben. Abnehmender Zuwachs entsteht aus der Kurve, nicht aus Sonderregeln. */
export function gainExperience(skill: SkillState, amount: number, tick: number): SkillState {
  const base = applyDecay(skill, tick)
  const experience = base.experience + Math.max(0, amount)
  const level = levelFromExperience(experience)
  return { skillCode: skill.skillCode, experience, level, peakLevel: Math.max(base.peakLevel, level), lastPracticedTick: tick }
}

export function canGuide(skill: SkillState | null | undefined, tick: number): boolean {
  return !!skill && decayedLevel(skill, tick) >= GUIDE_MIN_LEVEL
}

export type PracticeRecipe = {
  code: string
  skillCode: string
  /** 0 (leicht) bis 1 (schwer). */
  difficulty: number
  /** Erfahrung bei Gelingen. */
  experience: number
  durationGameMinutes: number
  minLevel: number
  /** Braucht Lehrkraft oder kompetente anleitende Person (Werkraum, Küche). */
  requiresGuide: boolean
}

/** Wahrscheinlichkeit, dass eine Übung gelingt. */
export function practiceSuccessChance(level: number, recipe: PracticeRecipe, guided: boolean): number {
  return clamp01(0.35 + 0.6 * level + (guided ? 0.2 : 0) - 0.5 * clamp01(recipe.difficulty))
}

export type PracticeBlock = 'below-min-level' | 'needs-guide' | null

export function practiceBlock(level: number, recipe: PracticeRecipe, guided: boolean): PracticeBlock {
  if (level < recipe.minLevel) return 'below-min-level'
  if (recipe.requiresGuide && !guided) return 'needs-guide'
  return null
}

export type PracticeOutcome = {
  succeeded: boolean
  learner: SkillState
  /** Erfahrung für die anleitende Person auf dieselbe Kompetenz, sonst 0. */
  guideExperience: number
}

/**
 * Ausgang einer Übung. `roll` (0–1) kommt von außen – deterministisch im Forschungslauf,
 * zufällig im Live-Betrieb. Material ist in beiden Fällen verbraucht; das regelt der Aufrufer.
 */
export function resolvePractice(learner: SkillState, recipe: PracticeRecipe, guided: boolean, roll: number, tick: number): PracticeOutcome {
  const level = decayedLevel(learner, tick)
  const succeeded = roll < practiceSuccessChance(level, recipe, guided)
  const xp = recipe.experience * (succeeded ? 1 : FAILURE_XP_SHARE)
  return {
    succeeded,
    learner: gainExperience(learner, xp, tick),
    guideExperience: guided ? recipe.experience * GUIDE_XP_SHARE : 0,
  }
}

/** Startvokabular aus NOXIA-SCHOOL-0001. Bestehende Codes (`medicine`, `triage`, …) bleiben gültig. */
export const SCHOOL_SKILL_CODES = [
  'literacy', 'numeracy',
  'craft_wood', 'craft_metal', 'craft_electric', 'repair',
  'cooking', 'gardening', 'household_finance', 'first_aid',
] as const

/** Sprachen als Familie `language_<iso639-1>`. */
export function languageSkillCode(iso: string): string {
  const code = iso.trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(code)) throw new Error(`invalid language code: ${iso}`)
  return `language_${code}`
}
