'use client'

import { create } from 'zustand'
import type { ScenePoint } from '@/lib/world/spatial/earthLocalScene'

type EarthPlayerPositionState = {
  regionId: string | null
  position: ScenePoint
  setPosition: (regionId: string | null, position: ScenePoint) => void
  reset: (regionId?: string | null) => void
}

export const useEarthPlayerPositionStore = create<EarthPlayerPositionState>(set => ({
  regionId: null,
  position: { xM: 0, yM: 0 },
  setPosition: (regionId, position) => set({ regionId, position }),
  reset: (regionId = null) => set({ regionId, position: { xM: 0, yM: 0 } }),
}))
