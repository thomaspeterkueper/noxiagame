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

function ScienceOutpostPanel({ tick, population, onClose }: { tick: number; population: number; onClose: () => void }) {
  return <BuildingOverlayShell
    eyebrow="AUSSENSTELLE · WISSENSCHAFT"
    title="Forschungsstation Swift-1"
    subtitle="Kleine Deimos-Feldstation · Sensorik, Gravimetrie und Oberflächenbeobachtung"
    onClose={onClose}
    width={920}
  >
    <div className="science-panel">
      <div className="science-lead">
        Swift-1 ist kein Koloniezentrum. Die Station arbeitet als abgelegener Messposten mit sehr kleiner Besatzung,
        kurzen Außenkampagnen und engem Versorgungsfenster zur Mars-Infrastruktur.
      </div>
      <div className="science-grid">
        <article><span>Besatzung</span><strong>{population || 6}</strong><small>Forschung, Betrieb, Shuttle-Abfertigung</small></article>
        <article><span>Stationszyklus</span><strong>Tick {tick}</strong><small>gemeinsamer NOXIA-Weltzustand</small></article>
        <article><span>Primärrolle</span><strong>Messposten</strong><small>keine industrielle Außenstelle</small></article>
        <article><span>Mobilität</span><strong>Tether</strong><small>kurze gesicherte Wege statt Rover-Netz</small></article>
      </div>
      <div className="science-workstreams">
        <h3>Laufende Arbeitslinien</h3>
        <div><b>01 · Oberflächenmonitoring</b><span>Lokale Relief- und Regolithbeobachtung rund um den synthetisch rekonstruierten Swift-Spielraum.</span></div>
        <div><b>02 · Mikrogravitation</b><span>Langzeitmessungen zu Strukturbewegung, Verankerung und sehr kleinen Beschleunigungen.</span></div>
        <div><b>03 · Marsraum-Sensorik</b><span>Optische und funkbasierte Beobachtungen aus einem ruhigen, weit außen liegenden Messstandort.</span></div>
      </div>
      <div className="science-note">Die Karte trennt reale Nomenklaturanker von erfundenem Terrain. Swift ist der reale Referenzname; das lokale Höhenfeld der spielbaren Außenstelle ist ausdrücklich synthetisch.</div>
    </div>
    <style jsx>{`
      .science-panel{padding:20px;color:#d9dde0;background:linear-gradient(180deg,#111416,#090b0c);min-height:480px}
      .science-lead{max-width:760px;color:#b7c0c5;line-height:1.55;font-size:14px;margin-bottom:18px}
      .science-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:22px}
      .science-grid article{border:1px solid rgba(210,220,225,.13);background:rgba(255,255,255,.025);padding:12px;border-radius:9px;display:flex;flex-direction:column;gap:4px}
      .science-grid span,.science-workstreams h3{font:10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.09em;text-transform:uppercase;color:#87949b}
      .science-grid strong{font-size:18px;color:#eceff1;font-weight:650}.science-grid small{color:#7f8a90;line-height:1.3}
      .science-workstreams{display:grid;gap:9px}.science-workstreams h3{margin:0 0 2px;color:#eab04a}
      .science-workstreams div{display:grid;grid-template-columns:190px 1fr;gap:14px;padding:11px 12px;border-left:2px solid rgba(234,176,74,.45);background:rgba(234,176,74,.035)}
      .science-workstreams b{font-size:12px;color:#d7dde0}.science-workstreams span{font-size:12px;line-height:1.45;color:#9ea9ae}
      .science-note{margin-top:18px;padding:11px 12px;border:1px solid rgba(126,169,190,.16);border-radius:8px;color:#91a6b1;font-size:11px;line-height:1.45;background:rgba(38,76,92,.08)}
      @media(max-width:760px){.science-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.science-workstreams div{grid-template-columns:1fr;gap:4px}}
    `}</style>
  </BuildingOverlayShell>
}

