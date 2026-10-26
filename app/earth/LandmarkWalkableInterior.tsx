'use client'

// app/earth/LandmarkWalkableInterior.tsx
// Aktualisiert: 26.10.2026 — an jedem Regal stöbern: Liste öffnet sich beim Herantreten, hohe Regale Romane, niedrige Sachbücher; Buchtipp springt zum passenden Regal; Bewohnter Raum: Bodenzonen, Lichtkegel, Schatten, Pflanzen, Sessel, Globus, Pinnwand; Bibliothekarin am Ausleihtresen mit Buchtipp und Gespräch über /api/game/npc-conversation
// Version:      2.1.0

import { useEffect, useMemo, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { NpcFigure, NpcVisualStyles } from '@/lib/grid/NpcVisual'
import {
  LANDMARK_ROOM,
  isLandmarkRoomBlocked,
  landmarkRoomLayout,
  landmarkStaffName,
  nearestLandmarkSpot,
  shelfAt,
  type LandmarkFurniture,
  type LandmarkPoint,
  type LandmarkRoomKind,
  type LandmarkSpot,
} from '@/lib/game/landmarks/interiors'
import { LIBRARY_BOOKS, LIBRARY_SHELVES, type LibraryBook } from '@/lib/game/landmarks/libraryCatalogue'

// Aufbau und Begehbarkeit kommen aus lib/game/landmarks/interiors.ts; diese
// Datei zeichnet und führt das Gespräch mit der angestellten Person. Der Raum
// ist ein typischer Grundriss für die Ortsart, nicht der vermessene Innenraum
// des realen Gebäudes.
type Props = {
  kind: LandmarkRoomKind
  name: string
  typeLabel: string
  facts: Array<{ label: string; value: string }>
  onClose: () => void
}
type ChatEntry = { role: 'user' | 'assistant'; content: string }

const SPEED = 12
const STAFF_REACH = 64

/** Was die Bibliothekarin über den Bestand weiß – kompakt genug für das Gesprächs-API. */
function catalogueLines(books: readonly LibraryBook[], maxChars = 136) {
  const lines: string[] = []
  let line = ''
  for (const book of books) {
    const genre = book.genre.split('/')[0].trim()
    const entry = `${book.title} (${genre})`
    if (line && line.length + entry.length + 2 > maxChars) { lines.push(line); line = '' }
    line = line ? `${line}; ${entry}` : entry
  }
  if (line) lines.push(line)
  return lines
}

/** Ein wechselnder Tipp: jeder Besuch und jede Nachfrage ein anderer Band. */
function pickTip(seed: number) {
  return LIBRARY_BOOKS[Math.abs(seed) % LIBRARY_BOOKS.length]
}

export default function LandmarkWalkableInterior({ kind, name, typeLabel, facts, onClose }: Props) {
  const layout = useMemo(() => landmarkRoomLayout(kind), [kind])
  const staffName = useMemo(() => landmarkStaffName(name), [name])
  const [pos, setPos] = useState<LandmarkPoint>(layout.start)
  const [active, setActive] = useState<LandmarkSpot | null>(null)
  const [candles, setCandles] = useState(3)
  const [seated, setSeated] = useState(false)
  const [bookId, setBookId] = useState('')
  const [talking, setTalking] = useState(false)
  const [history, setHistory] = useState<ChatEntry[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [tip, setTip] = useState<LibraryBook | null>(null)
  const tipSeed = useRef(Math.floor(Date.now() / 86_400_000))
  const book = LIBRARY_BOOKS.find(entry => entry.id === bookId) ?? null
  const staff = layout.staff

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input,textarea')) return
      if (event.key === 'Escape') { event.preventDefault(); if (talking) setTalking(false); else onClose(); return }
      const key = event.key.toLowerCase()
      if (!['w', 'a', 's', 'd'].includes(key)) return
      event.preventDefault()
      event.stopPropagation()
      setSeated(false)
      setPos(current => {
        const step = event.shiftKey ? SPEED * 1.6 : SPEED
        const next = { x: current.x + (key === 'd' ? step : key === 'a' ? -step : 0), y: current.y + (key === 's' ? step : key === 'w' ? -step : 0) }
        if (!isLandmarkRoomBlocked(layout, next)) return next
        const slideX = { x: next.x, y: current.y }
        if (!isLandmarkRoomBlocked(layout, slideX)) return slideX
        const slideY = { x: current.x, y: next.y }
        return isLandmarkRoomBlocked(layout, slideY) ? current : slideY
      })
    }
    // Capture phase: the surface below must not move the outdoor figure as well.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [layout, onClose, talking])

  const near = nearestLandmarkSpot(layout, pos)
  const shelf = layout.kind === 'library' ? shelfAt(layout, pos) : null
  const shelfBooks = shelf ? LIBRARY_BOOKS.filter(entry => entry.shelf === shelf.shelf) : []
  const shelfLabel = shelf ? LIBRARY_SHELVES.find(entry => entry.id === shelf.shelf)?.label ?? 'Regal' : ''
  const nearExit = Math.hypot(pos.x - layout.exit.x, pos.y - layout.exit.y) < 46
  const nearStaff = Boolean(staff && Math.hypot(pos.x - staff.x, pos.y - staff.y) <= STAFF_REACH)
  const shown = !shelf && active && near?.id === active.id ? active : null
  // Zu weit weg: das Gespräch endet, die Person bleibt am Tresen.
  useEffect(() => { if (!nearStaff && talking) setTalking(false) }, [nearStaff, talking])

  function startTalk() {
    if (!staff) return
    setTalking(true)
    setActive(null)
    if (!history.length) setHistory([{ role: 'assistant', content: staff.greeting }])
  }

  function giveTip() {
    tipSeed.current += 7
    const next = pickTip(tipSeed.current)
    setTip(next)
    setHistory(current => [...current, { role: 'assistant' as const, content: `Schau dir mal „${next.title}“ an – ${next.genre.split('/')[0].trim()}. ${next.teaser}` }].slice(-12))
  }

  async function talk() {
    if (!staff || !message.trim() || sending) return
    const text = message.trim().slice(0, 80)
    setSending(true)
    try {
      const { token } = await getSessionInfo()
      const fiction = LIBRARY_BOOKS.filter(entry => entry.shelf === 'romane')
      const nonfiction = LIBRARY_BOOKS.filter(entry => entry.shelf === 'sachbuecher')
      const response = await fetch('/api/game/npc-conversation', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: text,
          npcId: `landmark-staff:${name}`,
          npcName: staffName,
          npcRole: 'Bibliothekar(in)',
          headline: `Gespräch am Ausleihtresen der ${name}`,
          source: 'NOXIA library interior',
          locationName: name,
          localFacts: [
            `Du arbeitest an der Ausleihe der ${name} und kennst den Bestand genau.`,
            `Alle Bücher hier sind von Thomas Peter Küper. Du empfiehlst auf Nachfrage passende Titel aus dem Bestand und erfindest keine anderen.`,
            ...catalogueLines(fiction).map(line => `Romane und Erzählungen: ${line}`),
          ].slice(0, 16),
          placeKnowledge: catalogueLines(nonfiction).map(line => `Sachbücher: ${line}`),
          history: history.slice(-10),
        }),
      })
      const data = await response.json().catch(() => ({}))
      const reply = response.ok && data.reply ? String(data.reply) : 'Entschuldige, ich bin gerade beschäftigt – frag mich gleich noch einmal.'
      setHistory(current => [...current, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: reply }].slice(-12))
      setMessage('')
    } finally { setSending(false) }
  }

  const furnitureLabel = (item: LandmarkFurniture) => item.kind === 'counter' ? 'AUSLEIHE' : null

  return <div className="landmark-interior">
    <NpcVisualStyles/>
    <header><div><small>INNENRAUM · {typeLabel.toUpperCase()}</small><b>{name}</b><span>WASD bewegen · Person anklicken · ESC verlassen</span></div><button onClick={onClose}>← Verlassen</button></header>
    <main>
      <div className={'room ' + layout.kind} style={{ width: LANDMARK_ROOM.width, height: LANDMARK_ROOM.height }}>
        {layout.zones.map(zone => <div key={zone.id} className={'zone ' + zone.kind} style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h }}/>)}
        {layout.lamps.map((lamp, index) => <div key={index} className={'lamp' + (lamp.warm ? ' warm' : '')} style={{ left: lamp.x - lamp.r, top: lamp.y - lamp.r, width: lamp.r * 2, height: lamp.r * 2 }}/>)}
        <div className="door"><span>AUSGANG</span></div>
        {layout.furniture.map(item => <div key={item.id} className={'f ' + item.kind} style={{ left: item.x, top: item.y, width: item.w, height: item.h }}>
          {item.kind === 'shelf' && <i className="spines"/>}
          {item.kind === 'shelf-low' && <i className="spines low"/>}
          {item.kind === 'table' && <><i className="book-open"/><i className="lamp-small"/></>}
          {item.kind === 'pinboard' && <><i className="note n1"/><i className="note n2"/><i className="note n3"/></>}
          {furnitureLabel(item) && <span className="label">{furnitureLabel(item)}</span>}
        </div>)}
        {layout.kind === 'worship' && Array.from({ length: Math.min(9, candles) }, (_, index) => <i key={index} className="flame" style={{ left: 654 + (index % 5) * 8, top: 88 + Math.floor(index / 5) * 9 }}/>)}
        {staff && <div className="npc" style={{ left: staff.x - 12, top: staff.y - 34 }}>
          <NpcFigure id={`landmark-staff:${name}`} name={staffName} role={staff.role} showLabel={nearStaff || talking} showRoleLabel selected={talking} onClick={() => { if (nearStaff) startTalk() }}/>
        </div>}
        <div className={'player' + (seated ? ' seated' : '')} style={{ left: pos.x - 10, top: pos.y - 24 }}><i/><span>Du</span></div>
        {shelf && <button className="context" style={{ left: pos.x - 40, top: pos.y + 14 }} onClick={() => setTalking(false)}>STÖBERN</button>}
        {!shelf && near && near.action !== 'staff' && <button className="context" style={{ left: near.x - 40, top: near.y + 12 }} onClick={() => { setActive(near); setTalking(false) }}>{near.label}</button>}
        {staff && nearStaff && !talking && <button className="context" style={{ left: staff.x - 40, top: staff.y + 14 }} onClick={startTalk}>ANSPRECHEN</button>}
        {nearExit && <button className="context exit" style={{ left: layout.exit.x - 60, top: layout.exit.y - 56 }} onClick={onClose}>{layout.noun.toUpperCase()} VERLASSEN</button>}
      </div>
      <aside>
        <small>{typeLabel.toUpperCase()} · REALER ORT</small>
        <h3>{talking && staff ? staffName : shelf ? 'Regal' : shown ? shown.label.charAt(0) + shown.label.slice(1).toLowerCase() : name}</h3>
        {talking && staff && <>
          <p className="muted">{staff.role} · an der Ausleihe</p>
          <div className="history">{history.map((entry, index) => <p key={index}><b>{entry.role === 'user' ? 'Du' : staffName}:</b> „{entry.content}“</p>)}</div>
          {tip && <button className="tipcard" onClick={() => { setBookId(tip.id); setTalking(false) }}>
            <span>{tip.author}</span><b>{tip.title}</b><i>{tip.genre}</i><small>Klappentext lesen →</small>
          </button>}
          <div className="row"><button className="act" onClick={giveTip}>Buchtipp erbitten</button><button className="act quiet" onClick={() => setTalking(false)}>Gespräch beenden</button></div>
          <div className="chat"><input value={message} maxLength={80} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void talk() }} placeholder="Kurze Frage …"/><button disabled={sending || !message.trim()} onClick={() => void talk()}>{sending ? '…' : 'Sprechen'}</button></div>
        </>}
        {!talking && shelf && !book && <><p>{shelfLabel}. Zieh einen Band heraus, um Titel und Klappentext zu lesen.</p><div className="books"><section>
          {shelfBooks.map(entry => <button key={entry.id} onClick={() => setBookId(entry.id)}><b>{entry.title}</b><span>{entry.genre}</span></button>)}
        </section></div></>}
        {!talking && book && (shelf || !shown) && <div className="book">
          <span>{book.author}</span>
          <b>{book.title}</b>
          <i>{book.genre}</i>
          <p>{book.teaser}</p>
          <button className="act" onClick={() => setBookId('')}>← Zurück</button>
        </div>}
        {!talking && !shown && !shelf && !book && <p>Du kannst dich frei im Raum bewegen. Geh an ein Regal, um in den Büchern zu stöbern{staff ? `, oder sprich ${staffName} an der Ausleihe an` : ''}.</p>}
        {!talking && shown && <p>{shown.text}</p>}
        {!talking && shown?.action === 'learn' && <button className="act" onClick={() => window.location.assign('/ssf')}>Lernmodule der SSF öffnen</button>}
        {!talking && shown?.action === 'candle' && <button className="act" onClick={() => setCandles(count => Math.min(9, count + 1))}>Kerze anzünden</button>}
        {!talking && shown?.action === 'sit' && <button className="act" onClick={() => setSeated(value => !value)}>{seated ? 'Aufstehen' : 'Hinsetzen'}</button>}
        {!talking && facts.length > 0 && <dl>{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
        <div className="note">Typischer Grundriss für diese Ortsart – nicht der vermessene Innenraum des realen Gebäudes. Ortsdaten: OpenStreetMap.</div>
      </aside>
    </main>
    <style jsx>{`
      .landmark-interior{position:fixed;inset:44px 0 0;z-index:2600;background:#0d1718;color:#eef2ed;font-family:system-ui;display:flex;flex-direction:column}
      .landmark-interior header{height:54px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#10272a;border-bottom:1px solid #476263}
      .landmark-interior header small,.landmark-interior header b,.landmark-interior header span{display:block}
      .landmark-interior header small{font:800 8px monospace;letter-spacing:.14em;color:#d7b96e}
      .landmark-interior header b{font-size:14px}
      .landmark-interior header span{font-size:9px;color:#8ea4a6}
      .landmark-interior header button{border:1px solid #52706f;border-radius:6px;background:#173638;color:#e6efec;padding:7px 11px;cursor:pointer}
      .landmark-interior main{flex:1;min-height:0;display:flex;gap:16px;padding:16px;overflow:auto;align-items:flex-start;justify-content:center}
      .room{position:relative;flex:none;overflow:hidden;border:6px solid #3a2f25;border-radius:6px;box-shadow:0 18px 40px #0009}
      .room.library{background:repeating-linear-gradient(90deg,#b99d76 0 38px,#b2956d 38px 40px)}
      .room.worship{background:repeating-conic-gradient(#cfc8b9 0 25%,#c4bcab 0 50%) 0 0/44px 44px}
      .zone{position:absolute}
      .zone.tiles{background:repeating-conic-gradient(#d8d0c0 0 25%,#cbc2b1 0 50%) 0 0/32px 32px;box-shadow:inset 0 2px 0 #0002}
      .zone.carpet{background:#8d3a36;background-image:radial-gradient(#a24a44 1.2px,transparent 1.3px);background-size:9px 9px;border:3px solid #6e2a28;border-radius:4px;box-shadow:inset 0 0 0 6px #7a3230}
      .zone.rug{background:#4e6a8a;background-image:repeating-linear-gradient(45deg,#5a789a 0 6px,#4e6a8a 6px 12px);border:2px solid #3b526c;border-radius:3px}
      .zone.chancel{background:#d9d1bf;border-bottom:4px solid #b7ad97}
      .lamp{position:absolute;border-radius:50%;background:radial-gradient(circle,#ffffff66 0%,#ffffff22 40%,transparent 70%);pointer-events:none;mix-blend-mode:screen}
      .lamp.warm{background:radial-gradient(circle,#ffd98a77 0%,#ffcc6e2a 40%,transparent 70%)}
      .door{position:absolute;left:330px;bottom:-6px;width:100px;height:8px;background:#e8dfc8;border-radius:2px}
      .door span{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);font:800 7px monospace;letter-spacing:.12em;color:#3a2f25}
      .f{position:absolute;border-radius:3px;box-shadow:3px 4px 0 #0003}
      .f .label{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:800 7px monospace;letter-spacing:.12em;color:#f3ead6;text-shadow:0 1px 0 #0006;pointer-events:none}
      .f.shelf{background:#4a2c1c;border:2px solid #2d1a10}
      .f.shelf-low{background:#6b4a33;border:2px solid #3b2518;box-shadow:2px 2px 0 #0003}
      .spines{position:absolute;inset:3px;background:repeating-linear-gradient(90deg,#8a3a2e 0 4px,#2f5d6b 4px 7px,#c9a24a 7px 9px,#3f6b3a 9px 13px,#6a3d7a 13px 15px,#b7532f 15px 19px,#2a4a7a 19px 22px)}
      .spines.low{background:repeating-linear-gradient(90deg,#d8b24f 0 5px,#2f5d6b 5px 8px,#b24a3d 8px 12px,#3f6b3a 12px 14px)}
      .f.table{background:#8c6b47;border:2px solid #5d4428;border-radius:5px}
      .book-open{position:absolute;left:14px;top:14px;width:22px;height:14px;background:linear-gradient(90deg,#f5efe0 0 48%,#d9cfb8 48% 52%,#f5efe0 52%);border:1px solid #6b5438;border-radius:1px}
      .lamp-small{position:absolute;right:10px;top:8px;width:14px;height:10px;background:#2f6a4a;border-radius:7px 7px 2px 2px;box-shadow:0 0 10px 3px #ffe9a080}
      .f.desk{background:#5f4630;border:2px solid #3b2a1a}
      .f.counter{background:#6b4a33;border:2px solid #3b2518;border-top:5px solid #8a6648}
      .f.pew{background:#6d4c33;border:2px solid #42291a}
      .f.altar{background:#ece6d6;border:2px solid #9c9482}
      .f.lectern{background:#7b5a3c;border:2px solid #4a3320}
      .f.font{background:#b9c3c6;border:3px solid #7d8a8e;border-radius:50%}
      .f.candles{background:#4b4034;border:2px solid #2c251d}
      .f.armchair{background:#2f5f7a;border:2px solid #1e3f52;border-radius:9px 9px 5px 5px;box-shadow:inset 0 6px 0 #27506a,3px 4px 0 #0003}
      .f.sofa{background:#2f5f7a;border:2px solid #1e3f52;border-radius:8px;box-shadow:inset 0 8px 0 #27506a,inset 0 -5px 0 #27506a,3px 4px 0 #0003}
      .f.plant{background:radial-gradient(circle at 40% 40%,#6fae5a,#3f7a3a 60%,#2b5a2a);border:2px solid #243f22;border-radius:50%;box-shadow:2px 3px 0 #0003}
      .f.plant::after{content:'';position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#8fcc74;opacity:.7}
      .f.globe{background:radial-gradient(circle at 35% 35%,#9ccbe6,#2f6e9c 55%,#1c4466);border:2px solid #5a3b22;border-radius:50%;box-shadow:0 0 0 3px #8a5a3a,3px 4px 0 #0003}
      .f.pinboard{background:#b58a5a;border:2px solid #6b4a2b;box-shadow:none;border-radius:2px}
      .note{position:absolute;top:2px;width:10px;height:7px;border:1px solid #0003}
      .note.n1{left:6px;background:#f7e9a8}.note.n2{left:30px;background:#dfe9f5;top:1px}.note.n3{left:56px;background:#f4cfc9}
      .flame{position:absolute;width:4px;height:7px;border-radius:50% 50% 45% 45%;background:#ffd76a;box-shadow:0 0 6px 2px #ffb84a99}
      .npc{position:absolute;z-index:2}
      .player{position:absolute;width:20px;height:28px;pointer-events:none;z-index:3}
      .player i{position:absolute;left:3px;top:8px;width:14px;height:18px;border-radius:7px 7px 3px 3px;background:#d4ad43;border:1.5px solid #594717}
      .player i::before{content:'';position:absolute;left:1.5px;top:-9px;width:8px;height:8px;border-radius:50%;background:#f0c49c;border:1.5px solid #493c18}
      .player.seated i{height:12px;top:14px}
      .player span{position:absolute;left:50%;top:-16px;transform:translateX(-50%);padding:1px 5px;border-radius:4px;background:#173845ee;border:1px solid #e4bd4b;font:800 8px system-ui;color:#fff7d8}
      .context{position:absolute;width:80px;padding:4px 0;border:1px solid #8a6a20;border-radius:5px;background:#2a220ef2;color:#f1dfa6;font:800 8px monospace;letter-spacing:.06em;cursor:pointer;z-index:4}
      .context.exit{width:120px;border-color:#52706f;background:#173638f2;color:#e6efec}
      aside{flex:none;width:300px;display:grid;gap:9px;padding:14px;border:1px solid #476263;border-radius:9px;background:#10272acc;font-size:11px;line-height:1.45}
      aside small{font:800 8px monospace;letter-spacing:.12em;color:#d7b96e}
      aside h3{margin:0;font-size:15px}
      aside p{margin:0;color:#d5e0dd}
      aside p.muted{color:#8ea4a6;font-size:10px}
      .history{display:grid;gap:6px;max-height:220px;overflow:auto}
      .history p{padding-top:6px;border-top:1px solid #314753}
      .history p:first-child{border-top:0;padding-top:0}
      .row{display:flex;gap:6px}
      .act{border:1px solid #6e7d55;border-radius:5px;background:#273d24;color:#edf3dd;padding:7px 9px;font:800 9px monospace;cursor:pointer}
      .act.quiet{border-color:#476476;background:#102b3c;color:#dce9ee}
      .chat{display:flex;gap:6px}
      .chat input{flex:1;min-width:0;border:1px solid #476476;border-radius:6px;background:#061019;color:#eef5f7;padding:7px 8px}
      .chat button{border:1px solid #476476;border-radius:6px;background:#102b3c;color:#dce9ee;padding:6px 9px;cursor:pointer}
      .tipcard{display:grid;gap:2px;text-align:left;border:1px solid #c9a24a;border-radius:6px;background:#efe6d2;color:#2b2118;padding:8px 10px;cursor:pointer}
      .tipcard span{font:800 8px monospace;letter-spacing:.1em;color:#7a5a36}
      .tipcard b{font-size:12px}.tipcard i{font-size:9px;color:#6b5a48}.tipcard small{color:#7a5a36;font-weight:800}
      .books{display:grid;gap:10px;max-height:300px;overflow:auto;padding-right:4px}
      .books section{display:grid;gap:3px}
      .books h4{margin:0 0 2px;font:800 8px monospace;letter-spacing:.1em;color:#d7b96e}
      .books button{display:grid;gap:1px;text-align:left;border:0;border-left:3px solid #8a5a3a;border-radius:2px;background:#16302f;color:#eef2ed;padding:5px 8px;cursor:pointer}
      .books button:hover{background:#1d3d3c}
      .books button b{font-size:11px}
      .books button span{font-size:9px;color:#8ea4a6}
      .book{display:grid;gap:5px;padding:10px;border:1px solid #5d4428;border-radius:6px;background:#efe6d2;color:#2b2118}
      .book span{font:800 8px monospace;letter-spacing:.1em;color:#7a5a36}
      .book b{font-size:14px;line-height:1.2}
      .book i{font-size:10px;color:#6b5a48}
      .book p{margin:2px 0 4px;color:#2b2118;line-height:1.5}
      aside dl{margin:0;display:grid;gap:4px}
      aside dl div{display:grid;grid-template-columns:86px 1fr;gap:6px}
      aside dt{color:#7e9896}
      aside dd{margin:0}
      aside .note{position:static;width:auto;height:auto;border:0;color:#7e9896;font-size:9px;border-top:1px solid #2f4a4b;padding-top:8px}
      @media(max-width:1120px){.landmark-interior main{flex-direction:column;align-items:center}aside{width:min(760px,100%)}}
    `}</style>
  </div>
}
