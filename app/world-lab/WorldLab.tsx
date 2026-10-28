'use client'

// app/world-lab/WorldLab.tsx
// Weltkarte „eine Welt“ mit PixiJS – eigene Seite /world-lab und im Spiel
// neben der bisherigen Erdszene. Personen, Ansprechen und Betreten in
// WorldPanels.tsx (immer nur eine Tafel offen).
//
// Was hier anders ist als in der begehbaren Szene:
//   - Es gibt keine Szene, die ersetzt wird. Die Welt besteht aus Kacheln, die
//     um die Spielfigur herum dazukommen und hinter ihr wieder wegfallen.
//   - Gezeichnet wird über die Grafikkarte; Bewegung läuft je Bild, nicht je Tastendruck.
//   - Reale Orte sind stark vereinfacht: Blöcke aus einem Baukasten (lib/worldlab/blocks.ts).

import type { PresenceRow } from '@/lib/game/population/placePresence'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useColonyStateStore, type ColonyResident } from '@/lib/store/colonyStateStore'
import { useEarthPlayerPositionStore } from '@/lib/store/earthPlayerPositionStore'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import WorldPanels, { panelForPick, panelLocation, type Panel } from './WorldPanels'
import { constructionState } from '@/lib/game/constructionProgress'
import { landmarkLabel } from '@/lib/worldlab/landmarks'
import { getSessionInfo } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { getBuildingEntryDefinition } from '@/lib/game/buildings/entry'
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

const metresBetween = (a: GeoPoint, b: GeoPoint) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180))
const kmText = (m: number) => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m) + ' m'

const PLACES: Array<{ label: string; at: GeoPoint }> = [
  { label: 'Sundern Mitte', at: { lat: 51.3262, lon: 8.0 } },
  // Startcafé, Hauptstraße 72 (seit 25.10.2026 im realen Haus)
  { label: 'Café', at: { lat: 51.32565, lon: 8.00418 } },
  { label: 'Selmecke', at: { lat: 51.33745, lon: 7.97975 } },
]
/** Ohne gespeicherte Position beginnt man am Startcafé (27.10.2026: vorher „Sundern Mitte“, rund 300 m entfernt). */
const START_PLACE = PLACES.find(place => place.label === 'Café') ?? PLACES[0]

/**
 * `embedded`: im Spiel unter der oberen Leiste statt als eigene Seite; `onLeave`
 * führt dann zurück zur bisherigen Erdszene statt zum Dashboard.
 */
