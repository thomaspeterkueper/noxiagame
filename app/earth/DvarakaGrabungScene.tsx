'use client'

import { useEffect, useRef, useState } from 'react'
import { iso } from '@/lib/worldlab/facade'
import GrabungLab from './GrabungLab'
import { bookToMarkdown, campNear, emptyBook, noteAnalysis, noteFind, parseBook, type BookAnalysis, type Grabungsbuch } from '@/lib/worldlab/grabungsbuch'
import { useSitePresence, type SitePeer } from '@/lib/multiplayer/sitePresence'
import { BOUNDS, CAMP, FINDS, LAB, LABEL_TEXT, START, findNear, groundAt, labNear, stepTo, type Find, type Pt } from '@/lib/worldlab/dvarakaGrabung'

const SCALE = 0.9           // Bildpunkte je Meter
const SPEED = 38            // Meter je Sekunde (die Grabung ist groß; Erkundung soll flott gehen)

const COLORS = { land: '#c9b98a', shallow: '#7fb4b8', deep: '#2e6e86', mole: '#a89a76', out: '#10222c' }

/**
 * Begehbare Grabungsebene Dvārakā (Spielgegenwart). Von oben gesehen in der Isometrie der Weltkarte:
 * Hafenbecken, Molen, Flachwasser, Fundpunkte G1–G14 mit Fundzettel, Camp und Labor.
 * Steuerung: Pfeiltasten/WASD oder Klick. Der Hintergrund ist bewusst schlicht; die Funde tragen die Szene.
 */
