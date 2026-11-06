'use client'

// app/world-lab/WorldLab.tsx
// Aktualisiert: 06.11.2026 — Eigenes Auto geparkt auf der Karte (useVehicle → setOwnVehicle); Personen mit Auto fahren ihren Arbeitsweg sichtbar; 06.11.2026 — Fahrzeug: Ankunftsmeldung nach „Hinfahren“ (onNote an WorldPanels)
// Version:      1.2.0
// Weltkarte „eine Welt“ mit PixiJS – eigene Seite /world-lab und im Spiel
// neben der bisherigen Erdszene. Personen, Ansprechen und Betreten in
// WorldPanels.tsx (immer nur eine Tafel offen).
//
// Was hier anders ist als in der begehbaren Szene:
//   - Es gibt keine Szene, die ersetzt wird. Die Welt besteht aus Kacheln, die
//     um die Spielfigur herum dazukommen und hinter ihr wieder wegfallen.
//   - Gezeichnet wird über die Grafikkarte; Bewegung läuft je Bild, nicht je Tastendruck.
//   - Reale Orte sind stark vereinfacht: Blöcke aus einem Baukasten (lib/worldlab/blocks.ts).

import { landmarkRoomKind } from '@/lib/game/landmarks/interiors'
import { useVehicle } from '@/app/components/VehicleDesk'
import { bubbleDurationMs, bubbleText } from '@/lib/game/rounds/bubbles'
import type { PresenceRow } from '@/lib/game/population/placePresence'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useColonyStateStore, type ColonyResident } from '@/lib/store/colonyStateStore'
import { useEarthPlayerPositionStore } from '@/lib/store/earthPlayerPositionStore'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import TimeSlider from './TimeSlider'
import WorldPanels, { panelForPick, panelLocation, type Panel } from './WorldPanels'
import { constructionState } from '@/lib/game/constructionProgress'
import { landmarkLabel } from '@/lib/worldlab/landmarks'
import { kieselLookFor } from '@/lib/figures/kiesel'
import { workPoseFor } from '@/lib/figures/workPose'
import { useMyLook } from '@/lib/figures/KieselFigure'
import { useMapPresence } from '@/lib/multiplayer/mapPresence'
import { eventLine, eventRunning, upcoming, VENUE_EVENT_KINDS, whenText, type VenueEvent } from '@/lib/game/hospitality/venueEvents'
import { DEFAULT_VIEW, loadView, saveView, showPlace, type ViewOptions } from '@/lib/worldlab/viewOptions'
import { worshipWhen, type WorshipItem } from '@/lib/worldlab/worshipTypes'
import { MEETING_WALK_LIMIT_M, meetingPlaces, nearestMeetingPlace, type MeetingPlace } from '@/lib/worldlab/meetingPlaces'
import { getSessionInfo } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { getBuildingEntryDefinition } from '@/lib/game/buildings/entry'
import { PLANTS } from '@/lib/worldlab/plants'
import { loadReferral, REFERRAL_VALID_MS, referralTitle, referralValid, type JobReferral } from '@/lib/game/jobs/referral'
import { awarenessConversationForResident } from '@/lib/game/npcAwarenessConversation'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'
import { blockArt } from '@/lib/worldlab/blocks'
import { detailCell } from '@/lib/worldlab/detailCells'
import { hasCadastre, parcelCell } from '@/lib/worldlab/alkis'
import type { GeoPoint } from '@/lib/worldlab/mercator'
import type { SimplifiedTile } from '@/lib/worldlab/simplify'
import type { EarthTrip } from '@/app/components/TravelAgency'
import { startWorldEngine, type Hud, type NoxiaBuilding, type WorldEngine, type WorldPerson, type WorldPick, type WorldPlot, type WorldSite } from './worldEngine'

/** Ein laufender Bau aus /api/game/build/spatial (nur die Felder, die die Karte braucht). */
type BuildRow = { id: string; name?: string; buildable_id: string; status?: string; created_at?: string; completes_at?: string; latitude_deg?: number | null; longitude_deg?: number | null; footprint_width_m?: number | null; footprint_depth_m?: number | null; rotation_deg?: number | null }

const MEETING_GROUP = 'Omnizedenz-Begegnungsstätten'
const EVENTS_GROUP = 'Was ist los?'
const WORSHIP_GROUP = 'Gottesdienste und Gebete'
/** Gotteshaus als Wahrzeichen (für Tafel und Innenraum seiner Religion). */
function worshipLandmark(item: WorshipItem) {
  const religion = item.tradition === 'catholic' || item.tradition === 'protestant' ? 'christian' : item.tradition
  return { at: item.at!, name: item.name, kind: 'place_of_worship', tags: { religion, ...(item.tradition === 'catholic' ? { denomination: 'catholic' } : item.tradition === 'protestant' ? { denomination: 'protestant' } : {}) } }
}
function worshipPanel(item: WorshipItem): Panel {
  return { kind: 'landmark', landmark: worshipLandmark(item), source: item.source ?? undefined }
}
const metresBetween = (a: GeoPoint, b: GeoPoint) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180))
const kmText = (m: number) => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m) + ' m'

const PLACES: Array<{ label: string; at: GeoPoint }> = [
  { label: 'Sundern Mitte', at: { lat: 51.3262, lon: 8.0 } },
  // Startcafé, Hauptstraße 72 (seit 25.10.2026 im realen Haus)
  { label: 'Café', at: { lat: 51.32565, lon: 8.00418 } },
  // Staatliche Basis am Segelfluggelände Seidfeld (seit 28.10.2026, vorher Selmecke)
  { label: 'Raumhafen Seidfeld', at: { lat: 51.3024, lon: 7.9790 } },
]
/** Ohne gespeicherte Position beginnt man am Startcafé (27.10.2026: vorher „Sundern Mitte“, rund 300 m entfernt). */
const START_PLACE = PLACES.find(place => place.label === 'Café') ?? PLACES[0]

/**
 * `embedded`: im Spiel unter der oberen Leiste statt als eigene Seite; `onLeave`
 * führt dann zurück zur bisherigen Erdszene statt zum Dashboard.
 */
/**
 * Wer ein Auto hat: Personen mit Arbeitsplatz, fest nach ihrer Kennung (etwa sechs von zehn).
 * Platzhalter, bis die Personensimulation Fahrzeuge selbst vergibt – aber je Person fest,
 * keine Kulisse: dieselbe Person fährt immer dasselbe Auto denselben Weg.
 */
function ownsVehicle(resident: { id: string; assignments: Array<{ type: string }> }) {
  if (!resident.assignments.some(item => item.type === 'work')) return false
  let h = 2166136261
  for (let i = 0; i < resident.id.length; i++) h = Math.imul(h ^ resident.id.charCodeAt(i), 16777619)
  return (h >>> 0) % 10 < 6
}

