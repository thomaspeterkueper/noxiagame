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

const chrome = <style>{`
.noxia-primary-colony{position:fixed;z-index:900;left:.65rem;right:280px;top:112px;bottom:.65rem;border:1px solid #3f5365;border-radius:8px;overflow:hidden;background:#081019;box-shadow:0 10px 28px rgba(20,28,36,.18)}
.noxia-planning-switch,.noxia-return-colony{position:fixed;z-index:1180;border:1px solid #806d46;border-radius:7px;background:#f7f2e5;color:#27445f;font:700 11px system-ui,sans-serif;letter-spacing:.02em;padding:7px 11px;cursor:pointer;box-shadow:0 3px 10px rgba(20,28,36,.14)}
.noxia-planning-switch{right:292px;top:160px}
.noxia-return-colony{left:50%;top:102px;transform:translateX(-50%)}
.noxia-planning-switch:hover,.noxia-return-colony:hover{background:#fff;border-color:#c9a961}
@media(max-width:900px){.noxia-primary-colony{right:.65rem;top:120px}.noxia-planning-switch{right:18px;top:168px}.noxia-return-colony{top:108px}}
`}</style>

/**
 * Default planet workspace. ColonyGrid remains mounted underneath and is only
 * exposed as the explicit planning/building mode. No simulation coordinates are
 * duplicated here; both views consume the same build/world state.
 *
 * GET /api/game/build completes due builds. The 30-second foreground refresh
 * therefore removes the former "wait for tomorrow's cron" behaviour while the
 * daily cron remains a fallback for offline players.
 */
export default function DashboardPrimaryColony() {
  const location = useGameStore(s => s.location)
  const [planning, setPlanning] = useState(false)
  const [userId, setUserId] = useState('')
  const [locations, setLocations] = useState<WorldLocation[]>([])
  const [entities, setEntities] = useState<any[]>([])
  const [builds, setBuilds] = useState<any[]>([])

  useEffect(() => { setPlanning(false) }, [location])

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setInterval> | undefined

    async function refresh() {
      try {
        const { token, userId: uid } = await getSessionInfo()
        const [buildRes, worldRes] = await Promise.all([
          fetch('/api/game/build', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
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
        // The underlying dashboard remains usable if the enhancement cannot load.
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
    return entities.filter((e: any) => e.locations?.slug === location || e.location_id === current.id)
  }, [entities, current, location])

  const localBuilds = useMemo(() => {
    if (!current) return []
    return builds.filter((b: any) => b.locations?.slug === location || b.location_id === current.id)
  }, [builds, current, location])

  if (!current || isStation || !userId) return null

  if (planning) {
    return <>{chrome}<button className="noxia-return-colony" onClick={() => setPlanning(false)} title="Zur begehbaren Kolonieansicht zurückkehren">◈ Kolonieansicht</button></>
  }

  return (
    <>
      {chrome}
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
      </div>
      <button className="noxia-planning-switch" onClick={() => setPlanning(true)} title="Technischen Raster- und Baumodus öffnen">▦ Planen & Bauen</button>
    </>
  )
}
