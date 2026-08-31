'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { getSessionInfo } from '@/lib/supabase/auth'
import WalkableColony from './WalkableColony'
import ColonyHudOverlay, { ColonyHudStyles } from './ColonyHudOverlay'

type WorldLocation = {
  id: string
  slug: string
  name?: string
  location_type?: string
  population?: number
  location_resources?: any[]
}

const chrome = <style>{`
.noxia-primary-colony{position:fixed;z-index:900;left:.65rem;right:.65rem;top:112px;bottom:.65rem;border:1px solid #263f55;border-radius:8px;overflow:hidden;background:#081019 url('/assets/environments/mars/terrain-tharsis.webp') center/cover no-repeat;box-shadow:0 12px 34px rgba(7,14,23,.32)}
.noxia-return-colony{position:fixed;z-index:1180;left:50%;top:102px;transform:translateX(-50%);border:1px solid #2c78b6;border-radius:7px;background:#08243b;color:#e7f3fb;font:700 11px system-ui,sans-serif;letter-spacing:.02em;padding:7px 11px;cursor:pointer;box-shadow:0 3px 10px rgba(20,28,36,.24)}
.noxia-return-colony:hover{background:#0b5d9c}
/* Im Koloniemodus gehört die volle Breite der Spielwelt; die alte Dashboard-Rechtsleiste bleibt unter der fixierten Welt erhalten, ist aber nicht mehr der primäre Informationskanal. */
@media(max-width:900px){.noxia-primary-colony{top:120px}.noxia-return-colony{top:108px}}
`}</style>

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
      } catch {}
    }
    refresh()
    timer = setInterval(refresh, 30_000)
    return () => { live = false; if (timer) clearInterval(timer) }
  }, [location])

  const current = locations.find(l => l.slug === location)
  const isStation = current?.location_type === 'station' || location === 'prometheus'
  const localEntities = useMemo(() => !current ? [] : entities.filter((e:any)=>e.locations?.slug===location || e.location_id===current.id), [entities,current,location])
  const localBuilds = useMemo(() => !current ? [] : builds.filter((b:any)=>b.locations?.slug===location || b.location_id===current.id), [builds,current,location])

  if (!current || isStation || !userId) return null
  if (planning) return <>{chrome}<button className="noxia-return-colony" onClick={()=>setPlanning(false)}>◈ Kolonieansicht</button></>

  return <>
    {chrome}
    <ColonyHudStyles />
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
        onClose={()=>setPlanning(true)}
      />
      <ColonyHudOverlay current={current} builds={localBuilds} entityCount={localEntities.length} onPlan={()=>setPlanning(true)} />
    </div>
  </>
}
