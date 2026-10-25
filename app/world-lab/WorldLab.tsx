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

import { useEffect, useMemo, useRef, useState } from 'react'
import { useColonyStateStore, type ColonyResident } from '@/lib/store/colonyStateStore'
import { useEarthPlayerPositionStore } from '@/lib/store/earthPlayerPositionStore'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import WorldPanels, { panelForPick, panelLocation, type Panel } from './WorldPanels'
import { constructionState } from '@/lib/game/constructionProgress'
import { landmarkLabel } from '@/lib/worldlab/landmarks'
import { getSessionInfo } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { blockArt } from '@/lib/worldlab/blocks'
import { detailCell } from '@/lib/worldlab/detailCells'
import type { GeoPoint } from '@/lib/worldlab/mercator'
import type { SimplifiedTile } from '@/lib/worldlab/simplify'
import { startWorldEngine, type Hud, type NoxiaBuilding, type WorldEngine, type WorldPerson, type WorldPick, type WorldSite } from './worldEngine'

/** Ein laufender Bau aus /api/game/build/spatial (nur die Felder, die die Karte braucht). */
type BuildRow = { id: string; name?: string; buildable_id: string; status?: string; created_at?: string; completes_at?: string; latitude_deg?: number | null; longitude_deg?: number | null; footprint_width_m?: number | null; footprint_depth_m?: number | null; rotation_deg?: number | null }

const metresBetween = (a: GeoPoint, b: GeoPoint) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180))
const kmText = (m: number) => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m) + ' m'