export default function WorldLab({ embedded = false, onLeave, onPlanning, residents: givenResidents }: { embedded?: boolean; onLeave?: () => void; onPlanning?: () => void; residents?: ColonyResident[] } = {}) {
  const host = useRef<HTMLDivElement | null>(null)
  const engine = useRef<WorldEngine | null>(null)
  const [engineReady, setEngineReady] = useState<WorldEngine | null>(null)
  const [hud, setHud] = useState<Hud | null>(null)
  /** Eigenes Profil für die Kartenanwesenheit (W-16) */
  const [me, setMe] = useState<{ profileId: string; name: string } | null>(null)
  const [tick, setTick] = useState(0)
  const [panel, setPanel] = useState<Panel>({ kind: 'none' })
  // Neuer Spieler: nach dem Onboarding den Innenraum des Startcafés öffnen (?starterCafe=<id>).
  const starterCafe = useRef<string | null | undefined>(undefined)
  const [noxia, setNoxia] = useState<NoxiaBuilding[]>([])
  const noxiaRef = useRef<NoxiaBuilding[]>([])
  const [surfacePeople, setSurfacePeople] = useState<PresenceRow[]>([])
  // Gottesdienste und Gebete (28.10.2026): wo, wann, läuft gerade – jede Minute neu.
  const [worship, setWorship] = useState<WorshipItem[]>([])
  // Tätigkeit, Schlaf und Wohnung je Person (für sichtbare Wege, 28.10.2026)
  const [surfaceStates, setSurfaceStates] = useState<Array<{ id: string; activityState: string; asleep: boolean; home: { lat: number; lon: number } | null }>>([])
  // Entwicklerdinge (Messwerte, Nachladen, alte Szene) nur mit ?dev=1 – einmal gesetzt, bleibt es (W-2).
  const [dev] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const flag = new URLSearchParams(window.location.search).get('dev')
      if (flag === '1') window.localStorage.setItem('noxia-world-dev', '1')
      if (flag === '0') window.localStorage.removeItem('noxia-world-dev')
      return !embedded || window.localStorage.getItem('noxia-world-dev') === '1'
    } catch { return !embedded }
  })
  const [devOpen, setDevOpen] = useState(!embedded)
  // Bedienhinweise nur beim ersten Öffnen, danach hinter „?“
  // Was die Karte beschriftet (28.10.2026): Straßennamen, Orte aus OSM – gilt auch für die Zielliste
  const [view, setViewState] = useState<ViewOptions>(DEFAULT_VIEW)
  const [viewOpen, setViewOpen] = useState(false)
  const viewRef = useRef<ViewOptions>(DEFAULT_VIEW)
  useEffect(() => { const stored = loadView(); viewRef.current = stored; setViewState(stored) }, [])
  function changeView(next: ViewOptions) { viewRef.current = next; setViewState(next); saveView(next); engine.current?.setView(next) }
  const [helpOpen, setHelpOpen] = useState(() => { try { return typeof window !== 'undefined' && window.localStorage.getItem('noxia-world-help-v1') !== 'seen' } catch { return false } })
  function closeHelp() { setHelpOpen(false); try { window.localStorage.setItem('noxia-world-help-v1', 'seen') } catch { /* ohne Speicher */ } }
  // Erster Start (05.11.2026, nach Forge of Empires): ein Pfeil zum ersten Ziel, ein Satz dazu.
  // Für neue Spieler (Hilfe noch nicht gesehen) oder mit ?guide=1 zum Ausprobieren.
  const [guideOn, setGuideOn] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      if (new URLSearchParams(window.location.search).get('guide') === '1') return true
      return window.localStorage.getItem('noxia-world-guide-v1') !== 'done' && window.localStorage.getItem('noxia-world-help-v1') !== 'seen'
    } catch { return false }
  })
  function finishGuide() { setGuideOn(false); try { window.localStorage.setItem('noxia-world-guide-v1', 'done') } catch { /* ohne Speicher */ } }
  /** Kurzer Satz für Spieler (Einzelheiten gehen in die Konsole). */
  const [playerNote, setPlayerNote] = useState('')
  // Reise auf der Erde (Reisebüro, 27.10.2026): während der Fahrt ist die Karte gesperrt, bei Ankunft springt die Figur.
  const [trip, setTrip] = useState<EarthTrip | null>(null)
  const [tripNow, setTripNow] = useState(() => Date.now())
  const [destination, setDestination] = useState('')
  const [destinationNote, setDestinationNote] = useState('')
  const [placeName, setPlaceName] = useState('')
  const placeAt = useRef<GeoPoint | null>(null)
  const [builds, setBuilds] = useState<BuildRow[]>([])
  const [sites, setSites] = useState<WorldSite[]>([])
  const [hover, setHover] = useState<{ pick: WorldPick; x: number; y: number } | null>(null)
  const [targetId, setTargetId] = useState('')
  const [plots, setPlots] = useState<WorldPlot[]>([])
  // W-18: Veranstaltungen in Lokalen (aus /api/world-lab/buildings)
  const [events, setEvents] = useState<Array<VenueEvent & { lat: number; lon: number }>>([])
  // Zeitregler: Stand der Abrisse zu einem früheren Zeitpunkt (null = jetzt)
  const [asOf, setAsOf] = useState<string | null>(null)
  const [parcelOwners, setParcelOwners] = useState<Array<{ id: string; own: boolean }>>([])
  const [buildsVersion, setBuildsVersion] = useState(0)

  // Bewohner: im Spiel vom Dashboard gereicht, auf der eigenen Seite selbst geholt.
  const storeResidents = useColonyStateStore(state => state.residents)
  const refreshColony = useColonyStateStore(state => state.refresh)
  useEffect(() => { if (!givenResidents) void refreshColony('earth') }, [givenResidents, refreshColony])
  const residents = useMemo(() => givenResidents ?? storeResidents ?? [], [givenResidents, storeResidents])

  // Spielfigur: dieselbe Position wie in der bisherigen Erdszene (WGS84).
  const sharedGeo = useEarthPlayerPositionStore(state => state.geo)
  const setSharedPosition = useEarthPlayerPositionStore(state => state.setPosition)
  const sharedRegion = useEarthPlayerPositionStore(state => state.regionId)
  const sharedLocal = useEarthPlayerPositionStore(state => state.position)
  const startGeo = useRef(sharedGeo)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState<{ busy: boolean; text: string }>({ busy: false, text: '' })
  const busy = useRef(false)
  const tried = useRef(new Set<string>())
  const fresh = useRef('')
  /** Kacheln am Rand neu holen, ohne die Regionen auf dem Server neu zu lesen (Flurstücke, genaue Linien) */
  const bust = useRef('')

  /**
   * Holt für die Gegend um die Figur fehlende Kartendaten aus OpenStreetMap
   * (veraltete Regionen neu, Ortsdetail für die Zelle) und lädt die Kacheln neu.
   */
  async function refreshHere(reason: string) {
    const engine_ = engine.current
    if (!engine_ || busy.current) return
    const at = engine_.position()
    const cell = detailCell(at)
    tried.current.add(cell.lat + '/' + cell.lon)
    busy.current = true
    setRefresh({ busy: true, text: reason + ' – Kartendaten werden geholt …' })
    if (reason !== 'Start') setPlayerNote('Kartendaten für diese Gegend werden geholt …')
    try {
      const { token } = await getSessionInfo()
      if (!token) throw new Error('nicht angemeldet')
      const response = await fetch('/api/world-lab/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(at) })
      // Bei Zeitüberschreitung antwortet der Server mit einer Textseite statt JSON (W-2).
      const raw = await response.text()
      let json: { error?: string; regions?: Array<{ ok: boolean; error?: string }>; terrain?: { fetched: number; failed: number }; detail?: { ok?: boolean; cached?: boolean; total?: number; error?: string } } | null = null
      try { json = JSON.parse(raw) } catch { console.error('[world-lab] refresh: keine JSON-Antwort', response.status, raw.slice(0, 300)) }
      if (!response.ok || !json) throw new Error(json?.error ?? 'HTTP ' + response.status)
      const parts: string[] = []
      for (const region of json.regions ?? []) parts.push(region.ok ? 'Region erneuert' : 'Region nicht erneuert (' + (region.error ?? 'Fehler') + ')')
      if (json.terrain?.fetched) parts.push(json.terrain.fetched + ' Geländezellen geholt')
      if (json.terrain?.failed) parts.push(json.terrain.failed + ' Geländezellen nicht geholt')
      if (json.detail?.ok) parts.push(json.detail.cached ? 'Ortsdetail war schon da' : json.detail.total + ' Objekte Ortsdetail geholt')
      else parts.push('Ortsdetail nicht geholt (' + (json.detail?.error ?? 'Fehler') + ')')
      fresh.current = String(Date.now())
      engine.current?.reloadTiles()
      setRefresh({ busy: false, text: parts.join(' · ') })
      setPlayerNote(json.detail?.ok === false ? 'Kartendienst gerade nicht erreichbar – manche Häuser fehlen noch.' : '')
    } catch (reason) {
      console.error('[world-lab] Nachladen fehlgeschlagen', reason)
      setRefresh({ busy: false, text: 'Nachladen fehlgeschlagen: ' + String((reason as Error)?.message ?? reason) })
      setPlayerNote('Kartendienst gerade nicht erreichbar – manche Häuser fehlen noch.')
    } finally { busy.current = false }
  }

  // Selbsttätig: einmal beim Start (veraltete Regionen), danach in bebauten
  // Kacheln ohne Gebäude – je Zelle höchstens einmal je Besuch der Seite.
  const started = useRef(false)
  useEffect(() => {
    if (!hud || !engine.current) return
    if (!started.current) { started.current = true; void refreshHere('Start'); return }
    if (!hud.here.loaded || hud.here.blocks > 0 || !hud.here.built) return
    const cell = detailCell(engine.current.position())
    if (!tried.current.has(cell.lat + '/' + cell.lon)) void refreshHere('Hier fehlen Gebäude')
  }, [hud])

  // Neu verankerte Welt (Aufgabe 6): Steht die Figur weit vom Zeichenanker, wird
  // die Zeichenmaschine an ihrer Position neu gestartet, mit dem bisherigen Zoom.
  const [restartAt, setRestartAt] = useState<{ at: GeoPoint; zoom: number } | null>(null)

  useEffect(() => {
    let disposed = false
    ;(async () => {
      const PIXI = await import('pixi.js')
      if (disposed || !host.current) return
      const params = new URLSearchParams(window.location.search)
      const start: GeoPoint = restartAt ? restartAt.at : Number.isFinite(Number(params.get('lat'))) && params.get('lat')
        ? { lat: Number(params.get('lat')), lon: Number(params.get('lon')) }
        : startGeo.current ?? START_PLACE.at
      const started = await startWorldEngine(PIXI, {
        host: host.current,
        start,
        // Messschalter: ?aa=0 schaltet die Kantenglättung ab, ?res=1 begrenzt die Pixeldichte.
        settings: { antialias: params.get('aa') !== '0', maxResolution: Number(params.get('res')) || 2 },
        // Standard: eigene Zeichnungen, wo vorhanden, sonst die Vorlagen.
        // ?art=vorlage zeigt nur Vorlagen, ?art=farbe einfarbige Quader (zum Vergleichen der Bildrate).
        art: blockArt(params.get('art') === 'vorlage' ? 'template' : params.get('art') === 'farbe' ? 'none' : 'drawn'),
        loadTile: async tile => {
          const response = await fetch(`/api/world-lab/tile?x=${tile.x}&y=${tile.y}` + (fresh.current ? '&fresh=' + fresh.current : '') + (bust.current ? '&bust=' + bust.current : ''))
          if (!response.ok) throw new Error(String(response.status))
          return await response.json() as SimplifiedTile
        },
        loadNoxia: async () => {
          const { token } = await getSessionInfo()
          if (!token) return []
          const response = await fetch('/api/world-lab/buildings', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
          const json = response.ok ? await response.json() : null
          const list = (json?.buildings ?? []) as NoxiaBuilding[]
          noxiaRef.current = list
          if (!disposed) { setNoxia(list); setPlots(Array.isArray(json?.plots) ? json.plots : []); setParcelOwners(Array.isArray(json?.parcels) ? json.parcels : []); setEvents(Array.isArray(json?.events) ? json.events : []) }
          // Neuer Spieler: nach dem Onboarding den Innenraum des Startcafés öffnen (?starterCafe=<id>), einmal.
          if (starterCafe.current === undefined) {
            const params = new URLSearchParams(window.location.search)
            starterCafe.current = params.get('starterCafe')
            if (starterCafe.current) { params.delete('starterCafe'); window.history.replaceState(null, '', window.location.pathname + (params.size ? '?' + params : '') + window.location.hash) }
          }
          const cafe = starterCafe.current ? list.find(building => building.id === starterCafe.current) : undefined
          const cafeEntry = cafe ? getBuildingEntryDefinition(cafe.typeId) : null
          if (cafe && cafeEntry && !disposed) {
            starterCafe.current = null
            setPanel({ kind: 'inside', request: { entityId: cafe.id, buildingTypeId: cafe.typeId, buildingName: cafe.name, kind: cafeEntry.kind }, companionId: null })
          }
          return list
        },
        onPick: pick => { if (!disposed) { engine.current?.stopWalking(); setTargetId(''); setPanel(current => {
          const next = panelForPick(pick, noxiaRef.current)
          // Teilstück abstecken: Klick in dasselbe Flurstück verschiebt das Stück dorthin (03.11.2026)
          if (current.kind === 'land' && current.parentId && next.kind === 'parcel' && next.id === current.parentId) return { kind: 'land', at: next.at, parentId: current.parentId }
          return next
        }) } },
        onHover: next => { if (!disposed) setHover(next) },
        noxiaVisual: typeId => getBuildingVisual(typeId, 'earth'),
        onHud: next => { if (!disposed) { setHud(next); setTick(value => value + 1) } },
        onError: message => { if (!disposed) { setError(message); console.error('[world-lab]', message); setPlayerNote('Ein Teil der Karte konnte gerade nicht geladen werden.') } },
        zoom: restartAt?.zoom,
        view: viewRef.current,
        onFarFromAnchor: (at, zoom) => { if (!disposed) setRestartAt({ at, zoom }) },
      })
      if (disposed) { started.destroy(); return }
      engine.current = started
      setEngineReady(started)
    })().catch(reason => { if (!disposed) setError('Die Ansicht konnte nicht gestartet werden: ' + String(reason?.message ?? reason)) })

    return () => {
      disposed = true
      engine.current?.destroy()
      engine.current = null
      setEngineReady(null)
    }
  }, [restartAt])

  // Autoritative Personenpositionen der gemeinsamen Surface-Presence-Schicht.
  // Das deckt auch reale OSM-Orte ab, z. B. eine Arbeitszuweisung an eine Kirche,
  // ohne dafür ein künstliches NOXIA-Gebäude zu duplizieren.
  // Alle 30 s neu: Bei 60-facher Spielzeit wechselt jede Minute die Spielstunde,
  // und Leute gehen von der Wohnung zur Arbeit. Die Karte zeichnet den Weg dazwischen.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/world-lab/people', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        if (!response.ok) return
        const json = await response.json()
        if (cancelled) return
        setSurfacePeople(Array.isArray(json?.people) ? json.people : [])
        setSurfaceStates(Array.isArray(json?.states) ? json.states : [])
      } catch { /* World-Lab bleibt auch ohne Präsenzabruf nutzbar. */ }
    }
    void load()
    const timer = setInterval(() => { void load() }, 30000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/world-lab/worship', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        if (!response.ok) return
        const json = await response.json()
        if (!cancelled && Array.isArray(json?.items)) setWorship(json.items)
      } catch { /* ohne Termine bleibt die Karte nutzbar */ }
    }
    void load()
    const timer = setInterval(() => { void load() }, 60000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])
  // Bewohnerliste (Tätigkeit, Zuweisungen) ebenfalls nachladen, wenn die Karte sie selbst holt.
  useEffect(() => {
    if (givenResidents) return
    const timer = setInterval(() => { void refreshColony('earth', { background: true }) }, 60000)
    return () => clearInterval(timer)
  }, [givenResidents, refreshColony])

  // Personen auf die Karte: autoritative Surface-Präsenz hat Vorrang.
  // Fehlt sie, bleibt die bisherige Fallback-Regel über NOXIA-Zuhause/Arbeit;
  // nur ganz ohne Anker geht die Person die Straßen entlang.
  useEffect(() => {
    if (!engineReady) return
    const byId = new Map(noxia.map(building => [building.id, building]))
    const surfaceByPerson = new Map(surfacePeople.map(person => [person.id, person]))
    const stateByPerson = new Map(surfaceStates.map(person => [person.id, person]))
    // Wer an einem Haus mit Innenraum ist (Lokal, Kirche, Bibliothek …), steht nicht davor, sondern drinnen.
    const roomsNearby = engineReady.landmarks().filter(item => landmarkRoomKind(item.landmark.kind, item.landmark.tags)).map(item => item.landmark.at)
    const inRoom = (row: PresenceRow | undefined) => Boolean(row && (row.sourceKind === 'region_feature_anchor' || row.sourceKind === 'building_anchor') && roomsNearby.some(at => metresBetween(at, row) <= 45))
    const depthRank = (resident: ColonyResident) =>
      resident.personDepth?.level === 'focal' ? 3
      : resident.personDepth?.level === 'developed' ? 2
      : resident.personDepth?.level === 'situated' ? 1
      : 0
    const visibleResidents = [...residents]
      .sort((a, b) => depthRank(b) - depthRank(a) || (b.personDepth?.score ?? 0) - (a.personDepth?.score ?? 0) || a.id.localeCompare(b.id))
      .slice(0, 18)
    const people: WorldPerson[] = visibleResidents.map(resident => {
      const surface = surfaceByPerson.get(resident.id)
      const live = stateByPerson.get(resident.id)
      const place = resident.assignments.map(item => item.tileEntityId ? byId.get(item.tileEntityId) : undefined).find(Boolean)
      // Tätigkeit wie in der bisherigen Erdszene; wer in einem betretbaren Gebäude arbeitet, ist drinnen.
      // Die Präsenzabfrage ist frischer als die Bewohnerliste und hat daher Vorrang.
      const state = String(live?.activityState || resident.activityState || '').toLowerCase()
      const atWork = /work|produc|serv|operat/.test(state)
      const activity: WorldPerson['activity'] = /travel|move|commut|deliver|patrol/.test(state) ? 'move' : atWork ? 'work' : /idle|rest|sleep/.test(state) ? 'idle' : 'other'
      const workplace = resident.assignments.map(item => item.type === 'work' && item.tileEntityId ? byId.get(item.tileEntityId) : undefined).find(Boolean)
      const inside = Boolean(atWork && workplace && getBuildingEntryDefinition(workplace.typeId))
      // Ohne autoritativen Ort: Schlafende bleiben in der Wohnung (nicht sichtbar),
      // wer frei hat, geht in der Nähe der Wohnung spazieren statt irgendwo in der Stadt.
      if (!surface && live?.home && (live.asleep || /rest|sleep/.test(state))) {
        return { id: resident.id, label: personSceneLabel(resident), activity: 'idle' as const, inside: true, anchor: live.home, anchorRadiusM: 5 }
      }
      if (!surface && live) {
        return { id: resident.id, label: personSceneLabel(resident), look: kieselLookFor({ id: resident.id, appearance: resident.appearance as never }), activity, inside: false, anchor: null, strollAround: live.home }
      }
      return {
        id: resident.id,
        label: personSceneLabel(resident),
        look: kieselLookFor({ id: resident.id, appearance: resident.appearance as never }, atWork ? workplace?.typeId ?? null : null),
        // Arbeit draußen vor dem Arbeitsort sichtbar (W-17)
        pose: atWork && !surface ? workPoseFor(workplace?.typeId ?? null) : null,
        activity, inside: inside || inRoom(surface),
        anchor: surface ? { lat: surface.lat, lon: surface.lon } : place ? { lat: place.lat, lon: place.lon } : null,
        anchorRadiusM: surface ? 3 : place ? Math.max(place.w, place.d) / 2 : undefined,
        vehicle: ownsVehicle(resident),
      }
    })
    engineReady.setPeople(people)
  }, [engineReady, residents, noxia, surfacePeople, surfaceStates, hud?.tiles])

  // Eigenes Auto: geparkt dort, wo die Datenbank es zuletzt kennt (Kauf, Ankunft).
  const { vehicle: ownVehicle } = useVehicle()
  const ownVehicleAt = ownVehicle?.at ?? null
  useEffect(() => { engineReady?.setOwnVehicle(ownVehicleAt) }, [engineReady, ownVehicleAt])

  // Im Innenraum steuert der Innenraum: Karte hört dann nicht auf Tasten und Klicks.
  useEffect(() => { engineReady?.setInputEnabled(!trip && panel.kind !== 'inside' && panel.kind !== 'landmarkInside') }, [engineReady, panel.kind, trip])
  // Offene Reise nach dem Laden wieder aufnehmen
  useEffect(() => {
    if (!engineReady) return
    let live = true
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const at = engineReady.position()
        const response = await fetch(`/api/game/earth-trip?lat=${at.lat}&lon=${at.lon}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = await response.json().catch(() => null)
        if (live && json?.trip) setTrip(json.trip as EarthTrip)
      } catch { /* ohne Verbindung keine Reise */ }
    })()
    return () => { live = false }
  }, [engineReady])
  // Fahrt: Restzeit zählen, bei Ankunft beim Server melden und an das Ziel springen
  useEffect(() => {
    if (!trip) return
    const timer = setInterval(() => setTripNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [trip])
  const tripLeft = trip ? Math.max(0, Math.ceil((new Date(trip.arrives_at).getTime() - tripNow) / 1000)) : 0
  const arriving = useRef(false)
  useEffect(() => {
    if (!trip || tripLeft > 0 || arriving.current) return
    arriving.current = true
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        const response = await fetch('/api/game/earth-trip', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'arrive' }) })
        const json = await response.json().catch(() => null)
        if (json?.arrived && json.trip) {
          engine.current?.jump({ lat: Number(json.trip.to_lat), lon: Number(json.trip.to_lon) })
          setPlayerNote(`Angekommen: ${json.trip.destination_name}.`)
          setTrip(null)
        } else if (json?.trip) setTrip(json.trip as EarthTrip)
        else setTrip(null)
      } catch { /* nächster Versuch beim nächsten Zählen */ } finally { arriving.current = false }
    })()
  }, [trip, tripLeft])


  // Name über der eigenen Figur (wie in der bisherigen Erdszene)
  useEffect(() => {
    if (!engineReady) return
    let live = true
    void (async () => {
      try {
        const { token, userId } = await getSessionInfo()
        const response = await fetch('/api/game/profile', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = response.ok ? await response.json() : null
        const name = String(json?.profile?.username ?? '').trim()
        if (live && name) engineReady.setPlayerName(name)
        if (live && userId) setMe({ profileId: userId, name: name || 'Spieler' })
      } catch { /* ohne Namen */ }
    })()
    return () => { live = false }
  }, [engineReady])

  // Ortsname: neu holen, wenn die Figur mehr als 500 m weitergegangen ist.
  useEffect(() => {
    if (!hud) return
    const here = { lat: hud.lat, lon: hud.lon }
    if (placeAt.current && metresBetween(placeAt.current, here) < 500) return
    placeAt.current = here
    void fetch(`/api/world-lab/where?lat=${here.lat.toFixed(3)}&lon=${here.lon.toFixed(3)}`)
      .then(response => response.ok ? response.json() : null)
      .then(json => setPlaceName(String(json?.name ?? '')))
      .catch(() => {})
  }, [hud])

  // Mitgehörte Gespräche (wie in der bisherigen Erdszene): reale Meldungen und NOXIA-Neuigkeiten.
  const [awareness, setAwareness] = useState<WorldAwarenessItem[]>([])
  useEffect(() => {
    let live = true
    void Promise.all([
      fetch('/api/game/world-awareness', { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
      fetch('/api/game/world', { cache: 'no-store' }).then(r => r.ok ? r.json() : { news: [] }).catch(() => ({ news: [] })),
    ]).then(([real, world]) => {
      if (!live) return
      const news = Array.isArray(world?.news) ? (world.news as Array<{ text?: string }>).slice(0, 8).map((item, index) => ({
        id: `noxia-world:${index}:${String(item?.text ?? '').slice(0, 24)}`, sourceId: 'noxia-world', title: String(item?.text ?? '').trim(), summary: '', url: '',
        publishedAt: new Date().toISOString(), topics: ['general'], kind: 'colony',
      } as unknown as WorldAwarenessItem)).filter(item => item.title) : []
      setAwareness([...news, ...(Array.isArray(real?.items) ? real.items : [])].slice(0, 28))
    })
    return () => { live = false }
  }, [])
  // Zwei Personen nah beieinander (bis 8 m), du bis 25 m daneben (Hörweite): du hörst mit.
  const overheard = useMemo(() => {
    void tick
    if (!engineReady || !awareness.length || panel.kind === 'person' || panel.kind === 'inside' || panel.kind === 'landmarkInside') return null
    const here = engineReady.position()
    const people = residents.slice(0, 18).flatMap(resident => { const at = engineReady.personAt(resident.id); return at ? [{ resident, at }] : [] })
    let best: { a: typeof people[number]; b: typeof people[number]; score: number; playerDistance: number } | null = null
    for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
      const pair = metresBetween(people[i].at, people[j].at)
      if (pair > 8) continue
      const playerDistance = Math.min(metresBetween(here, people[i].at), metresBetween(here, people[j].at))
      if (playerDistance > 25) continue
      const score = pair + playerDistance * 0.25
      if (!best || score < best.score) best = { a: people[i], b: people[j], score, playerDistance }
    }
    if (!best) return null
    const role = best.a.resident.assignments.find(item => item.type === 'work')?.roleCode ?? best.a.resident.activityState ?? 'general'
    const conversation = awarenessConversationForResident(best.a.resident.id, role, awareness, new Date().toISOString().slice(0, 10))
    return conversation ? { first: best.a.resident, second: best.b.resident, conversation, source: sourceForAwarenessItem(conversation.item), playerDistance: best.playerDistance } : null
  }, [tick, engineReady, awareness, panel.kind, residents])

  // Das mitgehörte Gespräch auch als Sprechblasen über den beiden Figuren: erst sagt die eine,
  // dann antwortet die andere; danach wird es still, bis ein anderes Gespräch in Hörweite kommt.
  const overheardKey = overheard ? overheard.first.id + '|' + overheard.second.id + '|' + overheard.conversation.opener : ''
  const overheardRef = useRef(overheard)
  useEffect(() => { overheardRef.current = overheard })
  useEffect(() => {
    const current = overheardRef.current
    if (!engineReady || !current) return
    const { first, second, conversation } = current
    const lines = [{ id: first.id, text: bubbleText(conversation.opener) }, { id: second.id, text: bubbleText(conversation.followUp) }]
    const timers: ReturnType<typeof setTimeout>[] = []
    let at = 600
    for (const line of lines) {
      const start = at
      timers.push(setTimeout(() => engineReady.speak(line.id, line.text), start))
      at += bubbleDurationMs(line.text)
      timers.push(setTimeout(() => engineReady.speak(line.id, null), at))
      at += 400
    }
    return () => { timers.forEach(clearTimeout); engineReady.speak(first.id, null); engineReady.speak(second.id, null) }
  }, [engineReady, overheardKey])

  // Bahnstrecken mit Zug: neu holen, wenn die Figur mehr als 3 km weitergegangen ist.
  const railAt = useRef<GeoPoint | null>(null)
  useEffect(() => {
    if (!hud || !engineReady) return
    const here = { lat: hud.lat, lon: hud.lon }
    if (railAt.current && metresBetween(railAt.current, here) < 3000) return
    railAt.current = here
    void fetch(`/api/world-lab/rail?lat=${here.lat.toFixed(3)}&lon=${here.lon.toFixed(3)}`)
      .then(response => response.ok ? response.json() : null)
      .then(json => { if (Array.isArray(json?.lines)) engineReady.setRailLines(json.lines) })
      .catch(() => {})
  }, [hud, engineReady])

  // Baustellen: eigene laufende Bauten (wie die bisherige Erdszene), alle 30 s neu.
  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/game/build/spatial?location=earth', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = response.ok ? await response.json() : null
        if (live && Array.isArray(json?.builds)) setBuilds(json.builds)
      } catch { /* nächster Versuch */ }
    }
    void load()
    const timer = setInterval(() => void load(), 30000)
    return () => { live = false; clearInterval(timer) }
  }, [buildsVersion])
  useEffect(() => { engineReady?.setPlots(plots) }, [engineReady, plots])
  useEffect(() => { engineReady?.setAsOf(asOf) }, [engineReady, asOf, plots])
  useEffect(() => { engineReady?.setParcelOwners(parcelOwners) }, [engineReady, parcelOwners])

  // Genaue Hauptstraßen, Kreisel und Gleise: Zelle um die Figur einmal je Besuch holen lassen; neue Daten → Kacheln neu.
  const lineCells = useRef(new Set<string>())
  useEffect(() => {
    if (!hud || !engineReady) return
    const here = { lat: hud.lat, lon: hud.lon }
    const cell = parcelCell(here)
    if (lineCells.current.has(cell.key)) return
    lineCells.current.add(cell.key)
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/world-lab/lines', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(here) })
        const json = await response.json().catch(() => null)
        if (json?.ok && !json.cached && json.lines > 0) { bust.current = String(Date.now()); engineReady.reloadTiles() }
        if (json && json.ok === false) console.error('[world-lab] Linien', json.error)
      } catch (reason) { console.error('[world-lab] Linien', reason) }
    })()
  }, [hud, engineReady])
  // W-13: Friedhofsflächen der Zelle einmal nachholen (fehlten in Sundern ganz)
  const areaCells = useRef(new Set<string>())
  useEffect(() => {
    if (!hud || !engineReady) return
    const here = { lat: hud.lat, lon: hud.lon }
    const cell = parcelCell(here)
    if (areaCells.current.has(cell.key)) return
    areaCells.current.add(cell.key)
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/world-lab/areas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(here) })
        const json = await response.json().catch(() => null)
        // Neue Flächen: Regionsdaten auf dem Server neu lesen (fresh), dann die Kacheln neu
        if (json?.ok && !json.cached && json.areas > 0) { fresh.current = String(Date.now()); engineReady.reloadTiles() }
        if (json && json.ok === false) console.error('[world-lab] Friedhöfe', json.error)
      } catch (reason) { console.error('[world-lab] Friedhöfe', reason) }
    })()
  }, [hud, engineReady])

  // Flurstücke (Länder mit offenem Kataster): Zelle um die Figur einmal je Besuch holen lassen; neue Daten → Kacheln neu.
  const parcelCells = useRef(new Set<string>())
  useEffect(() => {
    if (!hud || !engineReady) return
    const here = { lat: hud.lat, lon: hud.lon }
    if (!hasCadastre(here)) return
    const cell = parcelCell(here)
    if (parcelCells.current.has(cell.key)) return
    parcelCells.current.add(cell.key)
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/world-lab/parcels', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(here) })
        const json = await response.json().catch(() => null)
        if (json?.ok && !json.cached && json.parcels > 0) { bust.current = String(Date.now()); engineReady.reloadTiles() }
        if (json && json.ok === false) console.error('[world-lab] Flurstücke', json.error)
      } catch (reason) { console.error('[world-lab] Flurstücke', reason) }
    })()
  }, [hud, engineReady])
  // Fortschritt alle 5 s neu (aus Start- und Endzeit, nichts wird erfunden)
  useEffect(() => {
    const update = () => setSites(builds.flatMap(build => {
      const lat = Number(build.latitude_deg), lon = Number(build.longitude_deg)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || build.latitude_deg === null || build.longitude_deg === null) return []
      const state = constructionState({ buildable_id: build.buildable_id, tile_row: 0, tile_col: 0, status: build.status ?? 'building', created_at: build.created_at, completes_at: build.completes_at }, Date.now())
      return [{ id: build.id, name: String(build.name ?? build.buildable_id), at: { lat, lon }, w: Number(build.footprint_width_m ?? 18), d: Number(build.footprint_depth_m ?? 14), rotation: Number(build.rotation_deg ?? 0), progress: state.progress, phase: state.phaseLabel }]
    }))
    update()
    const timer = setInterval(update, 5000)
    return () => clearInterval(timer)
  }, [builds])
  useEffect(() => { engineReady?.setSites(sites) }, [engineReady, sites])

  // Erster Start: nächste Agentur für Arbeit bis 3 km
  const guideTarget = useMemo(() => {
    void tick
    if (!guideOn || !engineReady) return null
    let best: NoxiaBuilding | null = null, bestD = 3000
    for (const building of noxia) {
      if (building.typeId !== 'job_agency') continue
      const d = engineReady.distanceTo({ lat: building.lat, lon: building.lon })
      if (d < bestD) { bestD = d; best = building }
    }
    return best ? { building: best, distanceM: bestD } : null
  }, [guideOn, engineReady, noxia, tick])
  const guideShown = Boolean(guideTarget && !helpOpen && panel.kind !== 'inside' && !trip)
  const guideKey = guideShown && guideTarget ? guideTarget.building.id : ''
  useEffect(() => {
    if (!engineReady) return
    const building = guideKey ? noxia.find(item => item.id === guideKey) : undefined
    engineReady.setGuideArrow(building ? { lat: building.lat, lon: building.lon } : null)
  }, [engineReady, guideKey, noxia])
  // Angekommen oder hineingegangen: der Pfeil hat seinen Zweck erfüllt.
  useEffect(() => {
    if (!guideOn || !guideTarget) return
    const inside = panel.kind === 'inside' && panel.request.entityId === guideTarget.building.id
    if (!inside && guideTarget.distanceM >= 30) return
    const timer = setTimeout(() => {
      finishGuide()
      if (!inside) setPlayerNote('Du bist an der Agentur für Arbeit – klick auf das Haus und geh hinein.')
    }, 0)
    return () => clearTimeout(timer)
  }, [guideOn, guideTarget, panel])

  // W-12 Punkt 2 (05.11.2026): Solange ein Vermittlungsschein gilt, steht über dem
  // Lokal ein Schild; unten links eine kleine Karte mit „Weg zeigen“.
  const [referral, setReferral] = useState<JobReferral | null>(null)
  const [referralNow, setReferralNow] = useState(0)
  useEffect(() => {
    const read = () => { const ref = loadReferral(), now = Date.now(); setReferralNow(now); setReferral(current => {
      const next = referralValid(ref, now) ? ref : null
      return current?.buildingId === next?.buildingId && current?.issuedAtMs === next?.issuedAtMs ? current : next
    }) }
    read()
    const timer = setInterval(read, 5000)
    window.addEventListener('storage', read)
    return () => { clearInterval(timer); window.removeEventListener('storage', read) }
  }, [panel.kind])
  const referralBuilding = referral ? noxia.find(building => building.id === referral.buildingId) ?? null : null
  useEffect(() => {
    if (!engineReady) return
    engineReady.setJobMark(referral && referralBuilding ? { at: { lat: referralBuilding.lat, lon: referralBuilding.lon }, text: referral.roleLabel } : null)
  }, [engineReady, referral, referralBuilding])
  const referralLeft = referral ? Math.max(0, REFERRAL_VALID_MS - (referralNow - referral.issuedAtMs)) : 0

  // Weg zum Ort der offenen Tafel zeigen, sobald er mehr als 25 m entfernt ist.
  const routeTarget = panelLocation(panel, sites, plots)
  const routeKey = routeTarget ? routeTarget.lat.toFixed(6) + ',' + routeTarget.lon.toFixed(6) : ''
  const routeFar = Boolean(routeTarget && engineReady && engineReady.distanceTo(routeTarget) > 25)
  useEffect(() => {
    if (!engineReady) return
    engineReady.setRouteTarget(routeFar && routeKey ? { lat: Number(routeKey.split(',')[0]), lon: Number(routeKey.split(',')[1]) } : null)
  }, [engineReady, routeKey, routeFar])

  // Omnizedenz-Begegnungsstätten (Thomas, 28.10.2026: leicht findbar): Plakette auf
  // der Karte, eigene Gruppe in der Zielliste (jede Entfernung), Schnellknopf.
  const meeting = useMemo(() => meetingPlaces(noxia), [noxia])
  // Gotteshäuser auf der Erde (ohne Omnizedenz – die hat ihre Begegnungsstätten).
  const earthWorship = useMemo(() => worship.filter(item => item.location === 'earth' && item.at && item.tradition !== 'omnizedenz'), [worship])
  useEffect(() => {
    const runningAt = (source: string | null) => source ? worship.find(item => item.source === source && item.running)?.running ?? null : null
    engineReady?.setBeacons([
      ...meeting.map(place => {
        const now = runningAt(place.source)
        return {
          at: place.at,
          label: (place.town ? 'Omnizedenz · ' + place.town : 'Resonanzplatz') + (now ? ' · jetzt Runde' : ''),
          pick: place.noxiaId
            ? { type: 'noxia' as const, noxiaId: place.noxiaId, at: place.at }
            : { type: 'building' as const, at: place.at, address: place.address ?? undefined, name: place.name, kind: 'hall' as const, source: place.source ?? undefined, areaM2: 0, levels: 1 },
        }
      }),
      // Läuft ein Gottesdienst oder Gebet, steht eine goldene Plakette mit Glocke über dem Haus.
      ...earthWorship.filter(item => item.running).map(item => ({
        at: item.at!,
        tone: 'worship' as const,
        label: `Jetzt: ${item.running!.group}`,
        pick: { type: 'landmark' as const, landmark: worshipLandmark(item) },
      })),
    ])
  }, [engineReady, meeting, worship, earthWorship])
  function meetingPanel(place: MeetingPlace): Panel {
    return place.noxiaId
      ? { kind: 'building', at: place.at, title: place.name, noxiaId: place.noxiaId, address: place.address ?? undefined }
      : { kind: 'building', at: place.at, title: place.name, address: place.address ?? undefined, source: place.source ?? undefined, osmName: place.name }
  }
  /** Hingehen, wenn nah; sonst hinreisen (Bahn oder Flug), statt über Hunderte Kilometer zu laufen. */
  function openMeetingPlace(place: MeetingPlace) {
    const from = engine.current?.position()
    const distanceM = from ? metresBetween(from, place.at) : 0
    if (from && distanceM > MEETING_WALK_LIMIT_M) {
      choosePanel({ kind: 'travel', at: from })
      setDestinationNote(`${place.name} liegt in ${place.town || 'einem anderen Ort'} (${kmText(distanceM)}) – mit Bahn oder Flugzeug hinreisen, dann steht sie unter „Ziel“ in der Nähe.`)
      return
    }
    setDestinationNote(place.round ? `${place.name}: offene Resonanzrunde ${place.round}. Alle sind willkommen.` : '')
    choosePanel(meetingPanel(place))
  }

  // Zielliste: NOXIA-Gebäude (eigene zuerst), Baustellen, Wahrzeichen der Umgebung.
  const here = useMemo(() => hud ? { lat: hud.lat, lon: hud.lon } : null, [hud])
  // Liste nur neu, wenn die Figur gut 100 m weiter ist oder neue Kacheln da sind.
  const hereKey = here ? Math.round(here.lat * 1000) + ':' + Math.round(here.lon * 700) : ''
  const tilesLoaded = hud?.tiles ?? 0
  const targets = useMemo(() => {
    void hereKey; void tilesLoaded
    if (!here) return []
    const list: Array<{ id: string; label: string; distanceM: number; panel: Panel; group: string }> = []
    // Begegnungsstätten stehen immer in der Liste, auch weit weg (dann mit Reise).
    for (const place of meeting) list.push({ id: 'm:' + place.id, label: place.name + (place.town ? ' · ' + place.town : ''), distanceM: metresBetween(here, place.at), group: MEETING_GROUP, panel: meetingPanel(place) })
    // Gottesdienste und Gebete: mit nächstem Termin oder „jetzt“, nah zuerst.
    for (const item of earthWorship) list.push({ id: 'w:' + item.id, label: `${item.name} · ${worshipWhen(item)}`, distanceM: metresBetween(here, item.at!), group: WORSHIP_GROUP, panel: worshipPanel(item) })
    const meetingIds = new Set(meeting.map(place => place.noxiaId).filter(Boolean))
    for (const building of noxia) {
      if (meetingIds.has(building.id)) continue
      const distanceM = metresBetween(here, { lat: building.lat, lon: building.lon })
      if (distanceM <= 6000) list.push({ id: 'n:' + building.id, label: building.name + (building.own ? '' : ' · ' + (building.ownerLabel ?? 'NOXIA')), distanceM, group: building.own ? 'Deine Gebäude' : 'NOXIA-Gebäude', panel: { kind: 'building', at: { lat: building.lat, lon: building.lon }, title: building.name, noxiaId: building.id } })
    }
    for (const site of sites) list.push({ id: 's:' + site.id, label: site.name + ' · im Bau', distanceM: metresBetween(here, site.at), group: 'Baustellen', panel: { kind: 'site', id: site.id } })
    for (const item of engineReady?.landmarks() ?? []) if (showPlace(view, item.landmark)) list.push({ id: 'l:' + item.landmark.at.lat + ',' + item.landmark.at.lon, label: item.landmark.name + ' · ' + landmarkLabel(item.landmark.kind, item.landmark.tags), distanceM: item.distanceM, group: item.landmark.poi ? 'Läden und Lokale' : 'Orte', panel: { kind: 'landmark', landmark: item.landmark } })
    // W-18: „Was ist los?“ – Veranstaltungen in Lokalen bis 6 km, laufende zuerst
    for (const item of upcoming(events, Date.now(), 12) as typeof events) {
      const distanceM = metresBetween(here, { lat: item.lat, lon: item.lon })
      if (distanceM > 6000) continue
      const venue = noxia.find(building => building.id === item.tileEntityId)
      list.push({ id: 'e:' + item.id, label: `${VENUE_EVENT_KINDS[item.kind]?.icon ?? '•'} ${eventLine(item, Date.now())} · ${item.venueName ?? 'Lokal'}`, distanceM, group: EVENTS_GROUP,
        panel: venue ? { kind: 'building', at: { lat: venue.lat, lon: venue.lon }, title: venue.name, noxiaId: venue.id } : { kind: 'building', at: { lat: item.lat, lon: item.lon }, title: item.venueName ?? 'Lokal' } })
    }
    const rank = (group: string) => group === MEETING_GROUP ? 3 : group === EVENTS_GROUP ? 2 : group === WORSHIP_GROUP ? 1 : 0
    return list.sort((a, b) => rank(b.group) - rank(a.group) || a.group.localeCompare(b.group, 'de') || a.distanceM - b.distanceM)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noxia, sites, engineReady, hereKey, tilesLoaded, meeting, view, earthWorship, events])
  const groups = [...new Set(targets.map(target => target.group))]
  // W-17: eigene Figur als Kiesel, wie in den Innenräumen
  const myLook = useMyLook().look
  useEffect(() => { engineReady?.setPlayerLook(myLook) }, [engineReady, myLook])
  // W-16: andere Spieler in der Nähe (Realtime je Kartenzelle, nichts gespeichert); während einer Reise nicht
  const mapPresence = useMapPresence(hud && !trip ? { lat: hud.lat, lon: hud.lon } : null, me, myLook)
  useEffect(() => {
    engineReady?.setPeers(mapPresence.peers.map(peer => ({ id: peer.profileId, name: peer.name, at: { lat: peer.lat, lon: peer.lon }, look: peer.look, emote: peer.emote?.text ?? null })))
  }, [engineReady, mapPresence.peers])
  const peerGesture = useCallback((text: string) => { mapPresence.gesture(text); engineReady?.playerEmote(text) }, [mapPresence, engineReady])
  // W-18: Zeichen über Lokalen mit laufender oder heute beginnender Veranstaltung (minütlich neu)
  useEffect(() => {
    if (!engineReady) return
    const draw = () => {
      const now = Date.now()
      // je Lokal nur die nächste Veranstaltung
      const seen = new Set<string>()
      const marks = (upcoming(events, now, 50) as typeof events).filter(item => !seen.has(item.tileEntityId) && seen.add(item.tileEntityId)).map(item => ({
        id: item.id, lat: item.lat, lon: item.lon, running: eventRunning(item, now),
        text: `${VENUE_EVENT_KINDS[item.kind]?.icon ?? '•'} ${eventRunning(item, now) ? 'jetzt' : whenText(item.startsAt, now).replace(/^heute /, '')}`,
      }))
      engineReady.setEventMarks(marks)
    }
    draw()
    const timer = setInterval(draw, 60_000)
    return () => clearInterval(timer)
  }, [engineReady, events])
  const home = noxia.find(building => building.own) ?? null
  const nearestMeeting = here ? nearestMeetingPlace(meeting, here) : null
  // Läuft in der Nähe (bis 6 km) ein Gottesdienst oder Gebet? Dann ein Knopf dorthin.
  const runningNear = here ? earthWorship.filter(item => item.running).map(item => ({ item, distanceM: metresBetween(here, item.at!) })).filter(entry => entry.distanceM <= MEETING_WALK_LIMIT_M).sort((a, b) => a.distanceM - b.distanceM)[0] ?? null : null

  // Position teilen (alle 2 s): die bisherige Erdszene startet dann am selben Ort.
  useEffect(() => {
    if (!engineReady) return
    const timer = setInterval(() => {
      const geo = engineReady.position()
      setSharedPosition(sharedRegion, sharedLocal, geo)
    }, 2000)
    return () => clearInterval(timer)
  }, [engineReady, setSharedPosition, sharedRegion, sharedLocal])

  /** Neue Tafel: ersetzt die alte und beendet ein laufendes Hingehen. */
  function choosePanel(next: Panel) {
    engine.current?.stopWalking()
    setPanel(next)
  }
  function chooseTarget(id: string) {
    setTargetId(id)
    const place = id.startsWith('m:') ? meeting.find(item => 'm:' + item.id === id) : undefined
    if (place) { openMeetingPlace(place); return }
    const service = id.startsWith('w:') ? earthWorship.find(item => 'w:' + item.id === id) : undefined
    const from = engine.current?.position()
    if (service && from && metresBetween(from, service.at!) > MEETING_WALK_LIMIT_M) {
      choosePanel({ kind: 'travel', at: from })
      setDestinationNote(`${service.name} ist ${kmText(metresBetween(from, service.at!))} entfernt – mit Bahn oder Flugzeug hinreisen. ${worshipWhen(service)}.`)
      return
    }
    const target = targets.find(item => item.id === id)
    choosePanel(target ? target.panel : { kind: 'none' })
  }
  const street = useMemo(() => { void tick; return engineReady?.nearestStreet() ?? null }, [engineReady, tick])
  const hoverText = hover ? describeHover(hover.pick) : null
  function describeHover(pick: WorldPick): { title: string; detail: string; at: GeoPoint | null } | null {
    if (pick.type === 'person') { const resident = residents.find(item => item.id === pick.id); return resident ? { title: personSceneLabel(resident), detail: 'Person', at: engineReady?.personAt(pick.id) ?? null } : null }
    if (pick.type === 'landmark') return { title: pick.landmark.name, detail: landmarkLabel(pick.landmark.kind, pick.landmark.tags), at: pick.landmark.at }
    if (pick.type === 'plant') { const species = PLANTS[pick.species]; return { title: species.name, detail: species.id === 'laubbaum' || species.id === 'nadelbaum' ? 'Art nicht bekannt' : pick.source === 'osm-species' ? 'laut OpenStreetMap' : pick.source === 'osm' ? 'Baum aus OSM · Art geschätzt' : pick.hint ? `geschätzt · ${pick.hint}` : 'geschätzt', at: pick.at } }
    if (pick.type === 'site') { const site = sites.find(item => item.id === pick.id); return site ? { title: site.name, detail: `im Bau · ${site.phase}${site.progress !== null ? ` · ${Math.round(site.progress * 100)} %` : ''}`, at: site.at } : null }
    if (pick.type === 'noxia' || (pick.type === 'building' && pick.noxiaId)) {
      const building = noxia.find(item => item.id === pick.noxiaId)
      return building ? { title: building.name, detail: building.ownerLabel ?? 'NOXIA-Gebäude', at: { lat: building.lat, lon: building.lon } } : null
    }
    if (pick.type === 'building') return { title: pick.landmark?.name ?? pick.name ?? pick.address ?? 'Gebäude', detail: [pick.name || pick.landmark ? pick.address : null, 'reales Gebäude'].filter(Boolean).join(' · '), at: pick.at }
    return null
  }

  async function goToAddress() {
    const text = destination.trim()
    if (!text || !engine.current) return
    setDestinationNote('Suche …')
    try {
      const { token } = await getSessionInfo()
      const here = engine.current.position()
      const response = await fetch(`/api/world-lab/address?q=${encodeURIComponent(text)}&near=${here.lat},${here.lon}`, { headers: { Authorization: 'Bearer ' + token } })
      const json = await response.json().catch(() => ({ error: 'Suche gerade nicht möglich.' }))
      if (!response.ok) { setDestinationNote(json?.error ?? 'Nicht gefunden.'); return }
      engine.current.jump({ lat: json.lat, lon: json.lon })
      choosePanel(json.building ? { kind: 'building', at: { lat: json.lat, lon: json.lon }, title: json.label, address: json.label } : { kind: 'none' })
      setDestinationNote(json.numberMissing ? `Hausnummer nicht gefunden – du stehst an der ${json.label}.` : `Du stehst bei ${json.label}.`)
    } catch { setDestinationNote('Suche gerade nicht möglich.') }
  }

  return <div className={embedded ? 'world-lab embedded' : 'world-lab'}>
    <div ref={host} className="stage" />
    {/* Links nichts Dauerhaftes (W-2): Hilfe beim ersten Öffnen, Entwicklerwerte nur mit ?dev=1 */}
    {helpOpen && <div className="help" role="dialog" aria-label="Bedienung">
      <b>Weltkarte</b>
      <span>WASD oder Pfeiltasten laufen · Shift schneller · Mausrad zoomt</span>
      <span>Klick auf Person, Haus oder Schild öffnet rechts die Tafel · Esc schließt sie</span>
      <button onClick={closeHelp}>Verstanden</button>
    </div>}
    {dev && devOpen && <div className="panel">
      <small>ENTWICKLUNG</small>
      {hud && <dl>
        <dt>Bilder je Sekunde</dt><dd>{Math.round(hud.frame.fps)}</dd>
        <dt>Langsamstes Bild</dt><dd>{hud.frame.worstMs.toFixed(0)} ms</dd>
        <dt>Ruckler (letzte 120)</dt><dd>{hud.frame.stutters}</dd>
        <dt>Logik</dt><dd>{hud.frame.logicMs.toFixed(1)} ms (max {hud.frame.logicMaxMs.toFixed(0)})</dd>
        <dt>Neuaufbau je s</dt><dd>{Math.round(hud.rebuildsPerS)}</dd>
        <dt>Zeichnen</dt><dd>{hud.frame.renderMs.toFixed(1)} ms (max {hud.frame.renderMaxMs.toFixed(0)})</dd>
        <dt>Kacheln</dt><dd>{hud.tiles}{hud.loading ? ' (+' + hud.loading + ' unterwegs)' : ''}</dd>
        <dt>Gebäudeblöcke</dt><dd>{hud.blocks}</dd>
        <dt>Position</dt><dd>{hud.lat.toFixed(5)}, {hud.lon.toFixed(5)}</dd>
        {hud.near && <><dt>In der Nähe</dt><dd>{hud.near}</dd></>}
      </dl>}
      <button className="refresh" disabled={refresh.busy} onClick={() => void refreshHere('Von Hand')}>{refresh.busy ? 'Lädt …' : 'Kartendaten hier nachladen'}</button>
      {refresh.text && <p className="note">{refresh.text}</p>}
      {error && <p className="error">{error}</p>}
      {onLeave ? <button className="leave" onClick={onLeave}>← Bisherige Erdszene</button> : <a href="/dashboard">← zurück ins Spiel</a>}
    </div>}
    {referral && referralBuilding && !guideShown && !overheard && panel.kind !== 'inside' && !trip && <div className="guide job" role="status">
      <small>VERMITTELT</small>
      <b>{referralTitle(referral)}</b>
      <span>{referral.paid ? `${referral.wage} Credits für ${referral.gameHours} Spielstunden` : 'Ehrenamtlich'} · der Schein gilt noch {Math.max(1, Math.round(referralLeft / 60000))} min{engineReady ? ` · ${kmText(engineReady.distanceTo({ lat: referralBuilding.lat, lon: referralBuilding.lon }))}` : ''}</span>
      <div className="guide-actions">
        <button onClick={() => choosePanel({ kind: 'building', at: { lat: referralBuilding.lat, lon: referralBuilding.lon }, title: referralBuilding.name, noxiaId: referralBuilding.id })}>Weg zeigen</button>
      </div>
    </div>}
    {guideShown && guideTarget && !overheard && <div className="guide" role="status">
      <small>ERSTER SCHRITT</small>
      <b>Arbeit finden</b>
      <span>In der Agentur für Arbeit bekommst du eine Stelle – davon bezahlst du Essen und Wohnung. Folge dem goldenen Pfeil ({kmText(guideTarget.distanceM)}).</span>
      <div className="guide-actions">
        <button onClick={() => choosePanel({ kind: 'building', at: { lat: guideTarget.building.lat, lon: guideTarget.building.lon }, title: guideTarget.building.name, noxiaId: guideTarget.building.id })}>Weg zeigen</button>
        <button className="quiet" onClick={finishGuide}>Nicht nötig</button>
      </div>
    </div>}
    {overheard && <div className={helpOpen ? 'overheard raised' : 'overheard'}>
      <small>GESPRÄCH IN HÖRWEITE · {overheard.conversation.item.kind === 'colony' ? 'NOXIA' : 'HEUTE'}</small>
      <b>{personSceneLabel(overheard.first)} + {personSceneLabel(overheard.second)}</b>
      <p><strong>{personSceneLabel(overheard.first)}:</strong> „{overheard.conversation.opener}“</p>
      <p><strong>{personSceneLabel(overheard.second)}:</strong> „{overheard.conversation.followUp}“</p>
      <span>{overheard.conversation.item.kind === 'colony' ? 'NOXIA-Weltgeschehen' : `Reale Meldung · ${overheard.source?.name ?? overheard.conversation.item.sourceId}`} · ca. {Math.round(overheard.playerDistance)} m entfernt</span>
    </div>}
    {hoverText && hover && panel.kind !== 'inside' && panel.kind !== 'landmarkInside' && <div className="tip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
      <b>{hoverText.title}</b><span>{hoverText.detail}</span>{hoverText.at && engineReady && <small>{kmText(engineReady.distanceTo(hoverText.at))} von dir</small>}
    </div>}
    {trip && <div className="trip-overlay">
      <div><small>{trip.mode === 'rail' ? '🚆 MIT DER BAHN' : '✈ IM FLUGZEUG'}</small><b>Unterwegs nach {trip.destination_name}</b>
        <span>{tripLeft > 0 ? `Ankunft in ${tripLeft >= 60 ? `${Math.floor(tripLeft / 60)} min ${tripLeft % 60} s` : `${tripLeft} s`}` : 'Ankunft …'}</span>
        <i style={{ width: `${Math.min(100, Math.max(0, 100 - tripLeft / Math.max(1, (new Date(trip.arrives_at).getTime() - new Date(trip.departed_at).getTime()) / 1000) * 100))}%` }}/></div>
    </div>}
    <div className="right">
      <div className="where">
        <div className="where-head"><small>DU BIST HIER</small><span className="tools">
          {onPlanning && <button onClick={onPlanning} title="Zur Planungskarte">▦</button>}
          <button onClick={() => setViewOpen(value => !value)} title="Beschriftung" aria-label="Beschriftung" className={viewOpen ? 'on' : undefined}>◐</button>
          <button onClick={() => setHelpOpen(true)} title="Bedienung" aria-label="Bedienung">?</button>
          {dev && <button onClick={() => setDevOpen(value => !value)} title="Entwicklung" aria-label="Entwicklung">⚙</button>}
        </span></div>
        {viewOpen && <div className="view-options" role="group" aria-label="Beschriftung">
          <label><input type="checkbox" checked={view.streetNames} onChange={event => changeView({ ...view, streetNames: event.target.checked })}/> Straßennamen</label>
          <label><input type="checkbox" checked={view.osmPlaces} onChange={event => changeView({ ...view, osmPlaces: event.target.checked })}/> Läden, Lokale und Wahrzeichen aus OpenStreetMap</label>
          <small>Aus: Nur Gebäude mit einer Funktion im Spiel tragen Namen – NOXIA-Gebäude und Orte, die man betreten kann. Gilt auch für die Zielliste.</small>
        </div>}
        <b>{placeName || 'Erde'}</b>
        {street && <span className="street">{street}</span>}
        {refresh.busy && <LoadingBar label="Kartendaten für diese Gegend werden geholt"/>}
        {playerNote && !refresh.busy && <span className="player-note">{playerNote}</span>}
        {/* Mit offener Tafel nur Ort und Straße – die Tafel darunter ist dann das Wichtige. */}
        {panel.kind === 'none' && <>
        {engineReady && metresBetween(engineReady.position(), START_PLACE.at) > 30000 && <button className="home" onClick={() => choosePanel({ kind: 'travel', at: engineReady.position() })}>✈ Weiterreisen …</button>}
        {home && <button className="home" onClick={() => { engine.current?.jump({ lat: home.lat, lon: home.lon }); choosePanel({ kind: 'building', at: { lat: home.lat, lon: home.lon }, title: home.name, noxiaId: home.id }) }}>⌂ {home.name}</button>}
        {runningNear && <button className="home worship" onClick={() => { setTargetId(''); choosePanel(worshipPanel(runningNear.item)) }} title="Läuft gerade">◉ Jetzt: {runningNear.item.running!.group} · {runningNear.item.name} · {kmText(runningNear.distanceM)}</button>}
        {nearestMeeting && <button className="home meeting" onClick={() => openMeetingPlace(nearestMeeting.place)} title="Nächste Omnizedenz-Begegnungsstätte">◎ {nearestMeeting.place.name.replace('Omnizedenz-Begegnungsstätte', 'Begegnungsstätte')} · {kmText(nearestMeeting.distanceM)}</button>}
        <label className="target"><span>Ziel</span>
          <select value={targetId} onChange={event => chooseTarget(event.target.value)}>
            <option value="">— kein Ziel —</option>
            {groups.map(group => <optgroup key={group} label={group}>{targets.filter(item => item.group === group).map(item => <option key={item.id} value={item.id}>{item.label} · {kmText(item.distanceM)}</option>)}</optgroup>)}
          </select>
        </label>
        <form className="dest" onSubmit={event => { event.preventDefault(); void goToAddress() }}>
          <input value={destination} onChange={event => setDestination(event.target.value)} placeholder="Adresse, z. B. Hauptstraße 102" maxLength={100}/>
          <button type="submit">Los</button>
        </form>
        {destinationNote && <p className="note">{destinationNote}</p>}
        </>}
      </div>
      <TimeSlider plots={plots} asOf={asOf} onChange={setAsOf}/>
      <WorldPanels engine={engineReady} panel={panel} setPanel={next => { setTargetId(''); choosePanel(next) }} residents={residents} noxia={noxia} sites={sites} plots={plots} onWorldChanged={() => { setBuildsVersion(value => value + 1); void engine.current?.reloadNoxia() }} onParcelsChanged={() => { bust.current = String(Date.now()); engine.current?.reloadTiles(); setBuildsVersion(value => value + 1) }} placeName={placeName || 'Erde'} route={routeFar ? hud?.route ?? null : null} tick={tick} onNote={setPlayerNote} onTripBooked={booked => { setTrip(booked); setTripNow(Date.now()); choosePanel({ kind: 'none' }) }} presence={surfacePeople} worship={worship} onPeerGesture={peerGesture}/>
    </div>
    <style jsx>{`
      .world-lab{position:fixed;inset:0;background:#a9bd8c;font-family:system-ui;color:#eef2ed}
      .world-lab.embedded{inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120}
      .help{position:absolute;left:14px;bottom:24px;width:min(300px,calc(100% - 28px));display:grid;gap:4px;padding:10px 12px;background:#0d1c22ee;border:1px solid #40595a;border-radius:8px;font-size:11px;z-index:6}
      .help span{color:#bcd0cb}
      .help button{justify-self:start;margin-top:4px;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer}
      .where-head{display:flex;justify-content:space-between;align-items:center}
      .tools{display:flex;gap:4px}
      .tools button{width:20px;height:20px;border:1px solid #40595a;background:#17383a;color:#d9bb6a;border-radius:4px;font-size:11px;line-height:1;cursor:pointer;padding:0}
      .tools button.on{background:#2c5a5c}
      .view-options{display:grid;gap:4px;margin:6px 0 8px;padding:7px 8px;border:1px solid #40595a;border-radius:6px;background:#0f2428}
      .view-options label{display:flex;gap:6px;align-items:center;font-size:12px;cursor:pointer}
      .view-options small{color:#9fb3ad;font-size:10.5px;line-height:1.35}
      .home{justify-self:start;margin-top:6px;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:4px 8px;font-size:11px;cursor:pointer}
      .home.worship{border-color:#c9a447;background:#4a3412;color:#fff3d6}
      .home.meeting{border-color:#5f9c8c;background:#1f4f54;color:#e8f4ee}
      .player-note{font-size:10.5px;color:#f0d9a0}
      .loading-bar{display:grid;gap:3px;margin-top:4px;font-size:10.5px;color:#f0d9a0}
      .loading-bar span{display:flex;justify-content:space-between;gap:8px}
      .loading-bar i{position:relative;display:block;height:4px;border-radius:2px;background:#17383a;overflow:hidden}
      .loading-bar i::after{content:'';position:absolute;inset:0 auto 0 0;width:var(--p);background:#d9bb6a;transition:width .9s linear}
      .panel .leave{border:0;background:none;padding:0;text-align:left;font-size:11px;color:#d9bb6a;cursor:pointer;margin-top:4px}
      .stage{position:absolute;inset:0}
      .panel{position:absolute;left:14px;bottom:24px;max-height:calc(100% - 48px);overflow:auto;width:270px;box-sizing:border-box;padding:12px 14px;background:#0d1c22e6;border:1px solid #40595a;border-radius:8px;display:grid;grid-template-columns:minmax(0,1fr);gap:4px}
      .panel small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .panel b{font-size:14px}
      .panel span{font-size:10px;color:#9fb5b0}
      .places{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}
      .places button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:4px 8px;font-size:11px;cursor:pointer}
      dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:4px 0;font-size:11px}
      dt{color:#9fb5b0}dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
      .error{margin:4px 0;font-size:11px;color:#f0b9a0}
      .refresh{width:100%;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:5px 8px;font-size:11px;cursor:pointer;margin-top:4px}
      .refresh:disabled{opacity:.6;cursor:default}
      .note{margin:2px 0;font-size:10px;color:#9fb5b0}
      .dest{display:flex;gap:5px;margin:6px 0 2px}
      .dest input{flex:1;min-width:0;border:1px solid #40595a;background:#08151a;color:#fff;border-radius:5px;padding:5px 7px;font-size:11px}
      .dest button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:5px 9px;font-size:11px;cursor:pointer}
      .panel a{font-size:11px;color:#d9bb6a;text-decoration:none;margin-top:4px}
      .trip-overlay{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:rgba(5,14,20,.62);backdrop-filter:blur(3px)}.trip-overlay div{display:grid;gap:6px;min-width:280px;padding:16px 18px;border:1px solid #9b8545;border-radius:10px;background:#071521f2;color:#eef5f7;text-align:center}.trip-overlay small{color:#d7b96e;font:800 9px monospace;letter-spacing:.14em}.trip-overlay b{font-size:15px}.trip-overlay span{font-size:11px;color:#9db0b6}.trip-overlay i{display:block;height:4px;border-radius:2px;background:#d7b96e;transition:width 1s linear}
      .right{position:absolute;right:14px;top:14px;width:300px;max-height:calc(100% - 28px);display:flex;flex-direction:column;gap:8px;z-index:5}
      .where{display:grid;grid-template-columns:minmax(0,1fr);gap:3px;padding:10px 12px;background:#0d1c22e6;border:1px solid #40595a;border-radius:8px}
      .where small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .where b{font-size:14px}
      .street{font-size:11px;color:#dfe9e4}
      .target{display:grid;gap:2px;margin:6px 0 0}
      .target span{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .target select{width:100%;min-width:0;border:1px solid #40595a;background:#08151a;color:#fff;border-radius:5px;padding:5px 6px;font-size:11px}
      .overheard{position:absolute;left:14px;bottom:24px;width:min(360px,calc(100% - 28px));display:grid;gap:3px;padding:10px 12px;background:#0d1c22ee;border:1px solid #40595a;border-radius:8px;font-size:11.5px;z-index:4}
      .overheard.raised{bottom:200px}
      .guide{position:absolute;left:14px;bottom:24px;width:min(320px,calc(100% - 28px));display:grid;gap:4px;padding:10px 12px;background:#0d1c22ee;border:1px solid #d9a62a;border-radius:8px;font-size:11.5px;z-index:5}
      .guide small{color:#f2c94c;letter-spacing:.06em;font-size:10px}
      .guide span{color:#d4e2de;line-height:1.4}
      .guide-actions{display:flex;gap:6px;margin-top:4px}
      .guide-actions button{border:1px solid #d9a62a;background:#3a2f12;color:#fff3cf;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer}
      .guide-actions button.quiet{border-color:#40595a;background:transparent;color:#9fb3ad}
      .overheard small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .overheard p{margin:0;line-height:1.4}
      .overheard span{color:#9fb5b0;font-size:10px}
      .tip{position:fixed;z-index:1200;pointer-events:none;display:grid;gap:1px;padding:6px 8px;background:#0d1c22ee;border:1px solid #40595a;border-radius:6px;font-size:11px;color:#eef2ed;max-width:260px}
      .tip span{color:#9fb5b0}.tip small{color:#d9bb6a;font-size:10px}
      @media(max-width:700px){
        .panel{display:none}
        .right{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:55%}
        .panel dl{display:none}
        .tip{display:none}
      }
    `}</style>
  </div>
}

/**
 * Ladebalken für das Nachholen von Kartendaten (05.11.2026). Erst nach einer
 * Sekunde sichtbar, damit schnelle Antworten nicht flackern. Der Balken läuft
 * gegen die übliche Dauer (~40 s) und wird zum Ende hin langsamer – er zeigt
 * also eine Schätzung, keine echte Fortschrittsmeldung des Servers.
 */
function LoadingBar({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const begin = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - begin) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  if (seconds < 1) return null
  const share = Math.min(95, Math.round(100 * (1 - Math.exp(-seconds / 18))))
  return <div className="loading-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share}>
    <span><span>{label} …</span><span>{seconds} s</span></span>
    <i style={{ ['--p' as string]: share + '%' }}/>
  </div>
}
