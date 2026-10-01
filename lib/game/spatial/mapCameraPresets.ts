export type MapCameraPresetId = 'surface-local' | 'regional' | 'global' | 'orbital'

export const MAP_SCALE_DIVISIONS = 5

export const MAP_CAMERA_PRESETS = {
  'surface-local': {
    defaultScaleBarM: 500,
    visibleWidthM: 2500,
  },
  regional: {
    defaultScaleBarM: 5000,
    visibleWidthM: 25000,
  },
  global: {
    defaultScaleBarM: 1000000,
    visibleWidthM: 5000000,
  },
  orbital: {
    defaultScaleBarM: 100000,
    visibleWidthM: 500000,
  },
} as const

export const SURFACE_LOCAL_CAMERA = MAP_CAMERA_PRESETS['surface-local']

export function pixelsPerMeterForVisibleWidth(viewportWidthPx: number, visibleWidthM: number) {
  return Math.max(1, viewportWidthPx) / Math.max(1, visibleWidthM)
}
