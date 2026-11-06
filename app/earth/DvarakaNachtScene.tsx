'use client'

import { useEffect, useRef, useState } from 'react'
import { iso } from '@/lib/worldlab/facade'
import { useSitePresence, type SitePeer } from '@/lib/multiplayer/sitePresence'
import { NIGHT_BOUNDS, NIGHT_LABEL_TEXT, NIGHT_PLACES, NIGHT_START, nightFind, nightPlaceNear, nightStep, type NightPlace } from '@/lib/worldlab/dvarakaNacht'
import type { Pt } from '@/lib/worldlab/dvarakaGrabung'

const SCALE = 0.9
const SPEED = 38

/**
 * Chronomap Dvārakā, erste Szene: die dritte Nacht. Von oben gesehen in der Isometrie der Weltkarte, bei Nacht.
 * Orte nach dem Lageplan der Konzeptdatei; Tafeln erzählen nur, was dort aus dem Buch steht (F) oder was die
 * Grabung später fand (R). Gespräche folgen mit den Fakten aus dem Wissensgraphen.
 */
export default function DvarakaNachtScene({ partyId, me, onLeave }: { partyId?: string | null; me?: { profileId: string; name: string } | null; onLeave: () => void }) {
  const { peers, share } = useSitePresence(partyId ?? null, me ?? null)
  const peersRef = useRef<SitePeer[]>([])
  const shareRef = useRef(share)
  useEffect(() => { peersRef.current = peers }, [peers])
  useEffect(() => { shareRef.current = share }, [share])
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef({ pos: { ...NIGHT_START } as Pt, target: null as Pt | null, keys: new Set<string>() })
  const [near, setNear] = useState<NightPlace | null>(null)
  const [opened, setOpened] = useState<NightPlace | null>(null)
  const seen = useRef(new Set<string>())
  const [seenCount, setSeenCount] = useState(0)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    let raf = 0
    let last = performance.now()
    const resize = () => { el.width = el.clientWidth * devicePixelRatio; el.height = el.clientHeight * devicePixelRatio }
    resize()
    window.addEventListener('resize', resize)
    const toScreen = (p: Pt) => { const q = iso(p.x, -p.y, 0); return { x: q.x * SCALE, y: q.y * SCALE } }
    const fromScreen = (sx: number, sy: number): Pt => { const ux = sx / SCALE, uy = sy / SCALE; return { x: (ux + 2 * uy) / 2, y: -((2 * uy - ux) / 2) } }

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const s = state.current
      let dx = 0, dy = 0
      if (s.keys.has('ArrowLeft') || s.keys.has('a')) dx -= 1
      if (s.keys.has('ArrowRight') || s.keys.has('d')) dx += 1
      if (s.keys.has('ArrowUp') || s.keys.has('w')) dy += 1
      if (s.keys.has('ArrowDown') || s.keys.has('s')) dy -= 1
      if (dx || dy) { s.target = null; s.pos = nightStep(s.pos, { x: s.pos.x + dx * 100, y: s.pos.y + dy * 100 }, SPEED * dt) }
      else if (s.target) {
        s.pos = nightStep(s.pos, s.target, SPEED * dt)
        if (Math.hypot(s.target.x - s.pos.x, s.target.y - s.pos.y) < 1) s.target = null
      }
      const place = nightPlaceNear(s.pos)
      setNear(prev => prev?.id === place?.id ? prev : place)
      if (place && !seen.current.has(place.id)) { seen.current.add(place.id); setSeenCount(seen.current.size) }

      const w = el.width, h = el.height
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#0b1420'; ctx.fillRect(0, 0, w, h)
      const centre = toScreen(s.pos)
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, w / 2 - centre.x * devicePixelRatio, h / 2 - centre.y * devicePixelRatio)

      // Pflaster in Zellen; ab x = 800 steht die Felsstadt auf Fels, davor der Westbezirk auf altem Hafenschlick
      const step = 20
      for (let x = NIGHT_BOUNDS.minX; x < NIGHT_BOUNDS.maxX; x += step) for (let y = NIGHT_BOUNDS.minY; y < NIGHT_BOUNDS.maxY; y += step) {
        const a = toScreen({ x, y }), b = toScreen({ x: x + step, y }), c = toScreen({ x: x + step, y: y + step }), d = toScreen({ x, y: y + step })
        const col = x >= 800 ? '#3a3f48' : '#2f3a38'
        ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.6
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); ctx.stroke()
      }
      for (const place of NIGHT_PLACES) {
        const p = toScreen(place.at)
        const lit = seen.current.has(place.id)
        ctx.fillStyle = place.label === 'R' ? '#8a7a45' : '#59636c'; ctx.strokeStyle = lit ? '#e8c96a' : '#222c33'; ctx.lineWidth = 1.2
        ctx.fillRect(p.x - 10, p.y - 8, 20, 14); ctx.strokeRect(p.x - 10, p.y - 8, 20, 14)
        ctx.fillStyle = '#c8d4da'; ctx.font = '8px system-ui'; ctx.textAlign = 'center'; ctx.fillText(place.name, p.x, p.y + 17)
        // dunkle Lampe: nachts fallen die Lampensteine aus (Konzept, Kap. 4)
        ctx.beginPath(); ctx.arc(p.x + 12, p.y - 8, 2, 0, Math.PI * 2); ctx.fillStyle = '#1a1f24'; ctx.fill()
      }
      for (const peer of peersRef.current) {
        const p = toScreen({ x: peer.x, y: peer.y })
        ctx.beginPath(); ctx.arc(p.x, p.y - 5, 4, 0, Math.PI * 2); ctx.fillStyle = '#2e86c1'; ctx.fill(); ctx.fillRect(p.x - 3, p.y - 2, 6, 8)
        ctx.fillStyle = '#eaf2f6'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(peer.name, p.x, p.y - 12)
      }
      shareRef.current(s.pos.x, s.pos.y)
      ctx.beginPath(); ctx.arc(centre.x, centre.y - 5, 4, 0, Math.PI * 2); ctx.fillStyle = '#e07a5f'; ctx.fill()
      ctx.fillRect(centre.x - 3, centre.y - 2, 6, 8)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const down = (event: KeyboardEvent) => { state.current.keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key); if (event.key.startsWith('Arrow')) event.preventDefault() }
    const up = (event: KeyboardEvent) => { state.current.keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key) }
    const click = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const centre = toScreen(state.current.pos)
      state.current.target = fromScreen(event.clientX - rect.left - rect.width / 2 + centre.x, event.clientY - rect.top - rect.height / 2 + centre.y)
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); el.addEventListener('click', click)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); el.removeEventListener('click', click) }
  }, [])

  const button: React.CSSProperties = { border: '1px solid #476b79', background: '#183e4d', color: '#fff', borderRadius: 7, padding: '6px 10px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }
  const find = opened ? nightFind(opened) : null
  return (
    <div style={{ position: 'relative', width: '100%', height: 'min(70vh,520px)', borderRadius: 10, overflow: 'hidden', border: '1px solid #3d5b6a' }}>
      <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }} aria-label="Dvārakā in der dritten Nacht" />
      <div style={{ position: 'absolute', left: 10, top: 8, color: '#d7e6ee', font: '11px/1.4 system-ui', textShadow: '0 1px 2px #000' }}>
        Die dritte Nacht · um 1600 v. Chr. · Pfeiltasten / WASD oder Klick · besuchte Orte: {seenCount} von {NIGHT_PLACES.length}{peers.length ? ` · mit dir hier: ${peers.map(p => p.name).join(', ')}` : ''}
      </div>
      <button onClick={onLeave} style={{ position: 'absolute', right: 10, top: 8, ...button }}>Aufwachen</button>
      {near && !opened && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, background: 'rgba(238,241,237,.96)', color: '#1b3540', borderRadius: 8, padding: '8px 10px', font: '12px/1.45 system-ui', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span><b>{near.name}</b><small style={{ display: 'block', color: '#65767b' }}>{NIGHT_LABEL_TEXT[near.label]}</small></span>
          <button onClick={() => setOpened(near)} style={button}>Ansehen</button>
        </div>
      )}
      {opened && (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, background: '#f4f1e4', color: '#2b2a22', border: '1px solid #b9ab7a', borderRadius: 8, padding: '10px 12px', font: '12px/1.5 Georgia, serif' }}>
          <b>{opened.name}</b>
          <p style={{ margin: '6px 0' }}>{opened.text}</p>
          {opened.figures?.length ? <p style={{ margin: '6px 0' }}>In dieser Nacht hier: {opened.figures.join(', ')}.</p> : null}
          {find && <p style={{ margin: '6px 0', borderTop: '1px dashed #b9ab7a', paddingTop: 6 }}><b>Was die Grabung hier später fand ({find.id}):</b> {find.text}</p>}
          <small style={{ color: '#6a644a' }}>{NIGHT_LABEL_TEXT[opened.label]}</small>
          <div style={{ marginTop: 8 }}><button onClick={() => setOpened(null)} style={{ border: '1px solid #8a7e50', background: '#e6dfc0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Schließen</button></div>
        </div>
      )}
    </div>
  )
}
