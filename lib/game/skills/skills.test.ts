import {
  DECAY_FLOOR_SHARE, DECAY_GRACE_TICKS, GUIDE_MIN_LEVEL, TICKS_PER_GAME_DAY,
  applyDecay, canGuide, decayedLevel, emptySkill, experienceForLevel, gainExperience,
  languageSkillCode, levelFromExperience, practiceBlock, practiceSuccessChance, resolvePractice,
  type PracticeRecipe,
} from './skills'

let failures = 0
function check(ok: boolean, label: string) { if (!ok) { failures++; console.error('FAIL', label) } }
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

check(levelFromExperience(0) === 0 && levelFromExperience(-5) === 0, 'no experience, no level')
check(levelFromExperience(100) > 0.63 && levelFromExperience(100) < 0.64, 'xp scale reaches 1 − 1/e')
check(near(levelFromExperience(experienceForLevel(0.42)), 0.42), 'experience and level are inverse')

// Abnehmender Zuwachs
let s = emptySkill('cooking')
const first = gainExperience(s, 20, 0)
const late = gainExperience(gainExperience(s, 300, 0), 20, 1)
check(first.level - s.level > late.level - gainExperience(s, 300, 0).level, 'the same practice teaches a beginner more than an expert')
check(first.lastPracticedTick === 0 && first.peakLevel === first.level, 'gain marks practice and peak')

// Verblassen
s = gainExperience(emptySkill('repair'), 200, 0)
check(decayedLevel(s, DECAY_GRACE_TICKS) === s.level, 'nothing fades within the grace period')
const afterYear = decayedLevel(s, DECAY_GRACE_TICKS + 365 * TICKS_PER_GAME_DAY)
check(afterYear < s.level && afterYear > s.peakLevel * DECAY_FLOOR_SHARE, 'a year without practice fades but stays above the floor')
const afterDecade = decayedLevel(s, DECAY_GRACE_TICKS + 3650 * TICKS_PER_GAME_DAY)
check(afterDecade >= s.peakLevel * DECAY_FLOOR_SHARE - 1e-9, 'never below half of the best level')
check(decayedLevel(emptySkill('x'), 99999) === 0, 'an unpractised empty skill stays at zero')
const resumed = gainExperience(s, 10, DECAY_GRACE_TICKS + 365 * TICKS_PER_GAME_DAY)
check(resumed.level < s.level + 0.01 && resumed.peakLevel === s.peakLevel, 'practice after a pause starts from the faded level, peak kept')
check(applyDecay(s, 0) === s, 'decay without time returns the same object')

// Anleiten
const expert = gainExperience(emptySkill('cooking'), experienceForLevel(GUIDE_MIN_LEVEL) + 1, 0)
check(canGuide(expert, 0) && !canGuide(first, 0) && !canGuide(null, 0), 'only someone competent may guide')
check(!canGuide(expert, DECAY_GRACE_TICKS + 3650 * TICKS_PER_GAME_DAY), 'a faded expert no longer guides')

// Übungen
const soup: PracticeRecipe = { code: 'soup', skillCode: 'cooking', difficulty: 0.3, experience: 10, durationGameMinutes: 45, minLevel: 0, requiresGuide: true }
check(practiceBlock(0, soup, false) === 'needs-guide' && practiceBlock(0, soup, true) === null, 'kitchen practice needs a guide')
check(practiceBlock(0.1, { ...soup, minLevel: 0.3 }, true) === 'below-min-level', 'minimum level is enforced')
check(practiceSuccessChance(0, soup, true) > practiceSuccessChance(0, soup, false), 'guidance helps')
check(practiceSuccessChance(0.9, soup, false) > practiceSuccessChance(0.1, soup, false), 'competence helps')
const ok = resolvePractice(emptySkill('cooking'), soup, true, 0, 5)
const burnt = resolvePractice(emptySkill('cooking'), soup, true, 0.999, 5)
check(ok.succeeded && !burnt.succeeded, 'roll decides the outcome')
check(burnt.learner.experience > 0 && burnt.learner.experience < ok.learner.experience, 'failure still teaches, but less')
check(ok.guideExperience > 0 && resolvePractice(emptySkill('cooking'), soup, false, 0, 5).guideExperience === 0, 'the guide learns too, only when guiding')

check(languageSkillCode('EN') === 'language_en', 'language family code')
let threw = false; try { languageSkillCode('eng') } catch { threw = true }
check(threw, 'invalid language code is rejected')

if (failures) { console.error(`${failures} skill checks failed`); process.exit(1) }
console.log('skills: all checks passed')
