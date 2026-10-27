import { projectGeodynamoPilot, type GeodynamoPilotInput, type GeodynamoPilotResult } from './geodynamoPilot'

/**
 * Research scenarios, not measured reconstructions. All numerical values below are
 * invented illustrative inputs; do not pass them off as measured Earth/Mars field histories.
 * Mars' current lack of a global intrinsic dipole motivates a zero-moment toy case.
 */
export type GeodynamoScenario = {
  id: 'earth-reversal-toy' | 'mars-current-toy' | 'noxia-fictional-toy'
  evidenceClass: 'illustrative-earth' | 'illustrative-mars' | 'fictional'
  description: string
  input: GeodynamoPilotInput
}
export const GEODYNAMO_SCENARIOS: readonly GeodynamoScenario[] = [
  {
    id: 'earth-reversal-toy',
    evidenceClass: 'illustrative-earth',
    description: 'Earth-inspired reversals (fabricated event ages; NOT a paleomagnetic time series).',
    input: {
      bodyId: 'earth', geologicalTimeMyr: 260, referenceTimeMyr: 263,
      referenceDipoleMomentAm2: 8e22, baselineHeatFluxWm2: 0.08,
      heatFluxAnomalyWm2: 0, heatFluxSensitivity: 0.2,
      reversalAgesMyr: [262, 261, 260.5],
    },
  },
  {
    id: 'mars-current-toy',
    evidenceClass: 'illustrative-mars',
    description: 'Mars current global intrinsic dipole set to zero; excludes local crustal remanence.',
    input: {
      bodyId: 'mars', geologicalTimeMyr: 0, referenceTimeMyr: 0,
      referenceDipoleMomentAm2: 0, baselineHeatFluxWm2: 0.02,
      heatFluxAnomalyWm2: 0, heatFluxSensitivity: 0,
      reversalAgesMyr: [],
    },
  },
  {
    id: 'noxia-fictional-toy',
    evidenceClass: 'fictional',
    description: 'Entirely fictional planet, invented field strength, fluxes and reversals.',
    input: {
      bodyId: 'noxia-fictional-alpha', geologicalTimeMyr: 12, referenceTimeMyr: 15,
      referenceDipoleMomentAm2: 4e22, baselineHeatFluxWm2: 0.06,
      heatFluxAnomalyWm2: 0.01, heatFluxSensitivity: 0.3,
      reversalAgesMyr: [14, 13],
    },
  },
] as const

export function compareGeodynamoScenarios(): readonly {scenario: GeodynamoScenario; result: GeodynamoPilotResult}[] {
  return GEODYNAMO_SCENARIOS.map(scenario => ({scenario, result: projectGeodynamoPilot(scenario.input)}))
}