export default function DashboardDeimosSurface({ locations }: Props) {
  const location = useGameStore(s => s.location)
  const locationSlug = location as string
  const shipRange = useGameStore(s => s.shipRange)
  const credits = useGameStore(s => s.credits)
  const [interiorEntity, setInteriorEntity] = useState<PlanetarySurfaceEntity | null>(null)
  const [dockEntity, setDockEntity] = useState<PlanetarySurfaceEntity | null>(null)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [scienceOpen, setScienceOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const deimosLocation = useMemo(() => locations.find((item: any) => item.slug === 'deimos') ?? null, [locations])
  const currentResources = deimosLocation?.location_resources ?? []

  useEffect(() => { if (locationSlug !== 'deimos') return; let cancelled = false; fetch('/api/game/world', { cache: 'no-store' }).then(r => r.json()).then(p => { if (!cancelled) setTick(Number(p?.stats?.tickNumber ?? 0)) }).catch(() => {}); return () => { cancelled = true } }, [locationSlug])
  useEffect(() => { if (locationSlug !== 'deimos') return; let cancelled = false; (async () => { try { const token = await getToken(); if (!token || cancelled) return; await fetch('/api/game/build/spatial/terrain-sync', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'deimos' }) }) } catch {} })(); return () => { cancelled = true } }, [locationSlug])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 3200); return () => window.clearTimeout(timer) }, [notice])
  if (locationSlug !== 'deimos') return null

  const openWorldObject = (entity: PlanetarySurfaceEntity) => {
    const id = entity.entity_id ?? ''
    if (id === 'shuttle_dock_deimos') { setDockEntity(entity); return }
    if (id === 'research_station') { setScienceOpen(true); return }
    setInteriorEntity(entity)
  }

  const dockName = dockEntity?.name ?? dockEntity?.entity_id ?? 'Anlegestelle'
  const interiorName = interiorEntity?.name ?? interiorEntity?.entity_id ?? 'Anlage'

  return <section className="noxia-dashboard-deimos-surface" aria-label="Deimos-Oberfläche Swift">
    <div className="deimos-context-label"><strong>SYNTHETISCH · Swift-Nordrand</strong><span>reale Nomenklatur · erfundenes lokales Terrain · Forschungsaußenstelle Swift-1</span></div>
    <PlanetarySurfaceMap
      locationSlug="deimos"
      body="deimos"
      mapLabel="Spielbare Deimos-Karte (Swift-Aussenstelle)"
      terrainLabel="Synthetisch · nicht beobachtet"
      minimumWorldSpanM={220}
      corridors={DEIMOS_CORRIDORS}
      onOpenWorldObject={openWorldObject}
    />

    {notice && <div className="deimos-notice">{notice}</div>}

    {dockEntity && <SpaceportOverlay
      buildingTypeId="shuttle_dock_deimos"
      buildingName={dockName}
      onClose={() => setDockEntity(null)}
      onOpenNavigation={() => { setDockEntity(null); setNavigationOpen(true) }}
      onOpenMaintenance={() => { setDockEntity(null); setNotice('Swift-1 besitzt keine eigene Werft. Wartung erfolgt nur als begrenzter Shuttle-Service oder extern.') }}
      onOpenCargo={() => { setDockEntity(null); setNotice('Kein öffentliches Warenhaus: Versorgung wird missionsgebunden direkt zwischen Shuttle und Station umgeschlagen.') }}
    />}

    {navigationOpen && <BuildingOverlayShell eyebrow="GEBÄUDE · NAVIGATION" title="Swift Navigation" subtitle="Sonnensystem, Reichweite und Flugplanung" onClose={() => setNavigationOpen(false)} width={1080}><div className="navigation-body"><SolarSystem currentTick={tick} shipRange={shipRange} currentLocation="deimos" /></div></BuildingOverlayShell>}

    {scienceOpen && <ScienceOutpostPanel tick={tick} population={Number(deimosLocation?.population ?? 6)} onClose={() => setScienceOpen(false)} />}

    {interiorEntity && <BuildingOverlayShell eyebrow="GEBÄUDE · INNENRAUM" title={interiorName} subtitle="Kleine, funktionale Außenstellen-Infrastruktur" onClose={() => setInteriorEntity(null)} width={1020}><BuildingInterior entity={{ ...interiorEntity, entity_type: 'building', tile_row: 0, tile_col: 0, profile_id: interiorEntity.profile_id ?? null, owner_class: interiorEntity.owner_class ?? 'STATE' } as any} userId="" locationResources={currentResources as any} credits={credits} population={Number(deimosLocation?.population ?? 0)} hasShipyard={false} currentTick={tick} shipRange={shipRange} currentLocationSlug="deimos" onClose={() => setInteriorEntity(null)} onAction={(kind) => { if (kind === 'navigation') { setInteriorEntity(null); setNavigationOpen(true) } }} /></BuildingOverlayShell>}

    <style jsx>{`
      .noxia-dashboard-deimos-surface{position:fixed;top:var(--noxia-topbar-h,44px);right:0;bottom:0;left:0;z-index:1000;overflow:hidden;background:#0b0c0d;overscroll-behavior:contain}
      .noxia-dashboard-deimos-surface::before{content:'';position:fixed;inset:var(--noxia-topbar-h,44px) 0 0;pointer-events:none;background:radial-gradient(circle at 45% 32%,rgba(140,140,140,.10),transparent 48%),linear-gradient(180deg,#111213,#08090a 76%);z-index:0}
      .deimos-context-label{position:fixed;z-index:2;left:18px;bottom:calc(var(--noxia-cockpit-clearance,76px) + 10px);display:flex;flex-direction:column;gap:2px;padding:7px 10px;border:1px solid rgba(210,210,210,.16);border-radius:8px;background:rgba(10,10,10,.72);backdrop-filter:blur(8px);color:#d8d8d8;font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none}.deimos-context-label strong{color:#eab04a;letter-spacing:.08em}.deimos-context-label span{color:#9a9a9a}.navigation-body{min-height:520px;background:#070b14;border-radius:8px;overflow:hidden}
      .deimos-notice{position:fixed;z-index:2400;left:50%;bottom:calc(var(--noxia-cockpit-clearance,76px) + 22px);transform:translateX(-50%);max-width:min(620px,calc(100vw - 28px));padding:10px 14px;border:1px solid rgba(234,176,74,.28);border-radius:9px;background:rgba(14,15,16,.94);box-shadow:0 10px 28px rgba(0,0,0,.34);color:#d9dde0;font:12px/1.45 system-ui,sans-serif}
      .noxia-dashboard-deimos-surface :global(.planetary-shell){position:relative;z-index:1;height:100%;min-height:0;overflow:hidden}
    `}</style>
  </section>
}
