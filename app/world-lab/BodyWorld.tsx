'use client'
// app/world-lab/BodyWorld.tsx
// Weltkarte jenseits der Erde (06.11.2026, Thomas: „wir haben die Erde nun schon sehr
// hübsch gemacht, es wird Zeit, dass wir das mit den anderen Himmelskörpern auch tun“).
//
// Dieselbe Zeichenmaschine wie die Erde (`worldEngine.ts`), der Körper liefert nur
// Projektion, Boden und Sonne (`lib/worldlab/bodies.ts`). Erster Ort: Mars / Tharsis Hub.
// Gebäude kommen mit ihrer echten Lage aus `/api/world-lab/body`; Kartendaten wie OSM
// gibt es hier nicht – die Kacheln sind vorerst leer (Gelände aus MOLA folgt).
// Die bisherige Kolonieansicht bleibt daneben erreichbar und wird erst ersetzt, wenn
// Thomas es entscheidet.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import type { GeoPoint } from '@/lib/worldlab/mercator'
import { buildBodyTile, corridorsToGeo, type FrameCorridor } from '@/lib/worldlab/bodyTiles'
import { PLANETARY_REFERENCES } from '@/lib/game/spatial/planetary'
import { bodyLook, type MapBody } from '@/lib/worldlab/bodies'
import { marsLocalTimeText } from '@/lib/worldlab/marsSun'
import { getSessionInfo } from '@/lib/supabase/auth'
import { getBuildingVisual } from '@/lib/game/buildings/visuals'
import { getBuildingEntryDefinition } from '@/lib/game/buildings/entry'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import { kieselLookFor } from '@/lib/figures/kiesel'
import { workPoseFor } from '@/lib/figures/workPose'
import { useMyLook } from '@/lib/figures/KieselFigure'
import { startWorldEngine, type Hud, type NoxiaBuilding, type WorldEngine, type WorldPerson } from './worldEngine'

const TALK_RANGE_M = 8
const ENTER_RANGE_M = 8
const panelStyle: React.CSSProperties = { position: 'absolute', zIndex: 5, right: 14, top: 14, width: 'min(340px, calc(100% - 28px))', maxHeight: 'calc(100% - 28px)', overflow: 'auto', background: 'rgba(24,14,10,.94)', border: '1px solid #8a5a3c', borderRadius: 8, color: '#f1e4d4', font: '13px system-ui', padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,.35)' }
const button: React.CSSProperties = { border: '1px solid #c98a5a', borderRadius: 6, background: '#5a2f1c', color: '#fff3e4', font: '700 12px system-ui', padding: '7px 11px', cursor: 'pointer', marginRight: 6, marginTop: 8 }

type Panel = { kind: 'none' } | { kind: 'building'; id: string } | { kind: 'person'; id: string }
type Line = { role: 'user' | 'assistant'; content: string }

