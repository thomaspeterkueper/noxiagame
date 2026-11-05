/**
 * Experimental, deterministic derived urgency model.
 * NO gameplay state mutation or biological diagnosis.
 * Time is simulation hours, not wall-clock time.
 */
export type RhythmComponent = Readonly<{
  periodHours: number
  amplitude: number
  phaseHours: number
}>
export type NeedRhythm = Readonly<{
  baselineDeficit: number
  homeostaticRatePerHour: number
  recoveryPerHour: number
  lastUpdatedHour: number
  oscillators: readonly RhythmComponent[]
  contextImpact?: number
}>

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))

export function modelNeedUrgency(
  need: NeedRhythm,
  atHour: number,
  recoveryHours = 0,
): Readonly<{
  deficit: number
  rhythm: number
  urgency: number
}> {
  if (!Number.isFinite(atHour) || atHour < need.lastUpdatedHour) {
    throw new Error('Simulation time must not run backwards')
  }
  if (!Number.isFinite(recoveryHours) || recoveryHours < 0) {
    throw new Error('Recovery hours must be non-negative')
  }
  const elapsed = atHour - need.lastUpdatedHour
  const deficit = clamp(
    need.baselineDeficit
      + elapsed * need.homeostaticRatePerHour
      - recoveryHours * need.recoveryPerHour,
  )
  const rhythm = need.oscillators.reduce((sum, osc) => {
    if (!Number.isFinite(osc.periodHours) || osc.periodHours <= 0
      || !Number.isFinite(osc.amplitude) || !Number.isFinite(osc.phaseHours)) {
      throw new Error('Invalid rhythm component')
    }
    return sum + osc.amplitude * Math.sin(
      2 * Math.PI * ((atHour - osc.phaseHours) / osc.periodHours),
    )
  }, 0)
  return {
    deficit,
    rhythm,
    urgency: clamp(deficit + rhythm + (need.contextImpact ?? 0)),
  }
}

/** Example parameters are explicitly synthetic, not scientific frequencies. */
export const EXAMPLE_NEEDS: Readonly<Record<string, NeedRhythm>> = {
  sleep: {
    baselineDeficit: 0.2, homeostaticRatePerHour: 0.03,
    recoveryPerHour: 0.1, lastUpdatedHour: 0,
    oscillators: [{ periodHours: 24, amplitude: 0.12, phaseHours: 5 }],
  },
  nourishment: {
    baselineDeficit: 0.2, homeostaticRatePerHour: 0.06,
    recoveryPerHour: 0.2, lastUpdatedHour: 0,
    oscillators: [{ periodHours: 24, amplitude: 0.06, phaseHours: 8 }],
  },
}