export default function DvarakaGrabungScene({ partyId, me, onLeave }: { partyId?: string | null; me?: { profileId: string; name: string } | null; onLeave: () => void }) {
  const { peers, share } = useSitePresence(partyId ?? null, me ?? null)
  const peersRef = useRef<SitePeer[]>([])
  const shareRef = useRef(share)
  useEffect(() => { peersRef.current = peers }, [peers])
  useEffect(() => { shareRef.current = share }, [share])
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef({ pos: { ...START } as Pt, target: null as Pt | null, keys: new Set<string>() })
  const [near, setNear] = useState<Find | null>(null)
  const [opened, setOpened] = useState<Find | null>(null)
  const seen = useRef(new Set<string>())
  const [seenCount, setSeenCount] = useState(0)
  const [seenIds, setSeenIds] = useState<string[]>([])
  const [atLab, setAtLab] = useState(false)
  const [inLab, setInLab] = useState(false)
  const [atCamp, setAtCamp] = useState(false)
  const [inBook, setInBook] = useState(false)
  const [copied, setCopied] = useState(false)
  // Grabungsbuch: bleibt im Browser dieser Spielerin (nur Besuche und Messungen, die im Spiel geschahen)
  const BOOK_KEY = 'noxia:grabungsbuch:dvaraka'
  const [book, setBook] = useState<Grabungsbuch>(emptyBook)
  const bookRef = useRef(book)
  useEffect(() => {
    try { const loaded = parseBook(JSON.parse(localStorage.getItem(BOOK_KEY) ?? 'null')); bookRef.current = loaded; setBook(loaded); for (const id of loaded.finds) seen.current.add(id); setSeenCount(seen.current.size); setSeenIds([...seen.current]) } catch { /* ohne Speicher: nur diese Sitzung */ }
  }, [])
  const saveBook = (next: Grabungsbuch) => { bookRef.current = next; setBook(next); try { localStorage.setItem(BOOK_KEY, JSON.stringify(next)) } catch { /* ohne Speicher: nur diese Sitzung */ } }

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    const resize = () => { el.width = el.clientWidth * devicePixelRatio; el.height = el.clientHeight * devicePixelRatio }
    resize()
    window.addEventListener('resize', resize)

    // Bildkoordinate: Welt (x Ost, y Nord) → iso nutzt y nach Süden
    const toScreen = (p: Pt) => { const q = iso(p.x, -p.y, 0); return { x: q.x * SCALE, y: q.y * SCALE } }
    const fromScreen = (sx: number, sy: number, origin: { x: number; y: number }): Pt => {
      // iso: sx = x - ys ; sy = (x + ys) * 0.5   (ys = -y)  → x = (sx + 2*sy)/2 ; ys = (2*sy - sx)/2
      const ux = (sx - origin.x) / SCALE, uy = (sy - origin.y) / SCALE
      return { x: (ux + 2 * uy) / 2, y: -((2 * uy - ux) / 2) }
    }

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const s = state.current
      let dx = 0, dy = 0
      if (s.keys.has('ArrowLeft') || s.keys.has('a')) dx -= 1
      if (s.keys.has('ArrowRight') || s.keys.has('d')) dx += 1
      if (s.keys.has('ArrowUp') || s.keys.has('w')) dy += 1
      if (s.keys.has('ArrowDown') || s.keys.has('s')) dy -= 1
      if (dx || dy) { s.target = null; s.pos = stepTo(s.pos, { x: s.pos.x + dx * 100, y: s.pos.y + dy * 100 }, SPEED * dt) }
      else if (s.target) {
        s.pos = stepTo(s.pos, s.target, SPEED * dt)
        if (Math.hypot(s.target.x - s.pos.x, s.target.y - s.pos.y) < 1) s.target = null
      }
      const found = findNear(s.pos)
      setNear(prev => prev?.id === found?.id ? prev : found)
      if (found && !seen.current.has(found.id)) { seen.current.add(found.id); setSeenCount(seen.current.size); setSeenIds([...seen.current]); saveBook(noteFind(bookRef.current, found.id)) }
      const lab = labNear(s.pos)
      setAtLab(prev => prev === lab ? prev : lab)
      const camp = campNear(s.pos)
      setAtCamp(prev => prev === camp ? prev : camp)

      const w = el.width, h = el.height
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = COLORS.out; ctx.fillRect(0, 0, w, h)
      const centre = toScreen(s.pos)
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, w / 2 - centre.x * devicePixelRatio, h / 2 - centre.y * devicePixelRatio)

      // Gelände in Rasterzellen von 20 m zeichnen
      const step = 20
      for (let x = BOUNDS.minX; x < BOUNDS.maxX; x += step) for (let y = BOUNDS.minY; y < BOUNDS.maxY; y += step) {
        const g = groundAt({ x: x + step / 2, y: y + step / 2 })
        const a = toScreen({ x, y }), b = toScreen({ x: x + step, y }), c = toScreen({ x: x + step, y: y + step }), d = toScreen({ x, y: y + step })
        ctx.fillStyle = COLORS[g]
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = COLORS[g]; ctx.lineWidth = 0.6; ctx.stroke()
      }
      // Camp, Labor
      for (const [pt, text, color] of [[CAMP, 'Grabungscamp', '#e8e2c8'], [LAB, 'Labor', '#d6e2e8']] as const) {
        const p = toScreen(pt)
        ctx.fillStyle = color; ctx.strokeStyle = '#33424a'; ctx.lineWidth = 1
        ctx.fillRect(p.x - 9, p.y - 7, 18, 12); ctx.strokeRect(p.x - 9, p.y - 7, 18, 12)
        ctx.fillStyle = '#1b3540'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(text, p.x, p.y + 17)
      }
      // Fundpunkte
      for (const find of FINDS) {
        const p = toScreen(find.at)
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = find.label === 'R' ? '#d8bd68' : '#b9c7c2'; ctx.fill()
        ctx.strokeStyle = seen.current.has(find.id) ? '#1b7a4a' : '#33424a'; ctx.lineWidth = 1.5; ctx.stroke()
        ctx.fillStyle = '#10222c'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(find.id, p.x, p.y + 2.8)
      }
      // Mitspieler der Gruppe
      for (const peer of peersRef.current) {
        const p = toScreen({ x: peer.x, y: peer.y })
        ctx.beginPath(); ctx.arc(p.x, p.y - 5, 4, 0, Math.PI * 2); ctx.fillStyle = '#2e86c1'; ctx.fill(); ctx.fillRect(p.x - 3, p.y - 2, 6, 8)
        ctx.fillStyle = '#eaf2f6'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(peer.name, p.x, p.y - 12)
      }
      shareRef.current(s.pos.x, s.pos.y)
      // Spielfigur
      ctx.beginPath(); ctx.arc(centre.x, centre.y - 5, 4, 0, Math.PI * 2); ctx.fillStyle = '#c0392b'; ctx.fill()
      ctx.fillRect(centre.x - 3, centre.y - 2, 6, 8)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const down = (event: KeyboardEvent) => { state.current.keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key); if (event.key.startsWith('Arrow')) event.preventDefault() }
    const up = (event: KeyboardEvent) => { state.current.keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key) }
    const click = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const centre = toScreen(state.current.pos)
      const sx = event.clientX - rect.left - rect.width / 2 + centre.x * 1
      const sy = event.clientY - rect.top - rect.height / 2 + centre.y * 1
      state.current.target = fromScreen(sx, sy, { x: 0, y: 0 })
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); el.addEventListener('click', click)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); el.removeEventListener('click', click) }
  }, [])

  const shown = opened ?? null
  return (
    <div style={{ position: 'relative', width: '100%', height: 'min(70vh,520px)', borderRadius: 10, overflow: 'hidden', border: '1px solid #3d5b6a' }}>
      <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }} aria-label="Grabungsfeld Dvārakā" />
      <div style={{ position: 'absolute', left: 10, top: 8, color: '#d7e6ee', font: '11px/1.4 system-ui', textShadow: '0 1px 2px #000' }}>
        Pfeiltasten / WASD oder Klick · gefundene Stellen: {seenCount} von {FINDS.length}{peers.length ? ` · mit dir hier: ${peers.map(p => p.name).join(', ')}` : ''}
      </div>
      <button onClick={onLeave} style={{ position: 'absolute', right: 10, top: 8, border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '6px 10px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Aufwachen</button>
      {atLab && !near && !shown && !inLab && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, background: 'rgba(238,241,237,.96)', color: '#1b3540', borderRadius: 8, padding: '8px 10px', font: '12px/1.45 system-ui', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span><b>Grabungslabor</b><small style={{ display: 'block', color: '#65767b' }}>Proben analysieren, lernen, experimentieren</small></span>
          <button onClick={() => setInLab(true)} style={{ border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '6px 10px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Labor betreten</button>
        </div>
      )}
      {inLab && <GrabungLab seen={seenIds} past={book.analyses} onFinding={(entry: BookAnalysis) => saveBook(noteAnalysis(bookRef.current, entry))} onClose={() => setInLab(false)} />}
      {atCamp && !atLab && !near && !shown && !inLab && !inBook && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, background: 'rgba(238,241,237,.96)', color: '#1b3540', borderRadius: 8, padding: '8px 10px', font: '12px/1.45 system-ui', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span><b>Grabungscamp</b><small style={{ display: 'block', color: '#65767b' }}>Grabungsbuch: {book.finds.length} Fundstellen, {book.analyses.length} Befunde</small></span>
          <button onClick={() => setInBook(true)} style={{ border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '6px 10px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Grabungsbuch öffnen</button>
        </div>
      )}
      {inBook && (
        <div style={{ position: 'absolute', inset: 8, background: '#f4f1e4', color: '#2b2a22', border: '1px solid #b9ab7a', borderRadius: 10, display: 'flex', flexDirection: 'column', font: '12px/1.5 Georgia, serif', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#e6dfc0' }}>
            <strong>Grabungsbuch Dvārakā</strong>
            <span style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { void navigator.clipboard?.writeText(bookToMarkdown(book)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }, () => undefined) }} style={{ border: '1px solid #8a7e50', background: '#fff8dc', borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}>{copied ? 'Kopiert' : 'Als Markdown kopieren'}</button>
              <button onClick={() => setInBook(false)} aria-label="Buch schließen" style={{ border: 0, background: 'transparent', fontSize: 20, cursor: 'pointer' }}>×</button>
            </span>
          </div>
          <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
            <b>Fundstellen ({book.finds.length} von {FINDS.length})</b>
            {!book.finds.length && <p style={{ color: '#6a644a' }}>Noch keine besucht.</p>}
            {book.finds.map(id => { const find = FINDS.find(item => item.id === id); return find && <p key={id} style={{ margin: '6px 0' }}><b>{find.id} · {find.title}</b><br/>{find.text}<br/><small style={{ color: '#6a644a' }}>{LABEL_TEXT[find.label]} · Buchstelle: {find.ref}</small></p> })}
            <b>Laborbefunde</b>
            {!book.analyses.length && <p style={{ color: '#6a644a' }}>Noch keine Analyse. Im Grabungslabor lassen sich Proben von besuchten Fundstellen untersuchen.</p>}
            {book.analyses.map(item => <p key={item.sampleId + item.analysisId} style={{ margin: '6px 0' }}><small style={{ color: '#6a644a' }}>{item.source} · {item.analysisId}</small><br/><b>Messung:</b> {item.measurement}{item.interpretation && <><br/><b>Deutung:</b> {item.interpretation}</>}</p>)}
          </div>
        </div>
      )}
      {near && !shown && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, background: 'rgba(238,241,237,.96)', color: '#1b3540', borderRadius: 8, padding: '8px 10px', font: '12px/1.45 system-ui', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span><b>{near.id} · {near.title}</b><small style={{ display: 'block', color: '#65767b' }}>{LABEL_TEXT[near.label]}</small></span>
          <button onClick={() => setOpened(near)} style={{ border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '6px 10px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Fundzettel lesen</button>
        </div>
      )}
      {shown && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, background: '#f4f1e4', color: '#2b2a22', border: '1px solid #b9ab7a', borderRadius: 8, padding: '10px 12px', font: '12px/1.5 Georgia, serif' }}>
          <b>Fundzettel {shown.id} · {shown.title}</b>
          <p style={{ margin: '6px 0' }}>{shown.text}</p>
          <small style={{ color: '#6a644a' }}>{LABEL_TEXT[shown.label]} · Buchstelle: {shown.ref}</small>
          <div style={{ marginTop: 8 }}><button onClick={() => setOpened(null)} style={{ border: '1px solid #8a7e50', background: '#e6dfc0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Schließen</button></div>
        </div>
      )}
    </div>
  )
}
