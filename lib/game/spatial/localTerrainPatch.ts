export interface LocalTerrainPatchPoint {
  xM: number
  yM: number
}

export interface LocalTerrainPatch {
  stepM: number
  size: number
  values: (number | null)[]
}

export interface LocalTerrainPatchOptions {
  size: number
  stepM: number
}

export type LocalTerrainHeightSampler = (point: LocalTerrainPatchPoint) => Promise<number | null>

/**
 * Samples a square terrain patch in the body's already-resolved local tangent
 * frame. This function knows nothing about Earth, Moon, Mars, LOLA, MOLA or a
 * concrete datum: those concerns remain in the injected terrain sampler.
 *
 * Grid row 0 is north and columns grow eastward, matching the shared ENU map
 * convention (+x east, +y north). Missing source data remains null.
 */
export async function sampleLocalTerrainPatch(
  options: LocalTerrainPatchOptions,
  sampleHeight: LocalTerrainHeightSampler,
): Promise<LocalTerrainPatch> {
  const size = Math.floor(options.size)
  const stepM = options.stepM
  if (!Number.isInteger(size) || size < 2 || size % 2 === 0) {
    throw new Error('local terrain patch size must be an odd integer >= 3')
  }
  if (!Number.isFinite(stepM) || stepM <= 0) {
    throw new Error('local terrain patch stepM must be positive')
  }

  const half = Math.floor(size / 2)
  const values: (number | null)[] = []
  for (let row = -half; row <= half; row++) {
    for (let col = -half; col <= half; col++) {
      const value = await sampleHeight({ xM: col * stepM, yM: -row * stepM })
      values.push(value != null && Number.isFinite(value) ? value : null)
    }
  }
  return { stepM, size, values }
}
