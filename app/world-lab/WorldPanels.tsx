'use client'

// app/world-lab/WorldPanels.tsx
// Tafeln der Weltkarte: Person, Gebäude, Innenraum.
//
// Grundsatz (Thomas, 25.10.2026 – in der alten Szene lagen Tafeln übereinander):
// Es ist immer höchstens EINE Tafel offen. Jede neue ersetzt die vorige; der
// Innenraum ersetzt alles. Nichts öffnet sich nebenbei. Eine Begleitung (Person,
// die zu einem Ort geht) ist keine Tafel, sondern ein Vermerk, der im Innenraum
// genutzt wird.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { getBuildingEntryDefinition, type BuildingEntryRequest } from '@/lib/game/buildings/entry'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import EarthBuildingAccessLayer from '@/app/earth/EarthBuildingAccessLayer'
import type { BlockKind } from '@/lib/worldlab/simplify'
import type { GeoPoint } from '@/lib/worldlab/mercator'
import type { NoxiaBuilding, WorldEngine, WorldPick } from './worldEngine'

export type Panel =
  | { kind: 'none' }
  | { kind: 'person'; id: string }
  | { kind: 'building'; at: GeoPoint; title: string; address?: string; noxiaId?: string }
  | { kind: 'inside'; request: BuildingEntryRequest; companionId: string | null }

const TALK_RANGE_M = 8
const ENTER_RANGE_M = 8
const BLOCK_NAMES: Record<BlockKind, string> = { house: 'Wohnhaus', row: 'Mehrfamilienhaus', hall: 'Halle', factory: 'Fabrik', church: 'Kirche', shed: 'Schuppen' }

function role(resident: ColonyResident) { return resident.assignments.find(item => item.type === 'work')?.roleCode ?? resident.activityState ?? 'general' }

/** Tafel zu einem Klick auf der Karte (Boden schließt die Tafel). */
export function panelForPick(pick: WorldPick, noxia: NoxiaBuilding[]): Panel {
  if (pick.type === 'person') return { kind: 'person', id: pick.id }
  if (pick.type === 'ground') return { kind: 'none' }
  const own = pick.noxiaId ? noxia.find(building => building.id === pick.noxiaId) : undefined
  if (pick.type === 'noxia') return own ? { kind: 'building', at: { lat: own.lat, lon: own.lon }, title: own.name, noxiaId: own.id } : { kind: 'none' }
  return { kind: 'building', at: pick.at, title: own?.name ?? pick.name ?? BLOCK_NAMES[pick.kind], address: pick.address, noxiaId: own?.id }
}

type Line = { role: 'user' | 'assistant'; content: string }

