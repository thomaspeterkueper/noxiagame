'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { getToken } from '@/lib/supabase/auth'
import PlanetarySurfaceMap, { type PlanetarySurfaceEntity, type PreparedCorridor } from '@/app/components/PlanetarySurfaceMap'
import {
  DEIMOS_OUTPOST_ALPHA_LOGISTICS,
  DEIMOS_OUTPOST_ALPHA_NODES,
} from '@/lib/game/seeds/deimosOutpostAlphaSeed'
import BuildingInterior from './BuildingInterior'
import BuildingOverlayShell from './BuildingOverlayShell'
import SolarSystem from './SolarSystem'
import SpaceportOverlay from './SpaceportOverlay'

type Props = { locations: any[]; prices: any[]; orders: any[] }

// Nur eine Anlegestelle, keine Werft/kein Warenhaus -- die Aussenstelle ist
// bewusst ein Sackbahnhof, kein Umschlagknoten.
const DEIMOS_CORRIDORS: PreparedCorridor[] = (() => {
  const nodes = new Map(DEIMOS_OUTPOST_ALPHA_NODES.map(node => [node.id, node]))
  const seen = new Set<string>()
  return DEIMOS_OUTPOST_ALPHA_LOGISTICS.flatMap((edge, index) => {
    const from = nodes.get(edge.from), to = nodes.get(edge.to)
    if (!from || !to) return []
    const physicalKey = [edge.from, edge.to].sort().join('::')
    if (seen.has(physicalKey)) return []
    seen.add(physicalKey)
    return [{
      id: `deimos-corridor-${index}`,
      kind: 'prepared-track' as const,
      points: [{ xM: from.xM, yM: from.yM }, { xM: to.xM, yM: to.yM }],
    }]
  })
})()

export default function DashboardDeimosSurface({ locations }: Props) {
  const location = useGameStore(s => s.location), shipRange = useGameStore(s => s.shipRange)
  const [interiorEntity, setInteriorEntity] = useState<PlanetarySurfaceEntity | null>(null)
  const [dockEntity, setDockEntity] = useState<PlanetarySurfaceEntity | null>(null)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const deimosLocation = useMemo(() => locations.find((item: any) => item.slug === 'deimos') ?? null, [locations])

  useEffect(() => { if (location !== 'deimos') return; let cancelled = false; fetch('/api/game/world', { cache: 'no-store' }).then(r => r.json()).then(p => { if (!cancelled) setTick(Number(p?.stats?.tickNumber ?? 0)) }).catch(() => {}); return () => { cancelled = true } }, [location])
  useEffect(() => { if (location !== 'deimos') return; let cancelled = false; (async () => { try { const token = await getToken(); if (!token || cancelled) return; await fetch('/api/game/build/spatial/terrain-sync', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'deimos' }) }) } catch {} })(); return () => { cancelled = true } }, [location])
  if (location !== 'deimos') return null

  const openWorldObject = (entity: PlanetarySurfaceEntity) => {
    const id = entity.entity_id ?? ''
    if (id === 'shuttle_dock_deimos') { setDockEntity(entity); return }
    setInteriorEntity(entity)
  }

  const dockName = dockEntity?.name ?? dockEntity?.entity_id ?? 'Anlegestelle'
  const interiorName = interiorEntity?.name ?? interiorEntity?.entity_id ?? 'Anlage'

  return <section className="noxia-dashboard-deimos-surface" aria-label="Deimos-Oberfläche Swift">
    <div className="deimos-context-label"><strong>SYNTHETISCH · Swift-Nordrand</strong><span>erfundenes Terrain (keine Beobachtungsdaten) · gemeinsamer Planetary-Surface-Renderer</span></div>
    <PlanetarySurfaceMap
      locationSlug="deimos"
      body="deimos"
      mapLabel="Spielbare Deimos-Karte (Swift-Aussenstelle)"
      terrainLabel="Synthetisch · nicht beobachtet"
      minimumWorldSpanM={220}
      corridors={DEIMOS_CORRIDORS}
      onOpenWorldObject={openWorldObject}
    />

    {dockEntity && <SpaceportOverlay buildingTypeId="shuttle_dock_deimos" buildingName={dockName} onClose={() => setDockEntity(null)} onOpenNavigation={() => { setDockEntity(null); setNavigationOpen(true) }} onOpenMaintenance={() => setDockEntity(null)} onOpenCargo={() => setDockEntity(null)} />}

    {navigationOpen && <BuildingOverlayShell eyebrow="GEBÄUDE · NAVIGATION" title="Swift Navigation" subtitle="Sonnensystem, Reichweite und Flugplanung" onClose={() => setNavigationOpen(false)} width={1080}><div className="navigation-body"><SolarSystem currentTick={tick} shipRange={shipRange} currentLocation="deimos" /></div></BuildingOverlayShell>}

    {interiorEntity && <BuildingOverlayShell eyebrow="GEBÄUDE · INNENRAUM" title={interiorName} subtitle="Personen, Räume und gebäudespezifische Funktionen" onClose={() => setInteriorEntity(null)} width={1020}><BuildingInterior entity={{ ...interiorEntity, entity_type: 'building', tile_row: 0, tile_col: 0, profile_id: interiorEntity.profile_id ?? null, owner_class: interiorEntity.owner_class ?? 'STATE' } as any} userId="" locationResources={[]} credits={0} population={Number(deimosLocation?.population ?? 0)} hasShipyard={false} currentTick={tick} shipRange={shipRange} currentLocationSlug="deimos" onClose={() => setInteriorEntity(null)} onAction={() => {}} /></BuildingOverlayShell>}

    <style jsx>{`
      .noxia-dashboard-deimos-surface{position:fixed;top:var(--noxia-topbar-h,44px);right:0;bottom:0;left:0;z-index:1000;overflow:hidden;background:#0b0c0d;overscroll-behavior:contain}
      .noxia-dashboard-deimos-surface::before{content:'';position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;pointer-events:none;background:radial-gradient(circle at 45% 32%,rgba(140,140,140,.10),transparent 48%),linear-gradient(180deg,#111213,#08090a 76%);z-index:0}
      .deimos-context-label{position:fixed;z-index:2;left:18px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 10px);display:flex;flex-direction:column;gap:2px;padding:7px 10px;border:1px solid rgba(210,210,210,.16);border-radius:8px;background:rgba(10,10,10,.72);backdrop-filter:blur(8px);color:#d8d8d8;font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none}.deimos-context-label strong{color:#eab04a;letter-spacing:.08em}.deimos-context-label span{color:#9a9a9a}.navigation-body{min-height:520px;background:#070b14;border-radius:8px;overflow:hidden}
      .noxia-dashboard-deimos-surface :global(.planetary-shell){position:relative;z-index:1;height:100%;min-height:0;overflow:hidden}
    `}</style>
  </section>
}
