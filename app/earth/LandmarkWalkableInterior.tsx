'use client'

// app/earth/LandmarkWalkableInterior.tsx
// Aktualisiert: 12.10.2026 — Bibliotheksregale zeigen den Bücherbestand (Autor, Titel, Genre, Teaser); Begehbarer Innenraum für reale Landmarks (Bibliothek, Gotteshaus)
// Version:      1.1.0

import { useEffect, useMemo, useState } from 'react'
import {
  LANDMARK_ROOM,
  isLandmarkRoomBlocked,
  landmarkRoomLayout,
  nearestLandmarkSpot,
  type LandmarkPoint,
  type LandmarkRoomKind,
  type LandmarkSpot,
} from '@/lib/game/landmarks/interiors'
import { LIBRARY_BOOKS, LIBRARY_SHELVES } from '@/lib/game/landmarks/libraryCatalogue'

// Aufbau und Begehbarkeit kommen aus lib/game/landmarks/interiors.ts; diese
// Datei zeichnet nur. Der Raum ist ein typischer Grundriss für die Ortsart,
// nicht der vermessene Innenraum des realen Gebäudes.
type Props = {
  kind: LandmarkRoomKind
  name: string
  typeLabel: string
  facts: Array<{ label: string; value: string }>
  onClose: () => void
}

const SPEED = 12

