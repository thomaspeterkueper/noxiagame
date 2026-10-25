'use client'

// app/world-lab/WorldPanels.tsx
// Tafeln der Weltkarte: Person, Gebäude, Innenraum.
//
// Grundsatz (Thomas, 25.10.2026 – in der alten Szene lagen Tafeln übereinander):
// Es ist immer höchstens EINE Tafel offen. Jede neue ersetzt die vorige; der
// Innenraum ersetzt alles. Nichts öffnet sich nebenbei. Eine Begleitung (Person,
// die zu einem Ort geht) ist keine Tafel, sondern ein Vermerk, der im Innenraum
// genutzt wird.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { getBuildingEntryDefinition, type BuildingEntryRequest } from '@/lib/game/buildings/entry'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import EarthBuildingAccessLayer from '@/app/earth/EarthBuildingAccessLayer'
import LandmarkWalkableInterior from '@/app/earth/LandmarkWalkableInterior'
import { landmarkRoomKind, type LandmarkRoomKind } from '@/lib/game/landmarks/interiors'
import { landmarkFacts, landmarkLabel } from '@/lib/worldlab/landmarks'
import { buildingSizeLine, buildingUseLine } from '@/lib/worldlab/buildingUse'
import type { BlockKind } from '@/lib/worldlab/simplify'
import type { GeoPoint } from '@/lib/worldlab/mercator'
import type { NoxiaBuilding, WorldEngine, WorldLandmark, WorldPick, WorldPlot, WorldSite } from './worldEngine'
import LandmarkGlyph from './LandmarkGlyph'

export type Panel =
  | { kind: 'none' }
  | { kind: 'person'; id: string }
  | { kind: 'building'; at: GeoPoint; title: string; address?: string; noxiaId?: string; source?: string; areaM2?: number; levels?: number; block?: BlockKind; poi?: WorldLandmark; /** Nutzung aus OSM (`buildingUse.ts`) und OSM-Name des Hauses */ use?: string; osmName?: string }
  | { kind: 'landmark'; landmark: WorldLandmark }
  | { kind: 'site'; id: string }
  | { kind: 'plot'; source: string }
  | { kind: 'parcel'; id: string; at: GeoPoint }
  | { kind: 'inside'; request: BuildingEntryRequest; companionId: string | null }
  | { kind: 'landmarkInside'; room: LandmarkRoomKind; landmark: WorldLandmark }

const TALK_RANGE_M = 8
const ENTER_RANGE_M = 8
/** Wahrzeichen: Abstand zum Schild (es steht meist mitten im Gebäude). */
const LANDMARK_ENTER_M = 14
/** Kennung eines Wahrzeichens als Gesprächsziel. */
function landmarkRef(landmark: WorldLandmark) { return `landmark:${landmark.at.lat.toFixed(6)},${landmark.at.lon.toFixed(6)}` }
const BLOCK_NAMES: Record<BlockKind, string> = { house: 'Wohnhaus', row: 'Mehrfamilienhaus', hall: 'Halle', factory: 'Fabrik', church: 'Kirche', shed: 'Schuppen' }

function role(resident: ColonyResident) { return resident.assignments.find(item => item.type === 'work')?.roleCode ?? resident.activityState ?? 'general' }

/** Tafel zu einem Klick auf der Karte (Boden schließt die Tafel). */
export function panelForPick(pick: WorldPick, noxia: NoxiaBuilding[]): Panel {
  if (pick.type === 'person') return { kind: 'person', id: pick.id }
  if (pick.type === 'ground') return { kind: 'none' }
  if (pick.type === 'landmark') return { kind: 'landmark', landmark: pick.landmark }
  if (pick.type === 'site') return { kind: 'site', id: pick.id }
  if (pick.type === 'plot') return { kind: 'plot', source: pick.source }
  if (pick.type === 'parcel') return { kind: 'parcel', id: pick.id, at: pick.at }
  // Ein Wahrzeichen-Gebäude (Kirche, Bibliothek) öffnet das Wahrzeichen, außer es ist ein NOXIA-Gebäude.
  if (pick.type === 'building' && pick.landmark && !pick.noxiaId) return { kind: 'landmark', landmark: pick.landmark }
  const own = pick.noxiaId ? noxia.find(building => building.id === pick.noxiaId) : undefined
  if (pick.type === 'noxia') return own ? { kind: 'building', at: { lat: own.lat, lon: own.lon }, title: own.name, noxiaId: own.id } : { kind: 'none' }
  return { kind: 'building', at: pick.at, title: own?.name ?? pick.name ?? BLOCK_NAMES[pick.kind], address: pick.address, noxiaId: own?.id, source: pick.source, areaM2: pick.areaM2, levels: pick.levels, block: pick.kind, poi: pick.poi, use: pick.use, osmName: pick.name }
}

type Line = { role: 'user' | 'assistant'; content: string }

/**
 * Kaufangebot für ein reales Gebäude, das noch niemandem gehört (Request R-12 an
 * Bevölkerung und Ökonomie). Solange die Schnittstelle nicht antwortet, zeigt die
 * Tafel nichts zum Kauf.
 */
type Offer = { forSale: boolean; price?: number; seller?: string; residents?: number; newResidents?: number; rentPerInterval?: number; reason?: string; parcelId?: string; areaM2?: number; levels?: number; listed?: boolean; own?: boolean; entityId?: string }
/** Angebot für ein Flurstück (/api/game/parcel-offer) */
type ParcelInfo = { id: string; label: string; areaM2: number; usage: string | null; source?: string; owned: boolean; own: boolean; listed?: boolean; neighbours?: Array<{ id: string; label: string; areaM2: number }>; forSale: boolean; reason?: string; price?: number; seller?: string; buildings: Array<{ name: string; residents: number }>; residents: number; rentPerInterval: number }
/** Vermessungsgebühr fürs Teilen und Zusammenlegen (wie app/api/game/parcel-offer) */
const SURVEY_FEE = 200

