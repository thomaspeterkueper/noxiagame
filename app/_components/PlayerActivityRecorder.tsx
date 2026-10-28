'use client'
// app/_components/PlayerActivityRecorder.tsx
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Verhaltensaufzeichnung der Testphase einhängen: Seite, Ort, Spielmodus, Laufwege in der Koloniesicht
// Version:      1.0.0

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useGameStore } from '@/lib/store/gameStore'
import { useGameModeStore } from '@/lib/store/gameModeStore'
import { useColonyInteractionStore } from '@/lib/store/colonyInteractionStore'
import { reportPlayerPosition, reportView, startPlayerActivity } from '@/lib/telemetry/playerActivity'

export default function PlayerActivityRecorder() {
  const pathname = usePathname()
  const location = useGameStore(s => s.location)
  const mode = useGameModeStore(s => s.mode)
  const interiorBuildingId = useGameModeStore(s => s.interiorBuildingId)

  useEffect(() => {
    startPlayerActivity(() => ({
      location: useGameStore.getState().location ?? null,
      mode: useGameModeStore.getState().mode ?? null,
    }))
    // Laufwege in der Koloniesicht (Kachelraster) kommen aus dem Store.
    return useColonyInteractionStore.subscribe(state => {
      const p = state.playerPosition
      if (p) reportPlayerPosition(`colony:${useGameStore.getState().location ?? '?'}`, p.col, p.row)
    })
  }, [])

  useEffect(() => { reportView(`page:${pathname}`) }, [pathname])
  useEffect(() => { if (location) reportView(`location:${location}`) }, [location])
  useEffect(() => { reportView(`mode:${mode}`, interiorBuildingId ? { interior: true } : undefined) }, [mode, interiorBuildingId])

  return null
}
