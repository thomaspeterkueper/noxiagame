'use client'
// app/_components/PlayerActivityRecorder.tsx
// Erstellt:     28.10.2026
// Aktualisiert: 29.10.2026 — Laufwege auf der Erde (Weltkarte und Erdoberfläche) aus dem gemeinsamen Standort
// Vorher:       28.10.2026 — Verhaltensaufzeichnung der Testphase einhängen: Seite, Ort, Spielmodus, Laufwege in der Koloniesicht
// Version:      1.1.0

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useGameStore } from '@/lib/store/gameStore'
import { useGameModeStore } from '@/lib/store/gameModeStore'
import { useColonyInteractionStore } from '@/lib/store/colonyInteractionStore'
import { reportPlayerPosition, reportView, startPlayerActivity } from '@/lib/telemetry/playerActivity'
import { earthPathPoint } from '@/lib/telemetry/activityRules'
import { useEarthPlayerPositionStore } from '@/lib/store/earthPlayerPositionStore'

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
    const stopColony = useColonyInteractionStore.subscribe(state => {
      const p = state.playerPosition
      if (p) reportPlayerPosition(`colony:${useGameStore.getState().location ?? '?'}`, p.col, p.row)
    })
    // Erde: Weltkarte und Erdoberfläche teilen einen Standort (Bodenmeter, siehe earthPathPoint).
    const stopEarth = useEarthPlayerPositionStore.subscribe(state => {
      if (!state.geo) return
      const p = earthPathPoint(state.geo)
      reportPlayerPosition('earth', p.x, p.y)
    })
    return () => { stopColony(); stopEarth() }
  }, [])

  useEffect(() => { reportView(`page:${pathname}`) }, [pathname])
  useEffect(() => { if (location) reportView(`location:${location}`) }, [location])
  useEffect(() => { reportView(`mode:${mode}`, interiorBuildingId ? { interior: true } : undefined) }, [mode, interiorBuildingId])

  return null
}
