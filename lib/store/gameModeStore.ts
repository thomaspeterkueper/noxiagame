'use client'

import { create } from 'zustand'

export type GameMode = 'planning' | 'colony'

type GameModeState = {
  mode: GameMode
  setMode: (mode: GameMode) => void
}

export const useGameModeStore = create<GameModeState>(set => ({
  mode: 'planning',
  setMode: mode => set({ mode }),
}))
