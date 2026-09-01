'use client'

import { create } from 'zustand'

export type GameMode = 'planning' | 'colony'

type GameModeState = {
  mode: GameMode
  enterColony: () => void
  enterPlanning: () => void
}

export const useGameModeStore = create<GameModeState>(set => ({
  mode: 'planning',
  enterColony: () => set({ mode: 'colony' }),
  enterPlanning: () => set({ mode: 'planning' }),
}))
