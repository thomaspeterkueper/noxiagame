/** NOXIA legal policies: pure temporal and jurisdictional rules, never immutable values.
 * The Core must authenticate legislation and resolve jurisdiction before invoking.
 */
export type AgeRule = {
  id: string
  jurisdictionId: string
  effectiveFromTick: number
  effectiveUntilTick?: number
  minimumAdultAgeYears: number
}
export type PolicyResult =
  | { ok: true; ruleId: string; minimumAdultAgeYears: number; adult: boolean }
  | { ok: false; reason: 'invalid_input' | 'no_applicable_rule' | 'ambiguous_rules' }

export function evaluateAdultStatus(
  rules: readonly AgeRule[], jurisdictionId: string, atTick: number, ageYears: number,
): PolicyResult {
  if (!jurisdictionId || !Number.isSafeInteger(atTick) || atTick < 0 ||
      !Number.isFinite(ageYears) || ageYears < 0) return {ok:false,reason:'invalid_input'}
  const applicable = rules.filter(r=>r.jurisdictionId===jurisdictionId &&
    r.id && Number.isSafeInteger(r.effectiveFromTick) && r.effectiveFromTick>=0 &&
    Number.isFinite(r.minimumAdultAgeYears) && r.minimumAdultAgeYears>=0 &&
    (r.effectiveUntilTick===undefined || (Number.isSafeInteger(r.effectiveUntilTick) && r.effectiveUntilTick>=r.effectiveFromTick)) &&
    r.effectiveFromTick<=atTick && (r.effectiveUntilTick===undefined || atTick<r.effectiveUntilTick))
  if (applicable.length===0) return {ok:false,reason:'no_applicable_rule'}
  // Overlapping laws are rejected rather than silently prioritised.
  if (applicable.length!==1) return {ok:false,reason:'ambiguous_rules'}
  const rule=applicable[0]
  return {ok:true,ruleId:rule.id,minimumAdultAgeYears:rule.minimumAdultAgeYears,adult:ageYears>=rule.minimumAdultAgeYears}
}