export default function WorldPanels({ engine, panel, setPanel, residents, noxia, tick }: {
  engine: WorldEngine | null
  panel: Panel
  setPanel: (panel: Panel) => void
  residents: ColonyResident[]
  noxia: NoxiaBuilding[]
  /** Steigt laufend (Anzeige der Karte), damit Abstände neu berechnet werden. */
  tick: number
}) {
  const [conversations, setConversations] = useState<Record<string, Line[]>>({})
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [walking, setWalking] = useState(false)
  /** Wer gerade wohin unterwegs ist (aus einem Gespräch): Person → NOXIA-Gebäude. */
  const [visits, setVisits] = useState<Record<string, string>>({})

  const person = panel.kind === 'person' ? residents.find(resident => resident.id === panel.id) ?? null : null
  const building = panel.kind === 'building' ? panel : null
  const own = building?.noxiaId ? noxia.find(item => item.id === building.noxiaId) ?? null : null
  const entry = own ? getBuildingEntryDefinition(own.typeId) : null

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

  // Jede neue Tafel beendet ein laufendes Hingehen und leert die Eingabe.
  const panelKey = panel.kind === 'person' ? 'p:' + panel.id : panel.kind === 'building' ? 'b:' + panel.at.lat + ',' + panel.at.lon : panel.kind
  const [shownKey, setShownKey] = useState(panelKey)
  if (shownKey !== panelKey) { setShownKey(panelKey); setWalking(false); setMessage('') }

  const close = useCallback(() => setPanel({ kind: 'none' }), [setPanel])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.('input,textarea,select')) return
      if (event.key === 'Escape' && panel.kind !== 'inside') close()
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
    const street = engine.nearestStreet()
    const nearbyPlaces = noxia
      .map(item => ({ item, distanceM: engine.distanceTo({ lat: item.lat, lon: item.lon }) }))
      .filter(entry => entry.distanceM <= 45).sort((a, b) => a.distanceM - b.distanceM).slice(0, 10)
      .map((entry, index) => ({ key: 'p' + index, targetRef: entry.item.id, name: entry.item.name, kind: entry.item.typeId, distanceM: Math.round(entry.distanceM) }))
    setSending(true)
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/npc-conversation', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: playerMessage, npcId: person.id, npcName: person.displayName, npcRole: role(person),
          headline: `Gespräch auf der Straße${street ? ' – ' + street : ''}`, source: 'NOXIA Weltkarte',
          locationName: street ? `${street}, Sundern` : 'Sundern', localFacts: street ? [`Ihr steht an der ${street}.`] : [],
          nearbyPlaces, history,
        }),
      })
      const json = await response.json().catch(() => ({}))
      const reply = response.ok && json.reply ? String(json.reply) : 'Die Person kann gerade nicht antworten.'
      setConversations(current => ({ ...current, [person.id]: [...(current[person.id] ?? []), { role: 'user' as const, content: playerMessage }, { role: 'assistant' as const, content: reply }].slice(-10) }))
      if (response.ok) setMessage('')
      const action = json?.worldAction
      if (action?.type === 'visit_place') {
        const target = noxia.find(item => item.id === action.targetRef)
        if (target) {
          const seconds = Math.max(4, Math.min(35, Number(action.durationSeconds ?? 8)))
          engine.sendPerson(person.id, { lat: target.lat, lon: target.lon }, seconds)
          setVisits(current => ({ ...current, [person.id]: target.id }))
          if (action.playerFollows) walkTo(() => engine.personAt(person.id), 3)
        }
      } else if (action?.type === 'lead_walk' && action.playerFollows) {
        walkTo(() => engine.personAt(person.id), 3)
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
  if (panel.kind === 'none') return null

  return <aside className="world-panel" role="dialog">
    {person && <>
      <div className="head"><div><small>PERSON</small><b>{personSceneLabel(person)}</b><span>{role(person)}</span></div><button onClick={close} aria-label="Schließen">×</button></div>
      <dl><dt>Tut gerade</dt><dd>{visits[person.id] ? 'geht zu ' + (noxia.find(item => item.id === visits[person.id])?.name ?? 'einem Ort') : person.activityState}</dd><dt>Zuletzt</dt><dd>{person.lastAction ?? '–'}</dd></dl>
      {(conversations[person.id] ?? []).map((line, index) => <p key={index}><b>{line.role === 'user' ? 'Du' : personSceneLabel(person)}:</b> „{line.content}“</p>)}
      {personDistance !== null && personDistance <= TALK_RANGE_M
        ? <div className="row"><input value={message} maxLength={80} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void talk() }} placeholder="Ansprechen …" autoFocus/><button disabled={sending || !message.trim()} onClick={() => void talk()}>{sending ? '…' : 'Sprechen'}</button></div>
        : <div className="row"><span>{personDistance === null ? 'Nicht in Sichtweite.' : `${Math.round(personDistance)} m entfernt – zu weit zum Ansprechen.`}</span>{personDistance !== null && <button onClick={() => walkTo(() => engine?.personAt(person.id) ?? null, TALK_RANGE_M - 2)}>{walking ? 'Gehe …' : 'Gehe hin'}</button>}</div>}
    </>}
    {!person && panel.kind === 'person' && <div className="head"><div><small>PERSON</small><b>Nicht mehr da</b></div><button onClick={close}>×</button></div>}
    {building && <>
      <div className="head"><div><small>{own ? 'NOXIA-GEBÄUDE' : 'GEBÄUDE'}</small><b>{building.title}</b>{building.address && <span>{building.address}</span>}</div><button onClick={close} aria-label="Schließen">×</button></div>
      {own && entry
        ? (buildingDistance !== null && buildingDistance <= ENTER_RANGE_M
          ? <div className="row"><span>Du stehst davor.</span><button onClick={enter}>{entry.label}</button></div>
          : <div className="row"><span>{buildingDistance === null ? '' : `${Math.round(buildingDistance)} m entfernt.`}</span><button onClick={() => walkTo(() => building.at, (own ? Math.max(own.w, own.d) / 2 : 6) + ENTER_RANGE_M - 3)}>{walking ? 'Gehe …' : 'Gehe hin'}</button></div>)
        : <div className="row"><span>{own ? 'Dieses Gebäude kann man nicht betreten.' : building.address ? 'Privathaus.' : 'Keine Anschrift bekannt.'}</span><button onClick={() => walkTo(() => building.at, 10)}>{walking ? 'Gehe …' : 'Gehe hin'}</button></div>}
    </>}
    <style jsx>{`
      .world-panel{position:absolute;right:14px;top:14px;width:300px;max-height:calc(100% - 28px);overflow:auto;padding:12px 14px;background:#0d1c22ee;border:1px solid #40595a;border-radius:8px;color:#eef2ed;font:12px system-ui;z-index:5}
      .head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}
      .head small{display:block;font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}
      .head b{display:block;font-size:15px}
      .head span{display:block;font-size:11px;color:#9fb5b0;margin-top:2px}
      .head button{border:0;background:none;color:#9fb5b0;font-size:18px;cursor:pointer;line-height:1}
      dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:4px 0 8px;font-size:11px}
      dt{color:#9fb5b0}dd{margin:0}
      p{margin:4px 0;font-size:11.5px;line-height:1.45}
      .row{display:flex;gap:6px;align-items:center;margin-top:8px}
      .row span{flex:1;font-size:11px;color:#9fb5b0}
      .row input{flex:1;min-width:0;border:1px solid #40595a;background:#08151a;color:#fff;border-radius:5px;padding:6px 8px;font-size:12px}
      .row button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
      .row button:disabled{opacity:.5;cursor:default}
      @media(max-width:700px){.world-panel{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:45%}}
    `}</style>
  </aside>
}
