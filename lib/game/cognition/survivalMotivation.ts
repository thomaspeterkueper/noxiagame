/** NOXIA NPC survival motivation: pure utility component, not a hard override. */
export interface SurvivalContext {
  hunger: number; thirst: number; fatigue: number; injury: number
  perceivedDanger: number; actualDanger?: number
  dependentsAtRisk: number; courage: number; care: number
}
export type SurvivalAction = 'seek_food' | 'seek_water' | 'rest' | 'seek_safety' | 'help_others' | 'continue_goal'
export interface SurvivalPreference { action: SurvivalAction; utility: number; reason: string }
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1,n)) : 0
/** Inputs normalized to 0..1. Only perceived risk affects decisions; actualDanger is for test/observer diagnostics. */
export function survivalPreferences(c: SurvivalContext): SurvivalPreference[] {
  const hunger=clamp(c.hunger), thirst=clamp(c.thirst), fatigue=clamp(c.fatigue)
  const injury=clamp(c.injury), danger=clamp(c.perceivedDanger)
  const courage=clamp(c.courage), care=clamp(c.care), dependents=clamp(c.dependentsAtRisk)
  return [
    { action:'seek_water', utility:clamp(thirst * 0.95), reason:'thirst' },
    { action:'seek_food', utility:clamp(hunger * 0.83), reason:'hunger' },
    { action:'rest', utility:clamp(fatigue * 0.68 + injury * 0.23), reason:'recovery' },
    { action:'seek_safety', utility:clamp(danger * (0.95 - courage * 0.34) + injury * 0.15), reason:'perceived danger' },
    { action:'help_others', utility:clamp(dependents * care * (0.45 + courage * 0.45)), reason:'care and attachment' },
    { action:'continue_goal', utility:clamp(0.40 * (1 - danger * 0.6) * (1 - Math.max(thirst,hunger) * 0.4)), reason:'autonomy and ongoing goals' },
  ].sort((a,b)=>b.utility-a.utility || a.action.localeCompare(b.action))
}
