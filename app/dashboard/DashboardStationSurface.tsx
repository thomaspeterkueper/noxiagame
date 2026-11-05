'use client'
// Erstellt:     30.10.2026
// Version:      1.0.0
//
// Begehbare Ansicht der Stationen Prometheus (Kepler Station) und Q1 (Thomas,
// 30.10.2026: „erst 1 dann 2“ – Stationen begehbar machen). Gleiche lokale Szene wie
// Mond, Mars, Phobos und Deimos (PlanetaryWalkableSurface); statt Gelände ein Deck.
// Die Module sind durch Druckgänge verbunden (lib/game/spatial/stationLayouts.ts),
// Solarfelder und Scanner hängen an Außenpfaden, die nur im Anzug begehbar sind.
// Räume in den Modulen (Café, Bibliothek, Hafenkantine …) öffnen sich über das Modul.

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/store/gameStore'
import { useGameModeStore } from '@/lib/store/gameModeStore'
import PlanetaryWalkableSurface from '@/app/components/PlanetaryWalkableSurface'
import type { PlanetarySurfaceEntity, PreparedCorridor } from '@/app/components/PlanetarySurfaceMap'
import { isStationSlug, stationCorridors, type StationSlug } from '@/lib/game/spatial/stationLayouts'
import BuildingInterior from './BuildingInterior'
import BuildingOverlayShell from './BuildingOverlayShell'

type Props = { locations: any[]; prices: any[]; orders: any[] }

const STATION_TITLE: Record<StationSlug, string> = { prometheus: 'Kepler Station', q1: 'Q1 · Mars-Quadraturstation' }

export default function DashboardStationSurface({ locations }: Props) {
  const location = useGameStore(s => s.location)
  const credits = useGameStore(s => s.credits)
  const shipRange = useGameStore(s => s.shipRange)
  const mode = useGameModeStore(s => s.mode)
  const enterPlanning = useGameModeStore(s => s.enterPlanning)
  const [interiorEntity, setInteriorEntity] = useState<PlanetarySurfaceEntity | null>(null)
  const [tick, setTick] = useState(0)
  const slug = isStationSlug(location as string) ? (location as StationSlug) : null
  const stationLocation = useMemo(() => locations.find((item: any) => item.slug === slug) ?? null, [locations, slug])
  const corridors = useMemo<PreparedCorridor[]>(() => (slug ? stationCorridors(slug) : []), [slug])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetch('/api/game/world', { cache: 'no-store' }).then(r => r.json()).then(p => { if (!cancelled) setTick(Number(p?.stats?.tickNumber ?? 0)) }).catch(() => {})
    return () => { cancelled = true }
  }, [slug])

  if (!slug || mode !== 'colony') return null
  const interiorName = interiorEntity?.name ?? interiorEntity?.entity_id ?? 'Modul'

  return <>
    <PlanetaryWalkableSurface locationSlug={slug} body="station" title={STATION_TITLE[slug]} corridors={corridors} onOpenWorldObject={setInteriorEntity} onClose={enterPlanning} />
    {interiorEntity && <BuildingOverlayShell eyebrow="MODUL · INNENRAUM" title={interiorName} subtitle={STATION_TITLE[slug]} onClose={() => setInteriorEntity(null)} width={1020}>
      <BuildingInterior entity={{ ...interiorEntity, entity_type: 'building', tile_row: 0, tile_col: 0, profile_id: interiorEntity.profile_id ?? null, owner_class: interiorEntity.owner_class ?? 'STATE' } as any} userId="" locationResources={(stationLocation?.location_resources ?? []) as any} credits={credits} population={Number(stationLocation?.population ?? 0)} hasShipyard={false} currentTick={tick} shipRange={shipRange} currentLocationSlug={slug} onClose={() => setInteriorEntity(null)} />
    </BuildingOverlayShell>}
  </>
}
