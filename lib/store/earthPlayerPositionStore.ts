'use client'

import { create } from 'zustand'
import type { ScenePoint } from '@/lib/world/spatial/earthLocalScene'
import type { GeoPoint } from '@/lib/world/spatial/earthSpatial'

type EarthPlayerPositionState = {
  regionId: string | null
  position: ScenePoint
  geo: GeoPoint | null
  setPosition: (regionId: string | null, position: ScenePoint, geo?: GeoPoint | null) => void
  reset: (regionId?: string | null, geo?: GeoPoint | null) => void
}

export const useEarthPlayerPositionStore = create<EarthPlayerPositionState>(set => ({
  regionId: null,
  position: { xM: 0, yM: 0 },
  geo: null,
  setPosition: (regionId, position, geo) => set(state => ({
    regionId,
    position,
    geo: geo === undefined ? state.geo : geo,
  })),
  reset: (regionId = null, geo = null) => set({
    regionId,
    position: { xM: 0, yM: 0 },
    geo,
  }),
}))
