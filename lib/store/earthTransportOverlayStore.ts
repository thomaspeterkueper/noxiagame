'use client'

// lib/store/earthTransportOverlayStore.ts
// Shared transport context of the Earth page.
//
// The Earth map and the Earth logistics panels are independent client components.
// This store carries only the derived drawable overlay between them; it is never a
// second source of truth for inventories, vehicles, jobs or routes.

import { create } from 'zustand'
import type { EarthTransportOverlaySlice } from '@/lib/game/earthTransportOverlay'

/** Stable publisher ids. A panel may publish an empty slice to clear its own part. */
export type EarthTransportOverlaySource =
  | 'logistics-console'
  | 'mission-draft'
  | 'live-map'
  | 'spaceport-handover'

interface EarthTransportOverlayState {
  sources: Partial<Record<EarthTransportOverlaySource, EarthTransportOverlaySlice>>
  publish: (source: EarthTransportOverlaySource, slice: EarthTransportOverlaySlice) => void
  clear: (source: EarthTransportOverlaySource) => void
}

export const useEarthTransportOverlayStore = create<EarthTransportOverlayState>((set) => ({
  sources: {},
  publish: (source, slice) => set(state => ({ sources: { ...state.sources, [source]: slice } })),
  clear: (source) => set(state => {
    if (!(source in state.sources)) return state
    const sources = { ...state.sources }
    delete sources[source]
    return { sources }
  }),
}))