function credits(value: number) { return Math.round(value).toLocaleString('de-DE') + ' Cr' }

/** Ab dieser Entfernung bietet die Tafel „Hinspringen“ statt nur „Gehe hin“. */
const JUMP_FROM_M = 1500

/** Ort einer Tafel (für Weg und Entfernung), wenn sie einen hat. */
export function panelLocation(panel: Panel, sites: WorldSite[], plots: WorldPlot[] = []): GeoPoint | null {
  if (panel.kind === 'parcel') return panel.at
  if (panel.kind === 'plot') { const plot = plots.find(item => item.source === panel.source); return plot ? { lat: plot.lat, lon: plot.lon } : null }
  if (panel.kind === 'building') return panel.at
  if (panel.kind === 'landmark') return panel.landmark.at
  if (panel.kind === 'site') return sites.find(site => site.id === panel.id)?.at ?? null
  return null
}

/** Baubarer Typ aus /api/game/build/spatial (available). */
type Buildable = { id: string; name: string; cost: number; footprint?: { widthM: number; depthM: number }; requirements?: { canBuild?: boolean; knowledgeOk?: boolean; creditsOk?: boolean } }

export default function WorldPanels({ engine, panel, setPanel, residents, noxia, sites, plots, onWorldChanged, onParcelsChanged, placeName, route, tick }: {
  engine: WorldEngine | null
  panel: Panel
  setPanel: (panel: Panel) => void
  residents: ColonyResident[]
  noxia: NoxiaBuilding[]
  sites: WorldSite[]
  /** Freie Flächen nach Abriss */
  plots: WorldPlot[]
  /** Nach Kauf, Abriss oder Bau: Gebäude und Baustellen neu holen. */
  onWorldChanged: () => void
  /** Flurstücksgrenzen geändert (Teilen, Zusammenlegen): Kacheln neu laden */
  onParcelsChanged?: () => void
  /** Ortsname der Gegend (z. B. „Sundern“). */
  placeName: string
  /** Gezeigter Weg zum Ziel der Tafel. */
  route: { lengthM: number; viaRoads: boolean } | null
  /** Steigt laufend (Anzeige der Karte), damit Abstände neu berechnet werden. */
  tick: number
}) {
  const [conversations, setConversations] = useState<Record<string, Line[]>>({})
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [walking, setWalking] = useState(false)
  /** Wer gerade wohin unterwegs ist (aus einem Gespräch): Person → NOXIA-Gebäude. */
  const [visits, setVisits] = useState<Record<string, string>>({})
  /** Namen von Zielen, die keine NOXIA-Gebäude sind (Wahrzeichen). */
  const [visitNames, setVisitNames] = useState<Record<string, string>>({})
  /** Wer gerade vorausgeht */
  const [leading, setLeading] = useState<Record<string, boolean>>({})
  const [offers, setOffers] = useState<Record<string, Offer | null>>({})
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')
  const [confirmDemolish, setConfirmDemolish] = useState(false)
  const [buildables, setBuildables] = useState<Buildable[] | null>(null)
  const [parcelInfo, setParcelInfo] = useState<Record<string, ParcelInfo | null>>({})
  const [parcelVersion, setParcelVersion] = useState(0)
  const parcelId = panel.kind === 'parcel' ? panel.id : null
  useEffect(() => {
    if (!parcelId) return
    let stale = false
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        const response = await fetch('/api/game/parcel-offer?id=' + encodeURIComponent(parcelId), { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' })
        const json = response.ok ? await response.json().catch(() => null) : null
        if (!stale) setParcelInfo(current => ({ ...current, [parcelId]: json && typeof json.forSale === 'boolean' ? json as ParcelInfo : null }))
      } catch { if (!stale) setParcelInfo(current => ({ ...current, [parcelId]: null })) }
    })()
    return () => { stale = true }
  }, [parcelId, parcelVersion])
  const parcel = parcelId ? parcelInfo[parcelId] : undefined

  async function buyParcel() {
    if (!parcelId || buying) return
    setBuying(true); setBuyError('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/parcel-offer', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parcelId, price: parcel?.price }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setBuyError(String(json.error ?? 'Kauf nicht möglich.')); return }
      await engine?.reloadNoxia()
      onWorldChanged()
      setParcelVersion(value => value + 1)
    } catch { setBuyError('Kauf derzeit nicht erreichbar.') } finally { setBuying(false) }
  }

  // Verkaufen an andere Spieler: Wunschpreis
  const [askPrice, setAskPrice] = useState('')
  /** Flurstück: anbieten, zurückziehen, teilen, zusammenlegen. */
  async function parcelAction(body: Record<string, unknown>, failText: string) {
    if (!parcelId || buying) return
    setBuying(true); setBuyError('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/parcel-offer', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parcelId, ...body }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setBuyError(String(json.error ?? failText)); return }
      setAskPrice('')
      if (Array.isArray(json.parcels) && json.parcels[0]?.id && panel.kind === 'parcel') {
        // Neue Grenzen: Kacheln neu, Tafel zeigt das Stück an der angeklickten Stelle (oder das erste)
        onParcelsChanged?.()
        setParcelInfo({})
        setPanel({ kind: 'parcel', id: String(json.parcels[0].id), at: panel.at })
        return
      }
      setParcelVersion(value => value + 1)
    } catch { setBuyError(failText) } finally { setBuying(false) }
  }
  /** Eigenes Haus (ohne Kataster) anbieten/zurückziehen oder ein angebotenes kaufen. */
  async function buildingSale(body: Record<string, unknown>, source: string, failText: string) {
    if (buying) return
    setBuying(true); setBuyError('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/building-offer', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setBuyError(String(json.error ?? failText)); return }
      setAskPrice('')
      setOffers(current => { const next = { ...current }; delete next[source]; return next })
      if (body.action === 'buy-listed') { await engine?.reloadNoxia(); onWorldChanged() }
    } catch { setBuyError(failText) } finally { setBuying(false) }
  }

  const [conversions, setConversions] = useState<Record<string, Array<{ id: string; name: string; cost: number }>>>({})
  const [showConversions, setShowConversions] = useState(false)

  const person = panel.kind === 'person' ? residents.find(resident => resident.id === panel.id) ?? null : null
  const building = panel.kind === 'building' ? panel : null
  const own = building?.noxiaId ? noxia.find(item => item.id === building.noxiaId) ?? null : null
  const entry = own ? getBuildingEntryDefinition(own.typeId) : null
  const landmark = panel.kind === 'landmark' ? panel.landmark : null
  const room = landmark ? landmarkRoomKind(landmark.kind) : null

  // Abstände je Anzeige neu (tick)
  const personDistance = useMemo(() => {
    void tick
    if (!person || !engine) return null
    const at = engine.personAt(person.id)
    return at ? engine.distanceTo(at) : null
  }, [person, engine, tick])
  const buildingDistance = useMemo(() => {
    void tick
    if (!building || !engine) return null
    // Rand statt Mitte: halbe Größe abziehen, sonst ist man bei großen Bauten nie „nah“.
    const half = own ? Math.max(own.w, own.d) / 2 : 6
    return Math.max(0, engine.distanceTo(building.at) - half)
  }, [building, own, engine, tick])
  const landmarkDistance = useMemo(() => {
    void tick
    return landmark && engine ? engine.distanceTo(landmark.at) : null
  }, [landmark, engine, tick])
  const landmarkNear = landmarkDistance !== null && landmarkDistance <= LANDMARK_ENTER_M
  const site = panel.kind === 'site' ? sites.find(item => item.id === panel.id) ?? null : null
  const siteDistance = useMemo(() => { void tick; return site && engine ? engine.distanceTo(site.at) : null }, [site, engine, tick])
  /** Entfernung, Weg und – bei weiten Zielen – „Hinspringen“. */
  function away(distance: number | null, at: GeoPoint) {
    if (distance === null) return null
    const text = distance >= 1000 ? `${(distance / 1000).toFixed(1).replace('.', ',')} km entfernt` : `${Math.round(distance)} m entfernt`
    return <>{text}{route && route.lengthM > distance + 5 ? ` · Weg ${route.lengthM} m${route.viaRoads ? ' über Straßen' : ''}` : ''}{distance >= JUMP_FROM_M && <button className="link" onClick={() => engine?.jump(at)}>Hinspringen</button>}</>
  }

  // Jede neue Tafel beendet ein laufendes Hingehen und leert die Eingabe.
  const panelKey = panel.kind === 'person' ? 'p:' + panel.id : panel.kind === 'building' ? 'b:' + panel.at.lat + ',' + panel.at.lon : panel.kind === 'landmark' ? 'l:' + panel.landmark.at.lat + ',' + panel.landmark.at.lon : panel.kind === 'site' ? 's:' + panel.id : panel.kind === 'plot' ? 'f:' + panel.source : panel.kind === 'parcel' ? 'g:' + panel.id : panel.kind
  const [shownKey, setShownKey] = useState(panelKey)
  if (shownKey !== panelKey) { setShownKey(panelKey); setWalking(false); setMessage(''); setBuyError(''); setConfirmDemolish(false); setShowConversions(false); setAskPrice('') }

  // Kaufangebot je Gebäude einmal abfragen: reale Häuser mit OSM-Kennung – auch gekaufte (Angebote unter Spielern).
  const offerSource = building ? (building.noxiaId ? own?.source ?? null : building.source ?? null) : null
  useEffect(() => {
    if (!offerSource || !building || offerSource in offers) return
    let stale = false
    void (async () => {
      let offer: Offer | null = null
      try {
        const { token } = await getSessionInfo()
        const query = new URLSearchParams({ source: offerSource, lat: String(building.at.lat), lon: String(building.at.lon), areaM2: String(building.areaM2 ?? 0), levels: String(building.levels ?? 1), kind: building.block ?? 'house' })
        const response = await fetch('/api/game/building-offer?' + query, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        const json = response.ok ? await response.json().catch(() => null) : null
        offer = json && typeof json.forSale === 'boolean' ? json as Offer : null
      } catch { offer = null }
      if (!stale) setOffers(current => ({ ...current, [offerSource]: offer }))
    })()
    return () => { stale = true }
  }, [offerSource, building, offers])
  const offer = offerSource ? offers[offerSource] ?? null : null
  // Reales Gebäude (aus den Kacheldaten, nicht nur ein NOXIA-Bild): Größe und heutige Nutzung aus OSM (W-4).
  const realUse = building?.block && building.areaM2
    ? buildingUseLine({ code: building.use, name: building.osmName, kind: building.block, poi: building.poi ? { name: building.poi.name, label: landmarkLabel(building.poi.kind, building.poi.tags) } : undefined })
    : null

  async function buy() {
    if (!building || !offerSource || buying) return
    setBuying(true); setBuyError('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/building-offer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: offerSource, lat: building.at.lat, lon: building.at.lon }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.entityId) { setBuyError(String(json.error ?? 'Kauf nicht möglich.')); return }
      setOffers(current => { const next = { ...current }; delete next[offerSource]; return next })
      await engine?.reloadNoxia()
      onWorldChanged()
      setPanel({ ...building, noxiaId: String(json.entityId) })
    } catch { setBuyError('Kauf derzeit nicht erreichbar.') } finally { setBuying(false) }
  }

  /** Eigenes gekauftes Gebäude abreißen; danach steht dort eine freie Fläche zum Bauen. */
  async function demolish(thenBuild: boolean) {
    if (!own?.own || !own.source || buying) return
    setBuying(true); setBuyError('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/building-offer', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'demolish', entityId: own.id }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setBuyError(String(json.error ?? 'Abriss nicht möglich.')); return }
      const source = own.source
      await engine?.reloadNoxia()
      onWorldChanged()
      setPanel(thenBuild ? { kind: 'plot', source } : { kind: 'none' })
    } catch { setBuyError('Abriss derzeit nicht erreichbar.') } finally { setBuying(false); setConfirmDemolish(false) }
  }

  // Umbauen: Nutzungen, die in das gekaufte Gebäude passen (halber Neubaupreis)
  const ownAcquiredId = own?.own && own.source ? own.id : null
  useEffect(() => {
    if (!ownAcquiredId || !showConversions || ownAcquiredId in conversions) return
    let stale = false
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        const response = await fetch('/api/game/building-offer?conversions=' + ownAcquiredId, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = response.ok ? await response.json() : null
        if (!stale) setConversions(current => ({ ...current, [ownAcquiredId]: Array.isArray(json?.conversions) ? json.conversions : [] }))
      } catch { if (!stale) setConversions(current => ({ ...current, [ownAcquiredId]: [] })) }
    })()
    return () => { stale = true }
  }, [ownAcquiredId, showConversions, conversions])
  // Bahnhof: wann der Zug fährt (Fahrplan nach Uhrzeit)
  const train = useMemo(() => { void tick; return building && engine ? engine.trainAt(building.title) : null }, [building, engine, tick])
  const minutes = (seconds: number) => seconds < 60 ? 'gleich' : `in ${Math.round(seconds / 60)} min`
  const residentsHere = own ? residents.filter(resident => resident.assignments.some(item => item.type === 'home' && item.tileEntityId === own.id)).length : 0

  async function convert(type: string) {
    if (!own || buying) return
    setBuying(true); setBuyError('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/building-offer', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'convert', entityId: own.id, type }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setBuyError(String(json.error ?? 'Umbau nicht möglich.')); return }
      setShowConversions(false)
      await engine?.reloadNoxia()
      onWorldChanged()
    } catch { setBuyError('Umbau derzeit nicht erreichbar.') } finally { setBuying(false) }
  }

  // Freie Fläche: was passt hier hin? (Bautypen der Erde, deren Grundfläche hineinpasst)
  const plot = panel.kind === 'plot' ? plots.find(item => item.source === panel.source) ?? null : null
  useEffect(() => {
    if (!(plot?.own || parcel?.own) || buildables) return
    let stale = false
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        const response = await fetch('/api/game/build/spatial?location=earth', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = response.ok ? await response.json() : null
        if (!stale) setBuildables(Array.isArray(json?.available) ? json.available : [])
      } catch { if (!stale) setBuildables([]) }
    })()
    return () => { stale = true }
  }, [plot?.own, parcel?.own, buildables])
  const fitting = useMemo(() => {
    if (!plot || !buildables) return []
    const long = Math.max(plot.w, plot.d) + 2, short = Math.min(plot.w, plot.d) + 2
    return buildables.filter(item => {
      const w = item.footprint?.widthM ?? 0, d = item.footprint?.depthM ?? 0
      return Math.max(w, d) <= long && Math.min(w, d) <= short
    }).sort((a, b) => a.cost - b.cost)
  }, [plot, buildables])

  /** Auf eigenem Flurstück bauen: an der angeklickten Stelle, ausgerichtet an der Straße (Drehung 0). */
  async function buildOnParcel(item: Buildable) {
    if (panel.kind !== 'parcel' || buying) return
    setBuying(true); setBuyError('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/build/spatial', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildableId: item.id, location: 'earth', latDeg: panel.at.lat, lonDeg: panel.at.lon, rotationDeg: 0 }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setBuyError(String(json.error ?? 'Bau nicht möglich.')); return }
      onWorldChanged()
      setPanel(json.buildId ? { kind: 'site', id: String(json.buildId) } : { kind: 'none' })
    } catch { setBuyError('Bauen derzeit nicht erreichbar.') } finally { setBuying(false) }
  }

  async function buildHere(item: Buildable) {
    if (!plot || buying) return
    setBuying(true); setBuyError('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/build/spatial', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildableId: item.id, location: 'earth', latDeg: plot.lat, lonDeg: plot.lon, rotationDeg: plot.rotation }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) { setBuyError(String(json.error ?? 'Bau nicht möglich.')); return }
      onWorldChanged()
      setPanel(json.buildId ? { kind: 'site', id: String(json.buildId) } : { kind: 'none' })
    } catch { setBuyError('Bauen derzeit nicht erreichbar.') } finally { setBuying(false) }
  }

  const close = useCallback(() => setPanel({ kind: 'none' }), [setPanel])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.('input,textarea,select')) return
      if (event.key === 'Escape' && panel.kind !== 'inside' && panel.kind !== 'landmarkInside') close()
      if ((event.key === 'f' || event.key === 'F' || event.key === 'Enter') && landmark && room && landmarkNear) setPanel({ kind: 'landmarkInside', room, landmark })
      if ((event.key === 'f' || event.key === 'F' || event.key === 'Enter') && panel.kind === 'building' && entry && own && buildingDistance !== null && buildingDistance <= ENTER_RANGE_M) enter()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function walkTo(target: () => GeoPoint | null, withinM: number) {
    if (!engine) return
    setWalking(true)
    engine.walkTo(target, withinM, () => setWalking(false))
  }

  function enter() {
    if (!own || !entry) return
    const companionId = Object.entries(visits).find(([, target]) => target === own.id)?.[0] ?? null
    setPanel({ kind: 'inside', request: { entityId: own.id, buildingTypeId: own.typeId, buildingName: own.name, kind: entry.kind }, companionId })
  }

  async function talk() {
    if (!person || !engine || !message.trim() || sending) return
    const playerMessage = message.trim().slice(0, 80)
    const history = conversations[person.id] ?? []
    // Was die Person von ihrem Platz aus sehen kann (45 m): NOXIA-Gebäude,
    // Wahrzeichen, Baustellen, Wasser, Wald – wie in der bisherigen Erdszene.
    const at = engine.personAt(person.id) ?? engine.position()
    const around = engine.surroundings(at, 45)
    const street = around.street ?? engine.nearestStreet()
    const metres = (target: GeoPoint) => Math.hypot((target.lat - at.lat) * 111320, (target.lon - at.lon) * 111320 * Math.cos(at.lat * Math.PI / 180))
    const places = [
      ...noxia.map(item => ({ targetRef: item.id, name: item.name, kind: item.typeId, distanceM: metres({ lat: item.lat, lon: item.lon }), status: 'aktiv' })),
      ...around.landmarks.map(item => ({ targetRef: landmarkRef(item.landmark), name: item.landmark.name, kind: landmarkLabel(item.landmark.kind, item.landmark.tags), distanceM: item.distanceM, status: 'sichtbar' })),
    ].filter(place => place.distanceM <= 45).sort((a, b) => a.distanceM - b.distanceM).slice(0, 10)
    const nearbyPlaces = places.map((place, index) => ({ key: 'p' + index, targetRef: place.targetRef, name: place.name, kind: place.kind, distanceM: Math.round(place.distanceM) }))
    const localFacts = [
      `Ort: ${placeName}`,
      ...(street ? [`Ihr steht an der ${street}.`] : []),
      ...(around.water ? ['Wasserlauf oder Wasserfläche in der Nähe'] : []),
      ...(around.forest ? ['Wald in der Nähe'] : []),
      ...places.map(place => `In der Nähe: ${place.name} · ${place.kind} · ca. ${Math.max(1, Math.round(place.distanceM))} m entfernt · ${place.status}`),
      ...sites.filter(item => metres(item.at) <= 45).map(item => `In der Nähe: ${item.name} · Baustelle · ca. ${Math.max(1, Math.round(metres(item.at)))} m entfernt · im Bau`),
    ].slice(0, 16)
    setSending(true)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/npc-conversation', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: playerMessage, npcId: person.id, npcName: person.displayName, npcRole: role(person),
          headline: `Gespräch auf der Straße${street ? ' – ' + street : ''}`, source: 'NOXIA Weltkarte',
          locationName: street ? `${street}, ${placeName}` : placeName, localFacts,
          nearbyPlaces, history,
        }),
      })
      const json = await response.json().catch(() => ({}))
      const reply = response.ok && json.reply ? String(json.reply) : 'Die Person kann gerade nicht antworten.'
      setConversations(current => ({ ...current, [person.id]: [...(current[person.id] ?? []), { role: 'user' as const, content: playerMessage }, { role: 'assistant' as const, content: reply }].slice(-10) }))
      if (response.ok) setMessage('')
      const action = json?.worldAction
      if (action?.type === 'visit_place') {
        const building = noxia.find(item => item.id === action.targetRef)
        const landmark = around.landmarks.find(item => landmarkRef(item.landmark) === action.targetRef)?.landmark
        const target = building ? { lat: building.lat, lon: building.lon } : landmark?.at
        if (target) {
          const seconds = Math.max(4, Math.min(35, Number(action.durationSeconds ?? 8)))
          engine.sendPerson(person.id, target, seconds)
          setVisits(current => ({ ...current, [person.id]: String(action.targetRef) }))
          if (landmark) setVisitNames(current => ({ ...current, [String(action.targetRef)]: landmark.name }))
          if (action.playerFollows) walkTo(() => engine.personAt(person.id), 3)
        }
      } else if (action?.type === 'lead_walk') {
        // Die Person geht wirklich voraus (wie in der bisherigen Erdszene); wer folgt, bleibt dicht dahinter.
        const seconds = Math.max(5, Math.min(60, Number(action.durationSeconds ?? 30)))
        const metres = Math.max(5, Math.min(80, Number(action.maxDistanceMeters ?? 45)))
        const id = person.id
        engine.leadPerson(id, metres, seconds)
        setLeading(current => ({ ...current, [id]: true }))
        if (action.playerFollows) walkTo(() => engine.personAt(id), 3)
        // Danach geht sie wieder ihrer Wege.
        setTimeout(() => { engine.releasePerson(id); setLeading(current => { const next = { ...current }; delete next[id]; return next }) }, (seconds + 20) * 1000)
      }
    } catch {
      setConversations(current => ({ ...current, [person.id]: [...(current[person.id] ?? []), { role: 'assistant' as const, content: 'Gespräch derzeit nicht erreichbar.' }].slice(-10) }))
    } finally { setSending(false) }
  }

  if (panel.kind === 'inside') {
    const companion = panel.companionId ? residents.find(resident => resident.id === panel.companionId) ?? null : null
    return <EarthBuildingAccessLayer request={panel.request} companion={companion} onClose={() => {
      // Wer mitgekommen ist, geht wieder seiner Wege.
      if (panel.companionId) { engine?.releasePerson(panel.companionId); setVisits(current => { const next = { ...current }; delete next[panel.companionId as string]; return next }) }
      close()
    }}/>
  }
  if (panel.kind === 'landmarkInside') {
    return <LandmarkWalkableInterior kind={panel.room} name={panel.landmark.name} typeLabel={landmarkLabel(panel.landmark.kind, panel.landmark.tags)} facts={landmarkFacts(panel.landmark.tags)} onClose={close}/>
  }
  if (panel.kind === 'none') return null

  return <aside className="world-panel" role="dialog">
    {person && <>
      <div className="head"><div><small>PERSON</small><b>{personSceneLabel(person)}</b><span>{role(person)}</span></div><button onClick={close} aria-label="Schließen">×</button></div>
      <dl><dt>Tut gerade</dt><dd>{leading[person.id] ? 'geht voraus' : visits[person.id] ? 'geht zu ' + (noxia.find(item => item.id === visits[person.id])?.name ?? visitNames[visits[person.id]] ?? 'einem Ort') : person.activityState}</dd><dt>Zuletzt</dt><dd>{person.lastAction ?? '–'}</dd></dl>
      {(conversations[person.id] ?? []).map((line, index) => <p key={index}><b>{line.role === 'user' ? 'Du' : personSceneLabel(person)}:</b> „{line.content}“</p>)}
      {personDistance !== null && personDistance <= TALK_RANGE_M
        ? <div className="row"><input value={message} maxLength={80} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void talk() }} placeholder="Ansprechen …" autoFocus/><button disabled={sending || !message.trim()} onClick={() => void talk()}>{sending ? '…' : 'Sprechen'}</button></div>
        : <div className="row"><span>{personDistance === null ? 'Nicht in Sichtweite.' : `${Math.round(personDistance)} m entfernt – zu weit zum Ansprechen.`}</span>{personDistance !== null && <button onClick={() => walkTo(() => engine?.personAt(person.id) ?? null, TALK_RANGE_M - 2)}>{walking ? 'Gehe …' : 'Gehe hin'}</button>}</div>}
    </>}
    {!person && panel.kind === 'person' && <div className="head"><div><small>PERSON</small><b>Nicht mehr da</b></div><button onClick={close}>×</button></div>}
    {building && <>
      <div className="head"><div><small>{own ? 'NOXIA-GEBÄUDE' : 'GEBÄUDE'}</small><b>{building.title}</b>{building.address && <span>{building.address}</span>}{building.poi && <span>Hier: {building.poi.name} · {landmarkLabel(building.poi.kind, building.poi.tags)}</span>}</div><button onClick={close} aria-label="Schließen">×</button></div>
      {realUse && <dl>
        <dt>Größe</dt><dd>{buildingSizeLine(offer?.areaM2 ?? building.areaM2 ?? 0, offer?.levels ?? building.levels ?? 1)}</dd>
        {!own?.own && <><dt>Nutzung</dt><dd>{realUse.text}</dd></>}
      </dl>}
      {own && entry
        ? (buildingDistance !== null && buildingDistance <= ENTER_RANGE_M
          ? <div className="row"><span>Du stehst davor.</span><button onClick={enter}>{entry.label}</button></div>
          : <div className="row"><span>{away(buildingDistance, building.at)}</span><button onClick={() => walkTo(() => building.at, (own ? Math.max(own.w, own.d) / 2 : 6) + ENTER_RANGE_M - 3)}>{walking ? 'Gehe …' : 'Gehe hin'}</button></div>)
        : <div className="row"><span>{own ? 'Dieses Gebäude kann man nicht betreten.' : building.address ? 'Privathaus.' : 'Keine Anschrift bekannt.'}</span><button onClick={() => walkTo(() => building.at, 10)}>{walking ? 'Gehe …' : 'Gehe hin'}</button></div>}
      {train && <div className="row"><span>Zug: {train.atStation ? `Der Zug steht am Gleis und fährt ${minutes(train.nextDepartureS)}.` : `Nächster Zug kommt ${minutes(train.nextArrivalS)}.`}</span></div>}
      {own?.own && own.source && <>
        <dl><dt>Eigentümer</dt><dd>du (gekauft)</dd><dt>Nutzung</dt><dd>{own.typeId === 'acquired_building' ? (realUse?.known ? `wie bisher: ${realUse.text}` : 'wie bisher') : own.name.split(' · ')[0] + (realUse?.known ? ` (vorher: ${realUse.text})` : '')}</dd><dt>Bewohner</dt><dd>{residentsHere || 'keine'}</dd></dl>
        {buyError && <p>{buyError}</p>}
        {!showConversions
          ? <div className="row"><span/><button disabled={buying} onClick={() => setShowConversions(true)}>Umbauen …</button></div>
          : <div className="build-list">
            {!(own.id in conversions) ? <p>Nutzungen werden geladen …</p>
              : conversions[own.id].length ? conversions[own.id].map(item => <div key={item.id} className="row"><span>{item.name} · {credits(item.cost)}</span><button disabled={buying} onClick={() => void convert(item.id)}>Umbauen</button></div>)
                : <p>Keine andere Nutzung passt in dieses Gebäude.</p>}
            <div className="row"><span>Hülle und Bewohner bleiben, halbe Baukosten.</span><button onClick={() => setShowConversions(false)}>Zurück</button></div>
          </div>}
        {!confirmDemolish
          ? <div className="row"><span>{residentsHere ? 'Beim Abriss ziehen die Bewohner in staatlichen Wohnraum.' : ''}</span><button disabled={buying} onClick={() => setConfirmDemolish(true)}>Abreißen …</button></div>
          : <div className="row"><span>Wirklich abreißen? Das lässt sich nicht rückgängig machen.</span><button disabled={buying} onClick={() => void demolish(false)}>Abreißen</button><button disabled={buying} onClick={() => void demolish(true)}>und neu bauen</button></div>}
        {offer?.parcelId
          ? <div className="row"><span>Verkauf nur mit dem Flurstück.</span><button onClick={() => setPanel({ kind: 'parcel', id: offer.parcelId!, at: building.at })}>Flurstück ansehen</button></div>
          : offer?.listed
            ? <div className="row"><span>Angeboten für {credits(offer.price ?? 0)}.</span><button disabled={buying} onClick={() => void buildingSale({ action: 'unlist', entityId: own.id }, own.source!, 'Zurückziehen nicht möglich.')}>Zurückziehen</button></div>
            : offer && <div className="row"><input value={askPrice} inputMode="numeric" onChange={event => setAskPrice(event.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="Preis in Cr"/><button disabled={buying || !Number(askPrice)} onClick={() => void buildingSale({ action: 'list', entityId: own.id, price: Number(askPrice) }, own.source!, 'Anbieten nicht möglich.')}>Zum Verkauf anbieten</button></div>}
      </>}
      {own && !own.own && offer?.parcelId && <div className="row"><span>Gehört mit dem Flurstück {offer.seller ?? 'einem anderen Spieler'}.</span><button onClick={() => setPanel({ kind: 'parcel', id: offer.parcelId!, at: building.at })}>Flurstück ansehen</button></div>}
      {own && !own.own && offer && !offer.parcelId && (offer.forSale
        ? <>
          <dl><dt>Eigentümer</dt><dd>{offer.seller}</dd><dt>Preis</dt><dd><b>{credits(offer.price ?? 0)}</b></dd></dl>
          <div className="row"><span>{buyError || `Angebot von ${offer.seller} – das Geld geht an ihn. Bewohner bleiben.`}</span><button disabled={buying} onClick={() => void buildingSale({ action: 'buy-listed', entityId: offer.entityId, price: offer.price }, own.source!, 'Kauf nicht möglich.')}>{buying ? '…' : 'Kaufen'}</button></div>
        </>
        : <div className="row"><span>Nicht verkäuflich: {offer.reason ?? 'gehört einem anderen Spieler'}</span></div>)}
      {!own && offer?.parcelId && <div className="row"><span>Wird mit dem Flurstück verkauft.</span><button onClick={() => setPanel({ kind: 'parcel', id: offer.parcelId!, at: building.at })}>Flurstück ansehen</button></div>}
      {!own && offer && !offer.parcelId && (offer.forSale
        ? <>
          <dl>
            <dt>Eigentümer</dt><dd>{offer.seller ?? 'Gemeinde'}</dd>
            <dt>Bewohner</dt><dd>{offer.residents ? `${offer.residents} – bleiben und zahlen Miete an dich` : 'keine'}</dd>
            {offer.rentPerInterval ? <><dt>Miete</dt><dd>{credits(offer.rentPerInterval)} je Abrechnung</dd></> : null}
            <dt>Preis</dt><dd><b>{credits(offer.price ?? 0)}</b></dd>
          </dl>
          <div className="row"><span>{buyError || 'Das Geld geht an die Gemeinde.'}</span><button disabled={buying} onClick={() => void buy()}>{buying ? '…' : 'Kaufen'}</button></div>
        </>
        : offer.reason ? <div className="row"><span>Nicht verkäuflich: {offer.reason}</span></div> : null)}
    </>}
    {landmark && <>
      <div className="head"><LandmarkGlyph kind={landmark.kind} tags={landmark.tags} size={34}/><div className="grow"><small>REALER ORT · {landmarkLabel(landmark.kind, landmark.tags).toUpperCase()}</small><b>{landmark.name}</b></div><button onClick={close} aria-label="Schließen">×</button></div>
      {landmark.tags.description && <p>{landmark.tags.description}</p>}
      {landmarkFacts(landmark.tags).length > 0 && <dl>{landmarkFacts(landmark.tags).map(fact => <Fragment key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></Fragment>)}</dl>}
      {room && landmarkNear
        ? <div className="row"><span>Du stehst davor.</span><button onClick={() => setPanel({ kind: 'landmarkInside', room, landmark })}>Betreten</button></div>
        : <div className="row"><span>{landmarkNear ? 'Ein eigener Innenraum für diesen Ort ist noch nicht gebaut.' : away(landmarkDistance, landmark.at)}</span>{!landmarkNear && <button onClick={() => walkTo(() => landmark.at, LANDMARK_ENTER_M - 3)}>{walking ? 'Gehe …' : 'Gehe hin'}</button>}</div>}
      <span className="source">Quelle: OpenStreetMap</span>
    </>}
    {panel.kind === 'parcel' && <>
      <div className="head"><div><small>FLURSTÜCK</small><b>{parcel?.label ?? 'Flurstück'}</b>{parcel && <span>{parcel.areaM2.toLocaleString('de-DE')} m²{parcel.usage ? ' · ' + parcel.usage : ''}</span>}</div><button onClick={close} aria-label="Schließen">×</button></div>
      {parcel === undefined && <p>Wird geladen …</p>}
      {parcel === null && <p>Keine Angaben zu diesem Flurstück.</p>}
      {parcel && <>
        <dl>
          <dt>Eigentümer</dt><dd>{parcel.own ? 'du' : parcel.owned ? (parcel.seller ?? 'ein anderer Spieler') : (parcel.seller ?? 'Gemeinde')}</dd>
          <dt>Gebäude</dt><dd>{parcel.buildings.length ? parcel.buildings.map(item => item.name).join(', ') : 'keine'}</dd>
          {parcel.residents > 0 && <><dt>Bewohner</dt><dd>{parcel.residents} – bleiben und zahlen Miete an dich</dd></>}
          {parcel.rentPerInterval > 0 && <><dt>Miete</dt><dd>{credits(parcel.rentPerInterval)} je Abrechnung</dd></>}
          {parcel.forSale && <><dt>Preis</dt><dd><b>{credits(parcel.price ?? 0)}</b></dd></>}
        </dl>
        {parcel.forSale && <div className="row"><span>{buyError || (parcel.listed ? `Angebot von ${parcel.seller} – das Geld geht an ihn, Häuser und Bewohner gehen mit.` : 'Das Geld geht an die Gemeinde.')}</span><button disabled={buying} onClick={() => void buyParcel()}>{buying ? '…' : 'Kaufen'}</button></div>}
        {!parcel.forSale && !parcel.own && <div className="row"><span>Nicht verkäuflich: {parcel.reason}</span></div>}
        {parcel.own && <>
          <p>Hier bauen (an der angeklickten Stelle):</p>
          {buildables === null ? <p>Bautypen werden geladen …</p> : <div className="build-list">{buildables.filter(item => (item.footprint?.widthM ?? 0) * (item.footprint?.depthM ?? 0) <= parcel.areaM2).sort((a, b) => a.cost - b.cost).map(item => <div key={item.id} className="row"><span>{item.name} · {credits(item.cost)}</span><button disabled={buying || item.requirements?.canBuild === false} onClick={() => void buildOnParcel(item)}>Bauen</button></div>)}</div>}
          {buyError && <p>{buyError}</p>}
          {parcel.listed
            ? <div className="row"><span>Angeboten für {credits(parcel.price ?? 0)}.</span><button disabled={buying} onClick={() => void parcelAction({ action: 'unlist' }, 'Zurückziehen nicht möglich.')}>Zurückziehen</button></div>
            : <div className="row"><input value={askPrice} inputMode="numeric" onChange={event => setAskPrice(event.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="Preis in Cr"/><button disabled={buying || !Number(askPrice)} onClick={() => void parcelAction({ action: 'list', price: Number(askPrice) }, 'Anbieten nicht möglich.')}>Zum Verkauf anbieten</button></div>}
          <p>Vermessen ({credits(SURVEY_FEE)} an die Gemeinde):</p>
          <div className="row"><span>Teilen an der angeklickten Stelle</span><button disabled={buying} onClick={() => void parcelAction({ action: 'split', at: panel.at, direction: 'across' }, 'Teilen nicht möglich.')}>quer</button><button disabled={buying} onClick={() => void parcelAction({ action: 'split', at: panel.at, direction: 'along' }, 'Teilen nicht möglich.')}>längs</button></div>
          {(parcel.neighbours ?? []).map(item => <div key={item.id} className="row"><span>Zusammenlegen mit {item.label} ({item.areaM2.toLocaleString('de-DE')} m²)</span><button disabled={buying} onClick={() => void parcelAction({ action: 'merge', with: item.id }, 'Zusammenlegen nicht möglich.')}>Zusammenlegen</button></div>)}
        </>}
        <span className="source">Quelle: {parcel.source ?? 'Liegenschaftskataster'}</span>
      </>}
    </>}
    {panel.kind === 'plot' && <>
      <div className="head"><div><small>FREIE FLÄCHE</small><b>{plot?.name ?? 'Freie Fläche'}</b>{plot && <span>{Math.round(plot.w)} × {Math.round(plot.d)} m · {plot.own ? 'dein Grundstück' : 'gehört einem anderen Spieler'}</span>}</div><button onClick={close} aria-label="Schließen">×</button></div>
      {plot?.own && (buildables === null ? <p>Bautypen werden geladen …</p>
        : fitting.length ? <div className="build-list">{fitting.map(item => <div key={item.id} className="row"><span>{item.name} · {credits(item.cost)}{item.requirements?.knowledgeOk === false ? ' · Wissen fehlt' : item.requirements?.creditsOk === false ? ' · zu teuer' : ''}</span><button disabled={buying || item.requirements?.canBuild === false} onClick={() => void buildHere(item)}>Bauen</button></div>)}</div>
          : <p>Kein Bautyp passt auf diese Fläche.</p>)}
      {buyError && <p>{buyError}</p>}
    </>}
    {panel.kind === 'site' && <>
      <div className="head"><div><small>BAUSTELLE</small><b>{site?.name ?? 'Baustelle'}</b>{site && <span>{site.phase}{site.progress !== null ? ` · ${Math.round(site.progress * 100)} %` : ''}</span>}</div><button onClick={close} aria-label="Schließen">×</button></div>
      {site && <div className="bar"><i style={{ width: `${Math.round((site.progress ?? 0) * 100)}%` }}/></div>}
      {site ? <div className="row"><span>{away(siteDistance, site.at)}</span>{siteDistance !== null && siteDistance > 12 && <button onClick={() => walkTo(() => site.at, 10)}>{walking ? 'Gehe …' : 'Gehe hin'}</button>}</div>
        : <div className="row"><span>Der Bau ist fertig.</span></div>}
    </>}
    <style jsx>{`
      .world-panel{position:relative;box-sizing:border-box;width:100%;min-height:0;overflow:auto;padding:12px 14px;background:#0d1c22ee;border:1px solid #40595a;border-radius:8px;color:#eef2ed;font:12px system-ui;z-index:5}
      .head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}
      .head small{display:block;font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .head b{display:block;font-size:15px}
      .head span{display:block;font-size:11px;color:#9fb5b0;margin-top:2px}
      .head .grow{flex:1}
      .source{display:block;margin-top:8px;font-size:10px;color:#7f9792}
      .bar{height:6px;border-radius:3px;background:#2d2410;overflow:hidden;margin:6px 0}
      .bar i{display:block;height:100%;background:#f0d27a}
      .row .link{border:0;background:none;color:#d9bb6a;padding:0 0 0 6px;font-size:11px;font-weight:700;cursor:pointer;text-decoration:underline}
      .head button{border:0;background:none;color:#9fb5b0;font-size:18px;cursor:pointer;line-height:1}
      dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:4px 0 8px;font-size:11px}
      dt{color:#9fb5b0}dd{margin:0}
      p{margin:4px 0;font-size:11.5px;line-height:1.45}
      .row{display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap}
      .build-list{max-height:220px;overflow:auto}
      .row span{flex:1;font-size:11px;color:#9fb5b0}
      .row input{flex:1;min-width:0;border:1px solid #40595a;background:#08151a;color:#fff;border-radius:5px;padding:6px 8px;font-size:12px}
      .row button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
      .row button:disabled{opacity:.5;cursor:default}
      
    `}</style>
  </aside>
}
