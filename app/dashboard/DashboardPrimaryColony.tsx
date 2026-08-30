'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { getSessionInfo } from '@/lib/supabase/auth'
import WalkableColony from './WalkableColony'

type WorldLocation = {
  id: string
  slug: string
  name?: string
  location_type?: string
  population?: number
}

/**
 * Primary planet workspace.
 *
 * The existing ColonyGrid remains mounted underneath as the canonical planning
 * and building surface. This layer makes the experiential isometric colony the
 * default view without duplicating simulation state. Its data is read from the
 * same world/build endpoints that feed the dashboard.
 *
 * GET /api/game/build also completes any due player_builds. Polling it here is
 * therefore intentionally both a UI refresh and the foreground completion path;
 * the daily cron remains only a fallback for players who are offline.
 */
export default function DashboardPrimaryColony() {
  const location = useGameStore(s => s.location)
  const [planning, setPlanning] = useState(false)
  const [userId, setUserId] = useState('')
  const [locations, setLocations] = useState<WorldLocation[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [builds, setBuilds] = useState<any[]>([])

  useEffect(() => {
    setPlanning(false)
  }, [location])

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setInterval> | undefined

    async function refresh() {
      try {
        const { token, userId: uid } = await getSessionInfo()
        const [buildRes, worldRes] = await Promise.all([
          fetch('/api/game/build', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
          fetch('/api/game/world', { cache: 'no-store' }),
        ])
        if (!live) return

        if (buildRes.ok) {
          const data = await buildRes.json()
          setUserId(uid)
          setEntities(Array.isArray(data.entities) ? data.entities : [])
          setBuilds(Array.isArray(data.builds) ? data.builds : [])
        }
        if (worldRes.ok) {
          const data = await worldRes.json()
          setLocations(Array.isArray(data.locations) ? data.locations : [])
        }
      } catch {
        // Dashboard underneath remains the fallback if this enhancement cannot load.
      }
    }

    refresh()
    timer = setInterval(refresh, 30_000)
    return () => {
      live = false
      if (timer) clearInterval(timer)
    }
  }, [location])

  const current = locations.find(l => l.slug === location)
  const isStation = current?.location_type === 'station' || location === 'prometheus'

  const localEntities = useMemo(() => {
    if (!current) return []
    return entities.filter((e: any) =>
      e.locations?.slug === location || e.location_id === current.id
    )
  }, [entities, current, location])

  const localBuilds = useMemo(() => {
    if (!current) return []
    return builds.filter((b: any) =>
      b.locations?.slug === location || b.location_id === current.id
    )
  }, [builds, current, location])

  if (!current || isStation || !userId) return null

  if (planning) {
    return (
      <button
        className="noxia-return-colony"
        onClick={() => setPlanning(false)}
        title="Zur begehbaren Kolonieansicht zurückkehren"
      >
        ◈ Kolonieansicht
      </button>
    )
  }

  return (
    <div className="noxia-primary-colony" aria-label="Kolonieansicht">
      <WalkableColony
        locationSlug={location}
        locationName={current.name ?? location}
        population={current.population ?? 0}
        entities={localEntities}
        pending={localBuilds}
        ships={[]}
        locationId={current.id}
        userId={userId}
        onClose={() => setPlanning(true)}
      />
      <button
        className="noxia-planning-switch"
        onClick={() => setPlanning(true)}
        title="Technischen Raster- und Baumodus öffnen"
      >
        ▦ Planen & Bauen
      </button>
    </div>
  )
}