export default function WorldLab({ embedded = false, onLeave, onPlanning, residents: givenResidents }: { embedded?: boolean; onLeave?: () => void; onPlanning?: () => void; residents?: ColonyResident[] } = {}) {
  const host = useRef<HTMLDivElement | null>(null)
  const engine = useRef<WorldEngine | null>(null)
  const [engineReady, setEngineReady] = useState<WorldEngine | null>(null)
  const [hud, setHud] = useState<Hud | null>(null)
  const [tick, setTick] = useState(0)
  const [panel, setPanel] = useState<Panel>({ kind: 'none' })
  // Neuer Spieler: nach dem Onboarding den Innenraum des Startcafés öffnen (?starterCafe=<id>).
  const starterCafe = useRef<string | null | undefined>(undefined)
  const [noxia, setNoxia] = useState<NoxiaBuilding[]>([])
  const noxiaRef = useRef<NoxiaBuilding[]>([])
  const [surfacePeople, setSurfacePeople] = useState<PresenceRow[]>([])
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
  const [helpOpen, setHelpOpen] = useState(() => { try { return typeof window !== 'undefined' && window.localStorage.getItem('noxia-world-help-v1') !== 'seen' } catch { return false } })
  function closeHelp() { setHelpOpen(false); try { window.localStorage.setItem('noxia-world-help-v1', 'seen') } catch { /* ohne Speicher */ } }
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
      let json: { error?: string; regions?: Array<{ ok: boolean; error?: string }>; detail?: { ok?: boolean; cached?: boolean; total?: number; error?: string } } | null = null
      try { json = JSON.parse(raw) } catch { console.error('[world-lab] refresh: keine JSON-Antwort', response.status, raw.slice(0, 300)) }
      if (!response.ok || !json) throw new Error(json?.error ?? 'HTTP ' + response.status)
      const parts: string[] = []
      for (const region of json.regions ?? []) parts.push(region.ok ? 'Region erneuert' : 'Region nicht erneuert (' + (region.error ?? 'Fehler') + ')')
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
          if (!disposed) { setNoxia(list); setPlots(Array.isArray(json?.plots) ? json.plots : []); setParcelOwners(Array.isArray(json?.parcels) ? json.parcels : []) }
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
        onPick: pick => { if (!disposed) { engine.current?.stopWalking(); setTargetId(''); setPanel(panelForPick(pick, noxiaRef.current)) } },
        onHover: next => { if (!disposed) setHover(next) },
        noxiaVisual: typeId => getBuildingVisual(typeId, 'earth'),
        onHud: next => { if (!disposed) { setHud(next); setTick(value => value + 1) } },
        onError: message => { if (!disposed) { setError(message); console.error('[world-lab]', message); setPlayerNote('Ein Teil der Karte konnte gerade nicht geladen werden.') } },
        zoom: restartAt?.zoom,
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
        return { id: resident.id, label: personSceneLabel(resident), activity, inside: false, anchor: null, strollAround: live.home }
      }
      return {
        id: resident.id,
        label: personSceneLabel(resident),
        activity, inside,
        anchor: surface ? { lat: surface.lat, lon: surface.lon } : place ? { lat: place.lat, lon: place.lon } : null,
        anchorRadiusM: surface ? 3 : place ? Math.max(place.w, place.d) / 2 : undefined,
      }
    })
    engineReady.setPeople(people)
  }, [engineReady, residents, noxia, surfacePeople, surfaceStates])

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
        const { token } = await getSessionInfo()
        const response = await fetch('/api/game/profile', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = response.ok ? await response.json() : null
        const name = String(json?.profile?.username ?? '').trim()
        if (live && name) engineReady.setPlayerName(name)
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

  // Weg zum Ort der offenen Tafel zeigen, sobald er mehr als 25 m entfernt ist.
  const routeTarget = panelLocation(panel, sites, plots)
  const routeKey = routeTarget ? routeTarget.lat.toFixed(6) + ',' + routeTarget.lon.toFixed(6) : ''
  const routeFar = Boolean(routeTarget && engineReady && engineReady.distanceTo(routeTarget) > 25)
  useEffect(() => {
    if (!engineReady) return
    engineReady.setRouteTarget(routeFar && routeKey ? { lat: Number(routeKey.split(',')[0]), lon: Number(routeKey.split(',')[1]) } : null)
  }, [engineReady, routeKey, routeFar])

  // Zielliste: NOXIA-Gebäude (eigene zuerst), Baustellen, Wahrzeichen der Umgebung.
  const here = useMemo(() => hud ? { lat: hud.lat, lon: hud.lon } : null, [hud])
  // Liste nur neu, wenn die Figur gut 100 m weiter ist oder neue Kacheln da sind.
  const hereKey = here ? Math.round(here.lat * 1000) + ':' + Math.round(here.lon * 700) : ''
  const tilesLoaded = hud?.tiles ?? 0
  const targets = useMemo(() => {
    void hereKey; void tilesLoaded
    if (!here) return []
    const list: Array<{ id: string; label: string; distanceM: number; panel: Panel; group: string }> = []
    for (const building of noxia) {
      const distanceM = metresBetween(here, { lat: building.lat, lon: building.lon })
      if (distanceM <= 6000) list.push({ id: 'n:' + building.id, label: building.name + (building.own ? '' : ' · ' + (building.ownerLabel ?? 'NOXIA')), distanceM, group: building.own ? 'Deine Gebäude' : 'NOXIA-Gebäude', panel: { kind: 'building', at: { lat: building.lat, lon: building.lon }, title: building.name, noxiaId: building.id } })
    }
    for (const site of sites) list.push({ id: 's:' + site.id, label: site.name + ' · im Bau', distanceM: metresBetween(here, site.at), group: 'Baustellen', panel: { kind: 'site', id: site.id } })
    for (const item of engineReady?.landmarks() ?? []) list.push({ id: 'l:' + item.landmark.at.lat + ',' + item.landmark.at.lon, label: item.landmark.name + ' · ' + landmarkLabel(item.landmark.kind, item.landmark.tags), distanceM: item.distanceM, group: item.landmark.poi ? 'Läden und Lokale' : 'Orte', panel: { kind: 'landmark', landmark: item.landmark } })
    return list.sort((a, b) => a.group.localeCompare(b.group, 'de') || a.distanceM - b.distanceM)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noxia, sites, engineReady, hereKey, tilesLoaded])
  const groups = [...new Set(targets.map(target => target.group))]
  const home = noxia.find(building => building.own) ?? null

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
    const target = targets.find(item => item.id === id)
    choosePanel(target ? target.panel : { kind: 'none' })
  }
  const street = useMemo(() => { void tick; return engineReady?.nearestStreet() ?? null }, [engineReady, tick])
  const hoverText = hover ? describeHover(hover.pick) : null
  function describeHover(pick: WorldPick): { title: string; detail: string; at: GeoPoint | null } | null {
    if (pick.type === 'person') { const resident = residents.find(item => item.id === pick.id); return resident ? { title: personSceneLabel(resident), detail: 'Person', at: engineReady?.personAt(pick.id) ?? null } : null }
    if (pick.type === 'landmark') return { title: pick.landmark.name, detail: landmarkLabel(pick.landmark.kind, pick.landmark.tags), at: pick.landmark.at }
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
          <button onClick={() => setHelpOpen(true)} title="Bedienung" aria-label="Bedienung">?</button>
          {dev && <button onClick={() => setDevOpen(value => !value)} title="Entwicklung" aria-label="Entwicklung">⚙</button>}
        </span></div>
        <b>{placeName || 'Erde'}</b>
        {street && <span className="street">{street}</span>}
        {playerNote && <span className="player-note">{playerNote}</span>}
        {/* Mit offener Tafel nur Ort und Straße – die Tafel darunter ist dann das Wichtige. */}
        {panel.kind === 'none' && <>
        {engineReady && metresBetween(engineReady.position(), START_PLACE.at) > 30000 && <button className="home" onClick={() => choosePanel({ kind: 'travel', at: engineReady.position() })}>✈ Weiterreisen …</button>}
        {home && <button className="home" onClick={() => { engine.current?.jump({ lat: home.lat, lon: home.lon }); choosePanel({ kind: 'building', at: { lat: home.lat, lon: home.lon }, title: home.name, noxiaId: home.id }) }}>⌂ {home.name}</button>}
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
      <WorldPanels engine={engineReady} panel={panel} setPanel={next => { setTargetId(''); choosePanel(next) }} residents={residents} noxia={noxia} sites={sites} plots={plots} onWorldChanged={() => { setBuildsVersion(value => value + 1); void engine.current?.reloadNoxia() }} onParcelsChanged={() => { bust.current = String(Date.now()); engine.current?.reloadTiles(); setBuildsVersion(value => value + 1) }} placeName={placeName || 'Erde'} route={routeFar ? hud?.route ?? null : null} tick={tick} onTripBooked={booked => { setTrip(booked); setTripNow(Date.now()); choosePanel({ kind: 'none' }) }} presence={surfacePeople}/>
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
      .home{justify-self:start;margin-top:6px;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:4px 8px;font-size:11px;cursor:pointer}
      .player-note{font-size:10.5px;color:#f0d9a0}
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
