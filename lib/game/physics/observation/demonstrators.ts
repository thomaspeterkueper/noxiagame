import { observeThroughAtmosphere } from './refraction.ts'
import type { AtmosphericState, PhysicalObservation } from './types.ts'

export const HORIZON_REFRACTION_DEMONSTRATOR_ID = 'NOXIA:DEMO:PHY:ATMOSPHERIC-REFRACTION:V1' as const

export interface HorizonRefractionInput {
  geometricAltitudeDeg: number
  azimuthDeg?: number
  atmosphere: AtmosphericState | null
}

export interface HorizonRefractionResult {
  demonstratorId: typeof HORIZON_REFRACTION_DEMONSTRATOR_ID
  observation: PhysicalObservation
  explanation: {
    geometricAltitudeDeg: number
    refractionDeg: number
    apparentAltitudeDeg: number
    pressureHpa: number | null
    temperatureC: number | null
  }
}

export function runHorizonRefractionDemonstrator(input: HorizonRefractionInput): HorizonRefractionResult {
  const observation = observeThroughAtmosphere({
    geometric: { altitudeDeg: input.geometricAltitudeDeg, azimuthDeg: input.azimuthDeg ?? 180 },
    atmosphere: input.atmosphere,
  })
  return {
    demonstratorId: HORIZON_REFRACTION_DEMONSTRATOR_ID,
    observation,
    explanation: {
      geometricAltitudeDeg: observation.geometric.altitudeDeg,
      refractionDeg: observation.refractionDeg,
      apparentAltitudeDeg: observation.apparent.altitudeDeg,
      pressureHpa: input.atmosphere?.pressureHpa ?? null,
      temperatureC: input.atmosphere?.temperatureC ?? null,
    },
  }
}
