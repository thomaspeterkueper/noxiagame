/**
 * NOXIA geodynamo research pilot.
 * Pure deterministic, non-authoritative projection, not a first-principles MHD solver.
 * No imports from tick/persistence, no side effects, no gameplay or extinction rules.
 * Grounding: DOC:KUE:KUE-SCI-0200-2026-DE; ontology ONT:KG:PERMIAN-GEOMAGNETIC-0.1.
 */
export type GeodynamoPilotInput = {
  bodyId: string
  geologicalTimeMyr: number
  referenceTimeMyr: number
  referenceDipoleMomentAm2: number
  baselineHeatFluxWm2: number
  heatFluxAnomalyWm2: number
  /** dimensionless research sensitivity, not empirically calibrated */
  heatFluxSensitivity: number
  /** signed dipole reversals relative to reference; geological ages in Ma before present */
  reversalAgesMyr: readonly number[]
}
export type GeodynamoPilotResult = {
  bodyId: string
  geologicalTimeMyr: number
  dipolePolarity: 1 | -1
  illustrativeDipoleMomentAm2: number
  mantleCoreBoundaryHeatFluxWm2: number
  modelKind: 'illustrative-non-authoritative'
  extinctionPrediction: null
  provenance: 'DOC:KUE:KUE-SCI-0200-2026-DE'
  limitations: readonly string[]
}
const finite = (n: number, label: string) => {
  if (!Number.isFinite(n)) throw new RangeError(label + ' must be finite')
  return n
}
/**
 * A reversal flips the sign only. Its occurrence does not imply low field strength.
 * Reversal times are *inputs*, never inferred from the biological fossil record.
 * No meaning is assigned to the exposure pathway without separate atmospheric models.
 */
export function projectGeodynamoPilot(input: GeodynamoPilotInput): GeodynamoPilotResult {
  const t = finite(input.geologicalTimeMyr, 'geologicalTimeMyr')
  const ref = finite(input.referenceTimeMyr, 'referenceTimeMyr')
  const moment = finite(input.referenceDipoleMomentAm2, 'referenceDipoleMomentAm2')
  const baseline = finite(input.baselineHeatFluxWm2, 'baselineHeatFluxWm2')
  const anomaly = finite(input.heatFluxAnomalyWm2, 'heatFluxAnomalyWm2')
  const sensitivity = finite(input.heatFluxSensitivity, 'heatFluxSensitivity')
  if (!input.bodyId.trim() || moment < 0 || baseline <= 0 || baseline + anomaly < 0) {
    throw new RangeError('Invalid body, reference moment or heat flux')
  }
  if (!input.reversalAgesMyr.every(Number.isFinite)) throw new RangeError('Reversal ages must be finite')
  const unique = new Set(input.reversalAgesMyr)
  if (unique.size !== input.reversalAgesMyr.length) throw new RangeError('Duplicate reversal age')
  const crossed = input.reversalAgesMyr.filter(age => (age > Math.min(t, ref) && age <= Math.max(t, ref))).length
  const polarity: 1 | -1 = crossed % 2 === 0 ? 1 : -1
  const heat = baseline + anomaly
  // Explicitly bounded phenomenological response; NOT a predictive scaling law.
  const response = Math.max(0, Math.min(2, 1 + sensitivity * (anomaly / baseline)))
  return {
    bodyId: input.bodyId,
    geologicalTimeMyr: t,
    dipolePolarity: polarity,
    illustrativeDipoleMomentAm2: moment * response,
    mantleCoreBoundaryHeatFluxWm2: heat,
    modelKind: 'illustrative-non-authoritative',
    extinctionPrediction: null,
    provenance: 'DOC:KUE:KUE-SCI-0200-2026-DE',
    limitations: [
      'Prescribed reversal ages; not a self-consistent geodynamo or MHD simulation.',
      'Heat flux response is dimensionless and uncalibrated; never use for empirical forecasts.',
      'Polarity reversal alone does not establish field collapse, UV exposure or extinction.',
    ],
  }
}
