'use client'

import { create } from 'zustand'
import type { Interactable, NearbyInteraction, WorldPoint } from '@/lib/game/interactions'

export type ColonySelection =
  | { kind: 'building'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'vehicle'; id: string }
  | null

type ColonyInteractionState = {
  locationSlug: string | null
  playerPosition: WorldPoint | null
  selection: ColonySelection
  nearbyInteraction: NearbyInteraction | null
  showPeople: boolean
  setPlayerPosition: (position: WorldPoint) => void
  setSelection: (selection: ColonySelection) => void
  setNearbyInteraction: (interaction: NearbyInteraction | null) => void
  setShowPeople: (show: boolean) => void
  selectInteraction: (interaction: Interactable) => void
  resetForLocation: (locationSlug: string) => void
  clearSelection: () => void
}

export const useColonyInteractionStore = create<ColonyInteractionState>((set, get) => ({
  locationSlug: null,
  playerPosition: null,
  selection: null,
  nearbyInteraction: null,
  showPeople: false,

  setPlayerPosition: playerPosition => set({ playerPosition }),
  setSelection: selection => set({ selection, showPeople: false }),
  setNearbyInteraction: nearbyInteraction => set({ nearbyInteraction }),
  setShowPeople: showPeople => set({ showPeople, ...(showPeople ? { selection: null } : {}) }),

  selectInteraction: interaction => {
    if (interaction.kind === 'building') set({ selection: { kind: 'building', id: interaction.id }, showPeople: false })
    else if (interaction.kind === 'person') set({ selection: { kind: 'person', id: interaction.id }, showPeople: false })
    else set({ selection: { kind: 'vehicle', id: interaction.id }, showPeople: false })
  },

  resetForLocation: locationSlug => {
    if (get().locationSlug === locationSlug) return
    set({
      locationSlug,
      playerPosition: null,
      selection: null,
      nearbyInteraction: null,
      showPeople: false,
    })
  },

  clearSelection: () => set({ selection: null, showPeople: false }),
}))