export default function LandmarkWalkableInterior({ kind, name, typeLabel, facts, onClose }: Props) {
  const layout = useMemo(() => landmarkRoomLayout(kind), [kind])
  const [pos, setPos] = useState<LandmarkPoint>(layout.start)
  const [active, setActive] = useState<LandmarkSpot | null>(null)
  const [candles, setCandles] = useState(3)
  const [seated, setSeated] = useState(false)
  const [bookId, setBookId] = useState('')
  const book = LIBRARY_BOOKS.find(entry => entry.id === bookId) ?? null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input,textarea')) return
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
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
  }, [layout, onClose])

  const near = nearestLandmarkSpot(layout, pos)
  const nearExit = Math.hypot(pos.x - layout.exit.x, pos.y - layout.exit.y) < 46
  const shown = active && near?.id === active.id ? active : null

  return <div className="landmark-interior">
    <header><div><small>INNENRAUM · {typeLabel.toUpperCase()}</small><b>{name}</b><span>WASD bewegen · ESC verlassen</span></div><button onClick={onClose}>← Verlassen</button></header>
    <main>
      <div className={'room ' + layout.kind} style={{ width: LANDMARK_ROOM.width, height: LANDMARK_ROOM.height }}>
        <div className="door"><span>AUSGANG</span></div>
        {layout.furniture.map(item => <div key={item.id} className={'f ' + item.kind} style={{ left: item.x, top: item.y, width: item.w, height: item.h }}/>)}
        {layout.kind === 'worship' && Array.from({ length: Math.min(9, candles) }, (_, index) => <i key={index} className="flame" style={{ left: 654 + (index % 5) * 8, top: 88 + Math.floor(index / 5) * 9 }}/>)}
        <div className={'player' + (seated ? ' seated' : '')} style={{ left: pos.x - 10, top: pos.y - 24 }}><i/><span>Du</span></div>
        {near && <button className="context" style={{ left: near.x - 40, top: near.y + 12 }} onClick={() => setActive(near)}>{near.label}</button>}
        {nearExit && <button className="context exit" style={{ left: layout.exit.x - 60, top: layout.exit.y - 56 }} onClick={onClose}>{layout.noun.toUpperCase()} VERLASSEN</button>}
      </div>
      <aside>
        <small>{typeLabel.toUpperCase()} · REALER ORT</small>
        <h3>{shown ? shown.label.charAt(0) + shown.label.slice(1).toLowerCase() : name}</h3>
        {!shown && <p>Du kannst dich frei im Raum bewegen. Tritt an einen Bereich heran, um ihn näher anzusehen.</p>}
        {shown && <p>{shown.text}</p>}
        {shown?.action === 'books' && !book && <div className="books">{LIBRARY_SHELVES.map(shelf => <section key={shelf.id}>
          <h4>{shelf.label}</h4>
          {LIBRARY_BOOKS.filter(entry => entry.shelf === shelf.id).map(entry => <button key={entry.id} onClick={() => setBookId(entry.id)}><b>{entry.title}</b><span>{entry.genre}</span></button>)}
        </section>)}</div>}
        {shown?.action === 'books' && book && <div className="book">
          <span>{book.author}</span>
          <b>{book.title}</b>
          <i>{book.genre}</i>
          <p>{book.teaser}</p>
          <button className="act" onClick={() => setBookId('')}>← Zurück ins Regal</button>
        </div>}
        {shown?.action === 'learn' && <button className="act" onClick={() => window.location.assign('/ssf')}>Lernmodule der SSF öffnen</button>}
        {shown?.action === 'candle' && <button className="act" onClick={() => setCandles(count => Math.min(9, count + 1))}>Kerze anzünden</button>}
        {shown?.action === 'sit' && <button className="act" onClick={() => setSeated(value => !value)}>{seated ? 'Aufstehen' : 'Hinsetzen'}</button>}
        {facts.length > 0 && <dl>{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
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
      .room{position:relative;flex:none;border:6px solid #3a2f25;border-radius:6px;box-shadow:0 18px 40px #0009}
      .room.library{background:repeating-linear-gradient(90deg,#b99d76 0 38px,#b2956d 38px 40px)}
      .room.worship{background:repeating-conic-gradient(#cfc8b9 0 25%,#c4bcab 0 50%) 0 0/44px 44px}
      .door{position:absolute;left:330px;bottom:-6px;width:100px;height:8px;background:#e8dfc8;border-radius:2px}
      .door span{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);font:800 7px monospace;letter-spacing:.12em;color:#3a2f25}
      .f{position:absolute;border-radius:3px;box-shadow:0 3px 0 #0003}
      .f.shelf{background:repeating-linear-gradient(90deg,#6b3f2a 0 5px,#8a5a3a 5px 9px,#3f5d6b 9px 13px,#7a6a3a 13px 18px);border:2px solid #3b2518}
      .f.table{background:#8c6b47;border:2px solid #5d4428;border-radius:5px}
      .f.desk{background:#5f4630;border:2px solid #3b2a1a}
      .f.pew{background:#6d4c33;border:2px solid #42291a}
      .f.altar{background:#ece6d6;border:2px solid #9c9482}
      .f.lectern{background:#7b5a3c;border:2px solid #4a3320}
      .f.font{background:#b9c3c6;border:3px solid #7d8a8e;border-radius:50%}
      .f.candles{background:#4b4034;border:2px solid #2c251d}
      .flame{position:absolute;width:4px;height:7px;border-radius:50% 50% 45% 45%;background:#ffd76a;box-shadow:0 0 6px 2px #ffb84a99}
      .player{position:absolute;width:20px;height:28px;pointer-events:none}
      .player i{position:absolute;left:3px;top:8px;width:14px;height:18px;border-radius:7px 7px 3px 3px;background:#d4ad43;border:1.5px solid #594717}
      .player i::before{content:'';position:absolute;left:1.5px;top:-9px;width:8px;height:8px;border-radius:50%;background:#f0c49c;border:1.5px solid #493c18}
      .player.seated i{height:12px;top:14px}
      .player span{position:absolute;left:50%;top:-16px;transform:translateX(-50%);padding:1px 5px;border-radius:4px;background:#173845ee;border:1px solid #e4bd4b;font:800 8px system-ui;color:#fff7d8}
      .context{position:absolute;width:80px;padding:4px 0;border:1px solid #8a6a20;border-radius:5px;background:#2a220ef2;color:#f1dfa6;font:800 8px monospace;letter-spacing:.06em;cursor:pointer;z-index:2}
      .context.exit{width:120px;border-color:#52706f;background:#173638f2;color:#e6efec}
      aside{flex:none;width:300px;display:grid;gap:9px;padding:14px;border:1px solid #476263;border-radius:9px;background:#10272acc;font-size:11px;line-height:1.45}
      aside small{font:800 8px monospace;letter-spacing:.12em;color:#d7b96e}
      aside h3{margin:0;font-size:15px}
      aside p{margin:0;color:#d5e0dd}
      .act{border:1px solid #6e7d55;border-radius:5px;background:#273d24;color:#edf3dd;padding:7px 9px;font:800 9px monospace;cursor:pointer}
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
      .note{color:#7e9896;font-size:9px;border-top:1px solid #2f4a4b;padding-top:8px}
      @media(max-width:1120px){.landmark-interior main{flex-direction:column;align-items:center}aside{width:min(760px,100%)}}
    `}</style>
  </div>
}