const PLACES: Array<{ label: string; at: GeoPoint }> = [
  { label: 'Sundern Mitte', at: { lat: 51.3262, lon: 8.0 } },
  { label: 'Café', at: { lat: 51.32554, lon: 8.00454 } },
  { label: 'Selmecke', at: { lat: 51.33745, lon: 7.97975 } },
]

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
  const [noxia, setNoxia] = useState<NoxiaBuilding[]>([])
  const noxiaRef = useRef<NoxiaBuilding[]>([])
  const [surfacePeople, setSurfacePeople] = useState<Array<{ id: string; lat: number; lon: number }>>([])
  const [showStats, setShowStats] = useState(!embedded)
  const [destination, setDestination] = useState('')
  const [destinationNote, setDestinationNote] = useState('')
  const [placeName, setPlaceName] = useState('')
  const placeAt = useRef<GeoPoint | null>(null)
  const [builds, setBuilds] = useState<BuildRow[]>([])
  const [sites, setSites] = useState<WorldSite[]>([])
  const [hover, setHover] = useState<{ pick: WorldPick; x: number; y: number } | null>(null)
  const [targetId, setTargetId] = useState('')

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
    try {
      const { token } = await getSessionInfo()
      if (!token) throw new Error('nicht angemeldet')
      const response = await fetch('/api/world-lab/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(at) })
      const json = await response.json()
      if (!response.ok) throw new Error(json?.error ?? String(response.status))
      const parts: string[] = []
      for (const region of json.regions ?? []) parts.push(region.ok ? 'Region erneuert' : 'Region nicht erneuert (' + (region.error ?? 'Fehler') + ')')
      if (json.detail?.ok) parts.push(json.detail.cached ? 'Ortsdetail war schon da' : json.detail.total + ' Objekte Ortsdetail geholt')
      else parts.push('Ortsdetail nicht geholt (' + (json.detail?.error ?? 'Fehler') + ')')
      fresh.current = String(Date.now())
      engine.current?.reloadTiles()
      setRefresh({ busy: false, text: parts.join(' · ') })
    } catch (reason) {
      setRefresh({ busy: false, text: 'Nachladen fehlgeschlagen: ' + String((reason as Error)?.message ?? reason) })
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

  useEffect(() => {
    let disposed = false
    ;(async () => {
      const PIXI = await import('pixi.js')
      if (disposed || !host.current) return
      const params = new URLSearchParams(window.location.search)
      const start: GeoPoint = Number.isFinite(Number(params.get('lat'))) && params.get('lat')
        ? { lat: Number(params.get('lat')), lon: Number(params.get('lon')) }
        : startGeo.current ?? PLACES[0].at
      const started = await startWorldEngine(PIXI, {
        host: host.current,
        start,
        // Messschalter: ?aa=0 schaltet die Kantenglättung ab, ?res=1 begrenzt die Pixeldichte.
        settings: { antialias: params.get('aa') !== '0', maxResolution: Number(params.get('res')) || 2 },
        // Standard: eigene Zeichnungen, wo vorhanden, sonst die Vorlagen.
        // ?art=vorlage zeigt nur Vorlagen, ?art=farbe einfarbige Quader (zum Vergleichen der Bildrate).
        art: blockArt(params.get('art') === 'vorlage' ? 'template' : params.get('art') === 'farbe' ? 'none' : 'drawn'),
        loadTile: async tile => {
          const response = await fetch(`/api/world-lab/tile?x=${tile.x}&y=${tile.y}` + (fresh.current ? '&fresh=' + fresh.current : ''))
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
          if (!disposed) setNoxia(list)
          return list
        },
        onPick: pick => { if (!disposed) { engine.current?.stopWalking(); setTargetId(''); setPanel(panelForPick(pick, noxiaRef.current)) } },
        onHover: next => { if (!disposed) setHover(next) },
        noxiaVisual: typeId => getBuildingVisual(typeId, 'earth'),
        onHud: next => { if (!disposed) { setHud(next); setTick(value => value + 1) } },
        onError: message => { if (!disposed) setError(message) },
      })
      if (disposed) { started.destroy(); return }
      engine.current = started
      setEngineReady(started)
    })().catch(reason => { if (!disposed) setError('Die Ansicht konnte nicht gestartet werden: ' + String(reason?.message ?? reason)) })

    return () => {
      disposed = true
      engine.current?.destroy()
      engine.current = null
    }
  }, [])

  // Autoritative Personenpositionen der gemeinsamen Surface-Presence-Schicht.
  // Das deckt auch reale OSM-Orte ab, z. B. eine Arbeitszuweisung an eine Kirche,
  // ohne dafür ein künstliches NOXIA-Gebäude zu duplizieren.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/world-lab/people', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        if (!response.ok) return
        const json = await response.json()
        if (!cancelled) setSurfacePeople(Array.isArray(json?.people) ? json.people : [])
      } catch { /* World-Lab bleibt auch ohne Präsenzabruf nutzbar. */ }
    })()
    return () => { cancelled = true }
  }, [residents])

  // Personen auf die Karte: autoritative Surface-Präsenz hat Vorrang.
  // Fehlt sie, bleibt die bisherige Fallback-Regel über NOXIA-Zuhause/Arbeit;
  // nur ganz ohne Anker geht die Person die Straßen entlang.
  useEffect(() => {
    if (!engineReady) return
    const byId = new Map(noxia.map(building => [building.id, building]))
    const surfaceByPerson = new Map(surfacePeople.map(person => [person.id, person]))
    const people: WorldPerson[] = residents.slice(0, 18).map(resident => {
      const surface = surfaceByPerson.get(resident.id)
      const place = resident.assignments.map(item => item.tileEntityId ? byId.get(item.tileEntityId) : undefined).find(Boolean)
      return {
        id: resident.id,
        label: personSceneLabel(resident),
        anchor: surface ? { lat: surface.lat, lon: surface.lon } : place ? { lat: place.lat, lon: place.lon } : null,
        anchorRadiusM: surface ? 3 : place ? Math.max(place.w, place.d) / 2 : undefined,
      }
    })
    engineReady.setPeople(people)
  }, [engineReady, residents, noxia, surfacePeople])

  // Im Innenraum steuert der Innenraum: Karte hört dann nicht auf Tasten und Klicks.
  useEffect(() => { engineReady?.setInputEnabled(panel.kind !== 'inside' && panel.kind !== 'landmarkInside') }, [engineReady, panel.kind])

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
  }, [])
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
  const routeTarget = panelLocation(panel, sites)
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
    for (const item of engineReady?.landmarks() ?? []) list.push({ id: 'l:' + item.landmark.at.lat + ',' + item.landmark.at.lon, label: item.landmark.name + ' · ' + landmarkLabel(item.landmark.kind, item.landmark.tags), distanceM: item.distanceM, group: 'Orte', panel: { kind: 'landmark', landmark: item.landmark } })
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
      const json = await response.json()
      if (!response.ok) { setDestinationNote(json?.error ?? 'Nicht gefunden.'); return }
      engine.current.jump({ lat: json.lat, lon: json.lon })
      choosePanel(json.building ? { kind: 'building', at: { lat: json.lat, lon: json.lon }, title: json.label, address: json.label } : { kind: 'none' })
      setDestinationNote(json.numberMissing ? `Hausnummer nicht gefunden – du stehst an der ${json.label}.` : `Du stehst bei ${json.label}.`)
    } catch { setDestinationNote('Suche gerade nicht möglich.') }
  }

  return <div className={embedded ? 'world-lab embedded' : 'world-lab'}>
    <div ref={host} className="stage" />
    <div className="panel">
      <small>DU BIST HIER</small>
      <b>{placeName || (embedded ? 'Weltkarte' : 'Kacheln statt Szenen')}</b>
      {street && <span className="street">{street}</span>}
      <span>WASD oder Pfeile laufen · Shift schneller · Mausrad zoomt · Klick auf Person oder Haus</span>
      <label className="target"><span>Ziel</span>
        <select value={targetId} onChange={event => chooseTarget(event.target.value)}>
          <option value="">— kein Ziel —</option>
          {groups.map(group => <optgroup key={group} label={group}>{targets.filter(item => item.group === group).map(item => <option key={item.id} value={item.id}>{item.label} · {kmText(item.distanceM)}</option>)}</optgroup>)}
        </select>
      </label>
      <form className="dest" onSubmit={event => { event.preventDefault(); void goToAddress() }}>
        <input value={destination} onChange={event => setDestination(event.target.value)} placeholder="Ziel, z. B. Hauptstraße 102" maxLength={100}/>
        <button type="submit">Los</button>
      </form>
      {destinationNote && <p className="note">{destinationNote}</p>}
      <div className="places">
        {home && <button onClick={() => { engine.current?.jump({ lat: home.lat, lon: home.lon }); choosePanel({ kind: 'building', at: { lat: home.lat, lon: home.lon }, title: home.name, noxiaId: home.id }) }}>⌂ {home.name}</button>}
        {here && metresBetween(here, PLACES[0].at) < 20000 && PLACES.map(place => <button key={place.label} onClick={() => engine.current?.jump(place.at)}>{place.label}</button>)}
      </div>
      <button className="leave" onClick={() => setShowStats(value => !value)}>{showStats ? 'Messwerte ausblenden' : 'Messwerte zeigen'}</button>
      {hud && showStats && <dl>
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
      {onPlanning && <button className="leave" onClick={onPlanning}>← Karte</button>}
      {onLeave ? <button className="leave" onClick={onLeave}>← Bisherige Erdszene</button> : <a href="/dashboard">← zurück ins Spiel</a>}
    </div>
    {hoverText && hover && panel.kind !== 'inside' && panel.kind !== 'landmarkInside' && <div className="tip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
      <b>{hoverText.title}</b><span>{hoverText.detail}</span>{hoverText.at && engineReady && <small>{kmText(engineReady.distanceTo(hoverText.at))} von dir</small>}
    </div>}
    <WorldPanels engine={engineReady} panel={panel} setPanel={next => { setTargetId(''); choosePanel(next) }} residents={residents} noxia={noxia} sites={sites} placeName={placeName || 'Erde'} route={routeFar ? hud?.route ?? null : null} tick={tick}/>
    <style jsx>{`
      .world-lab{position:fixed;inset:0;background:#a9bd8c;font-family:system-ui;color:#eef2ed}
      .world-lab.embedded{inset:var(--noxia-topbar-h,44px) 0 0;z-index:1120}
      .panel .leave{border:0;background:none;padding:0;text-align:left;font-size:11px;color:#d9bb6a;cursor:pointer;margin-top:4px}
      .stage{position:absolute;inset:0}
      .panel{position:absolute;left:14px;top:14px;width:250px;padding:12px 14px;background:#0d1c22e6;border:1px solid #40595a;border-radius:8px;display:grid;gap:4px}
      .panel small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .panel b{font-size:14px}
      .panel span{font-size:10px;color:#9fb5b0}
      .places{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}
      .places button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:4px 8px;font-size:11px;cursor:pointer}
      dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:4px 0;font-size:11px}
      dt{color:#9fb5b0}dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
      .error{margin:4px 0;font-size:11px;color:#f0b9a0}
      .refresh{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:5px 8px;font-size:11px;cursor:pointer;margin-top:4px}
      .refresh:disabled{opacity:.6;cursor:default}
      .note{margin:2px 0;font-size:10px;color:#9fb5b0}
      .dest{display:flex;gap:5px;margin:6px 0 2px}
      .dest input{flex:1;min-width:0;border:1px solid #40595a;background:#08151a;color:#fff;border-radius:5px;padding:5px 7px;font-size:11px}
      .dest button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:5px 9px;font-size:11px;cursor:pointer}
      .panel a{font-size:11px;color:#d9bb6a;text-decoration:none;margin-top:4px}
      .panel .street{font-size:11px;color:#dfe9e4}
      .target{display:grid;gap:2px;margin:6px 0 0}
      .target span{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .target select{border:1px solid #40595a;background:#08151a;color:#fff;border-radius:5px;padding:5px 6px;font-size:11px;max-width:100%}
      .tip{position:fixed;z-index:1200;pointer-events:none;display:grid;gap:1px;padding:6px 8px;background:#0d1c22ee;border:1px solid #40595a;border-radius:6px;font-size:11px;color:#eef2ed;max-width:260px}
      .tip span{color:#9fb5b0}.tip small{color:#d9bb6a;font-size:10px}
      @media(max-width:700px){
        .panel{left:10px;right:10px;top:10px;width:auto;max-height:42%;overflow:auto;padding:10px 12px}
        .panel dl{display:none}
        .tip{display:none}
      }
    `}</style>
  </div>
}