export default function BodyWorld({ locationSlug, body, residents = [], corridors = [], onLeave, onEnterBuilding }: {
  locationSlug: string
  body: MapBody
  residents?: ColonyResident[]
  /** Fahrwege des Ortes in Metern Ost/Nord vom Ursprung (Tharsis: THARSIS_HUB_SURFACE_CORRIDORS) */
  corridors?: readonly FrameCorridor[]
  /** Zurück zur bisherigen Kolonieansicht */
  onLeave?: () => void
  /** Gebäude betreten (Innenraum des Dashboards) */
  onEnterBuilding?: (entityId: string) => void
}) {
  const look = bodyLook(body)
  const host = useRef<HTMLDivElement | null>(null)
  const [engine, setEngine] = useState<WorldEngine | null>(null)
  const [hud, setHud] = useState<Hud | null>(null)
  const [error, setError] = useState('')
  const [place, setPlace] = useState<{ name: string; origin: GeoPoint; unplaced: number } | null>(null)
  const [buildings, setBuildings] = useState<NoxiaBuilding[]>([])
  const buildingsRef = useRef<NoxiaBuilding[]>([])
  const [panel, setPanel] = useState<Panel>({ kind: 'none' })
  const [talk, setTalk] = useState<Record<string, Line[]>>({})
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [solTime, setSolTime] = useState<string | null>(null)
  const posKey = `noxia-body-position-v1:${locationSlug}`

  // Ort und Gebäude holen, dann die Zeichenmaschine am Startpunkt starten.
  useEffect(() => {
    if (!look) return
    let disposed = false
    let started: WorldEngine | null = null
    ;(async () => {
      const { token } = await getSessionInfo()
      if (!token) { setError('Bitte anmelden.'); return }
      const response = await fetch(`/api/world-lab/body?location=${encodeURIComponent(locationSlug)}`, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json) { setError(String(json?.error ?? 'Ort konnte nicht geladen werden.')); return }
      if (disposed) return
      const list = (json.buildings ?? []) as NoxiaBuilding[]
      buildingsRef.current = list
      setBuildings(list)
      setPlace({ name: String(json.name ?? locationSlug), origin: json.origin, unplaced: Number(json.unplaced ?? 0) })
      // Start: zuletzt gespeicherte Position, sonst das eigene Gebäude, sonst der Landeplatz, sonst der Ursprung.
      let start: GeoPoint = json.origin
      try { const saved = JSON.parse(window.localStorage.getItem(posKey) ?? 'null'); if (saved && Number.isFinite(saved.lat)) start = saved } catch { /* ohne Speicher */ }
      if (start === json.origin) {
        const first = list.find(b => b.own) ?? list.find(b => b.typeId === 'landing_pad') ?? list.find(b => b.typeId === 'habitat')
        if (first) start = { lat: first.lat, lon: first.lon }
      }
      const PIXI = await import('pixi.js')
      if (disposed || !host.current) return
      const projection = look.projection
      const reference = PLANETARY_REFERENCES[body as Exclude<MapBody, 'earth'>] ?? PLANETARY_REFERENCES.mars
      const roads = corridorsToGeo({ reference, origin: json.origin, corridors })
      started = await startWorldEngine(PIXI, {
        host: host.current,
        start,
        settings: { antialias: true, maxResolution: 2 },
        projection,
        ground: look.ground,
        sunElevation: look.sunElevation,
        loadTile: async tile => buildBodyTile(tile, 17, projection, roads),
        loadNoxia: async () => buildingsRef.current,
        noxiaVisual: typeId => getBuildingVisual(typeId, body),
        onPick: pick => {
          if (disposed) return
          started?.stopWalking()
          if (pick.type === 'person') setPanel({ kind: 'person', id: pick.id })
          else if (pick.type === 'noxia') setPanel({ kind: 'building', id: pick.noxiaId })
          else if (pick.type === 'building' && pick.noxiaId) setPanel({ kind: 'building', id: pick.noxiaId })
          else setPanel({ kind: 'none' })
        },
        onHud: next => { if (!disposed) { setHud(next); if (body === 'mars') setSolTime(marsLocalTimeText(next.lon, Date.now())) } },
        onError: text => { if (!disposed) setError(text) },
      })
      if (disposed) { started.destroy(); return }
      setEngine(started)
    })().catch(reason => { if (!disposed) setError('Die Ansicht konnte nicht gestartet werden: ' + String(reason?.message ?? reason)) })
    return () => { disposed = true; started?.destroy(); setEngine(null) }
  }, [locationSlug, body]) // eslint-disable-line react-hooks/exhaustive-deps

  // Eigene Figur
  const myLook = useMyLook().look
  useEffect(() => { engine?.setPlayerLook(myLook) }, [engine, myLook])

  // Position merken (Ortswechsel und Neuladen beginnen dort, wo man war)
  useEffect(() => { if (hud) try { window.localStorage.setItem(posKey, JSON.stringify({ lat: hud.lat, lon: hud.lon })) } catch { /* ohne Speicher */ } }, [hud?.lat, hud?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bewohner: wer in einem betretbaren Gebäude arbeitet, ist drinnen; sonst vor Arbeit oder Wohnung.
  // Draußen nur im Anzug (Thomas) – bis die Anzugfigur da ist, zeigt die Karte die normale Figur.
  useEffect(() => {
    if (!engine) return
    const byId = new Map(buildings.map(b => [b.id, b]))
    const people: WorldPerson[] = residents.slice(0, 24).flatMap(resident => {
      const work = resident.assignments.map(item => item.type === 'work' && item.tileEntityId ? byId.get(item.tileEntityId) : undefined).find(Boolean)
      const home = resident.assignments.map(item => item.tileEntityId ? byId.get(item.tileEntityId) : undefined).find(Boolean)
      const placeOf = work ?? home
      if (!placeOf) return []
      const state = String(resident.activityState ?? '').toLowerCase()
      const atWork = /work|produc|serv|operat/.test(state)
      const activity: WorldPerson['activity'] = /travel|move|commut|deliver|patrol/.test(state) ? 'move' : atWork ? 'work' : /idle|rest|sleep/.test(state) ? 'idle' : 'other'
      const inside = Boolean(atWork && work && getBuildingEntryDefinition(work.typeId)) || /sleep/.test(state)
      return [{
        id: resident.id, label: personSceneLabel(resident),
        look: kieselLookFor({ id: resident.id, appearance: resident.appearance as never }, atWork ? work?.typeId ?? null : null),
        pose: atWork ? workPoseFor(work?.typeId ?? null) : null,
        activity, inside,
        anchor: { lat: placeOf.lat, lon: placeOf.lon }, anchorRadiusM: Math.max(placeOf.w, placeOf.d) / 2,
      }]
    })
    engine.setPeople(people)
  }, [engine, residents, buildings])

  const selectedBuilding = panel.kind === 'building' ? buildings.find(b => b.id === panel.id) ?? null : null
  const selectedPerson = panel.kind === 'person' ? residents.find(r => r.id === panel.id) ?? null : null
  const buildingDistance = selectedBuilding && engine ? engine.distanceTo({ lat: selectedBuilding.lat, lon: selectedBuilding.lon }) : null
  const personAt = selectedPerson && engine ? engine.personAt(selectedPerson.id) : null
  const personDistance = personAt && engine ? engine.distanceTo(personAt) : null

  // Gebäude in der Nähe (für Gespräche und die Zielliste)
  const nearby = useMemo(() => {
    if (!engine) return []
    return buildings.map(b => ({ b, m: engine.distanceTo({ lat: b.lat, lon: b.lon }) })).sort((a, z) => a.m - z.m)
  }, [engine, buildings, hud?.lat, hud?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  function enter(building: NoxiaBuilding) {
    if (!getBuildingEntryDefinition(building.typeId) && !onEnterBuilding) return
    onEnterBuilding?.(building.id)
  }

  async function send() {
    if (!selectedPerson || !engine || !message.trim() || sending) return
    const person = selectedPerson
    const around = nearby
    const localFacts = [
      `Ort: ${place?.name ?? locationSlug} (${look?.name ?? body})`,
      'Draußen nur im Druckanzug oder im Fahrzeug; zwischen den Modulen führen Durchgänge.',
      ...around.filter(item => item.m <= 120).slice(0, 10).map(item => `In der Nähe: ${item.b.name} · ca. ${Math.max(1, Math.round(item.m))} m entfernt`),
    ]
    const nearbyPlaces = around.filter(item => item.m <= 400).slice(0, 12).map((item, i) => ({ key: 'b' + i, targetRef: item.b.id, name: item.b.name, kind: item.b.typeId, distanceM: Math.round(item.m), far: item.m > 120 }))
    const history = talk[person.id] ?? []
    const playerMessage = message.trim()
    setSending(true)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/npc-conversation', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: playerMessage, npcId: person.id, npcName: person.displayName,
          npcRole: person.assignments.find(item => item.type === 'work')?.roleCode ?? person.activityState,
          headline: `Gespräch in ${place?.name ?? locationSlug}`, source: 'NOXIA Weltkarte',
          locationName: place?.name ?? locationSlug, localFacts, nearbyPlaces, history,
        }),
      })
      const json = await response.json().catch(() => ({}))
      const reply = response.ok && json.reply ? String(json.reply) : 'Die Person kann gerade nicht antworten.'
      setTalk(current => ({ ...current, [person.id]: [...history, { role: 'user' as const, content: playerMessage }, { role: 'assistant' as const, content: reply }].slice(-10) }))
      if (response.ok) setMessage('')
      const action = json?.worldAction
      if (action?.type === 'visit_place') {
        const target = buildings.find(item => item.id === action.targetRef)
        if (target) {
          engine.sendPerson(person.id, { lat: target.lat, lon: target.lon }, Math.max(4, Math.min(120, Number(action.durationSeconds ?? 8))))
          if (action.playerFollows) engine.walkTo(() => engine.personAt(person.id), 3)
        }
      }
    } finally { setSending(false) }
  }

  if (!look) return <div style={{ padding: 20, color: '#eee' }}>Für {body} gibt es die neue Weltkarte noch nicht.</div>

  return (
    <div style={{ position: 'fixed', inset: 'var(--noxia-topbar-h,44px) 0 0', zIndex: 1120, background: '#000' }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {/* Kopfzeile: Ort, Ortszeit, zurück */}
      <div style={{ position: 'absolute', zIndex: 4, left: 14, top: 14, background: 'rgba(24,14,10,.88)', border: '1px solid #8a5a3c', borderRadius: 8, color: '#f1e4d4', font: '12px system-ui', padding: '8px 11px', maxWidth: 'calc(100% - 380px)', minWidth: 200 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{place?.name ?? '…'}</div>
        <div style={{ opacity: .85 }}>{look.name}{solTime ? ` · Ortszeit ${solTime} (Sol)` : ''}{hud?.near ? ' · ' + hud.near : ''}</div>
        {place && place.unplaced > 0 && <div style={{ opacity: .7, marginTop: 3 }}>{place.unplaced} Gebäude noch ohne Lage – fehlen auf der Karte.</div>}
        {error && <div style={{ color: '#ffb59a', marginTop: 4 }}>{error}</div>}
      </div>
      {onLeave && <button onClick={onLeave} style={{ ...button, position: 'absolute', zIndex: 4, left: 14, bottom: 24, marginTop: 0 }}>← Bisherige Kolonieansicht</button>}

      {selectedBuilding && (
        <div style={panelStyle}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedBuilding.name}</div>
          <div style={{ opacity: .8 }}>{selectedBuilding.ownerLabel}{buildingDistance != null ? ` · ${Math.round(buildingDistance)} m` : ''}</div>
          {buildingDistance != null && buildingDistance <= ENTER_RANGE_M + Math.max(selectedBuilding.w, selectedBuilding.d) / 2
            ? <button style={button} onClick={() => enter(selectedBuilding)}>Betreten</button>
            : <button style={button} onClick={() => engine?.walkTo(() => ({ lat: selectedBuilding.lat, lon: selectedBuilding.lon }), ENTER_RANGE_M + Math.max(selectedBuilding.w, selectedBuilding.d) / 2)}>Gehe hin</button>}
          <button style={button} onClick={() => setPanel({ kind: 'none' })}>Schließen</button>
        </div>
      )}

      {selectedPerson && (
        <div style={panelStyle}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{personSceneLabel(selectedPerson)}</div>
          <div style={{ opacity: .8 }}>{selectedPerson.activityState}{personDistance != null ? ` · ${Math.round(personDistance)} m` : ''}</div>
          {(talk[selectedPerson.id] ?? []).map((line, i) => <div key={i} style={{ marginTop: 6, color: line.role === 'user' ? '#ffd9b0' : '#f1e4d4' }}>{line.role === 'user' ? 'Du: ' : ''}{line.content}</div>)}
          {personDistance != null && personDistance <= TALK_RANGE_M
            ? <div style={{ marginTop: 8 }}>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Sag etwas …" style={{ width: '100%', boxSizing: 'border-box', background: '#2a1810', color: '#fff3e4', border: '1px solid #8a5a3c', borderRadius: 6, padding: 6, font: '13px system-ui' }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} />
              <button style={button} disabled={sending} onClick={() => void send()}>{sending ? '…' : 'Sagen'}</button>
            </div>
            : <button style={button} onClick={() => engine?.walkTo(() => engine.personAt(selectedPerson.id), TALK_RANGE_M - 1)}>Gehe hin</button>}
          <button style={button} onClick={() => setPanel({ kind: 'none' })}>Schließen</button>
        </div>
      )}
    </div>
  )
}
