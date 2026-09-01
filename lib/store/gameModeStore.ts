import { create } from 'zustand'

export type GameMode = 'colony' | 'planning' | 'interior'

interface GameModeState {
  mode: GameMode
  interiorBuildingId: string | null
  enterColony: () => void
  enterPlanning: () => void
  enterInterior: (buildingId: string) => void
  resetForLocation: () => void
}

export const useGameModeStore = create<GameModeState>((set) => ({
  mode: 'planning',
  interiorBuildingId: null,

  enterColony: () => set({ mode: 'colony', interiorBuildingId: null }),
  enterPlanning: () => set({ mode: 'planning', interiorBuildingId: null }),
  enterInterior: (buildingId) => set({ mode: 'interior', interiorBuildingId: buildingId }),
  resetForLocation: () => set({ mode: 'planning', interiorBuildingId: null }),
}))
