'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  scannerOnline: boolean
  scanning: boolean
  scannerLabel: string
  onScan: () => void
}

type Player = { x: number; z: number; yaw: number }

const ROOM = { halfW: 6.2, halfD: 5.2 }
const TERMINAL = { x: 0, z: -3.9 }

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function distance(ax: number, az: number, bx: number, bz: number) {
  return Math.hypot(ax - bx, az - bz)
}

export default function ScannerFirstPerson({ scannerOnline, scanning, scannerLabel, onScan }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const playerRef = useRef<Player>({ x: 0, z: 2.5, yaw: Math.PI })
  const keysRef = useRef(new Set<string>())
  const dragRef = useRef<{ active: boolean; x: number }>({ active: false, x: 0 })
  const [nearTerminal, setNearTerminal] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)

  const interact = useCallback(() => {
    if (!scannerOnline || scanning || !nearTerminal) return
    onScan()
  }, [nearTerminal, onScan, scannerOnline, scanning])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'e'].includes(key)) event.preventDefault()
      if (key === 'e') interact()
      keysRef.current.add(key)
    }
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [interact])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let previous = performance.now()

    const project = (wx: number, wy: number, wz: number, player: Player, w: number, h: number) => {
      const dx = wx - player.x
      const dz = wz - player.z
      const sin = Math.sin(-player.yaw)
      const cos = Math.cos(-player.yaw)
      const cx = dx * cos - dz * sin
      const cz = dx * sin + dz * cos
      if (cz <= 0.12) return null
      const focal = Math.min(w, h) * 0.92
      return { x: w / 2 + (cx / cz) * focal, y: h * 0.53 - (wy / cz) * focal, z: cz }
    }

    const line3d = (a: [number, number, number], b: [number, number, number], player: Player, w: number, h: number, color: string, width = 1) => {
      const pa = project(a[0], a[1], a[2], player, w, h)
      const pb = project(b[0], b[1], b[2], player, w, h)
      if (!pa || !pb) return
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke()
    }

    const panel3d = (x0: number, x1: number, y0: number, y1: number, z: number, player: Player, w: number, h: number, fill: string, stroke: string) => {
      const p = [
        project(x0, y0, z, player, w, h),
        project(x1, y0, z, player, w, h),
        project(x1, y1, z, player, w, h),
        project(x0, y1, z, player, w, h),
      ]
      if (p.some(v => !v)) return
      ctx.beginPath()
      ctx.moveTo(p[0]!.x, p[0]!.y)
      for (let i = 1; i < p.length; i += 1) ctx.lineTo(p[i]!.x, p[i]!.y)
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = stroke
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    const render = (now: number) => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const targetW = Math.max(1, Math.floor(rect.width * dpr))
      const targetH = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const w = rect.width
      const h = rect.height

      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now
      const p = playerRef.current
      const keys = keysRef.current
      const turn = (keys.has('arrowleft') ? -1 : 0) + (keys.has('arrowright') ? 1 : 0)
      p.yaw += turn * dt * 1.75
      const forward = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0)
      const strafe = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
      const speed = 2.6
      if (forward || strafe) {
        const sin = Math.sin(p.yaw)
        const cos = Math.cos(p.yaw)
        p.x += (sin * forward + cos * strafe) * speed * dt
        p.z += (cos * forward - sin * strafe) * speed * dt
        p.x = clamp(p.x, -ROOM.halfW + 0.55, ROOM.halfW - 0.55)
        p.z = clamp(p.z, -ROOM.halfD + 0.65, ROOM.halfD - 0.65)
      }

      const close = distance(p.x, p.z, TERMINAL.x, TERMINAL.z) < 1.8
      setNearTerminal(old => old === close ? old : close)

      const sky = ctx.createLinearGradient(0, 0, 0, h)
      sky.addColorStop(0, '#061018')
      sky.addColorStop(0.52, '#102531')
      sky.addColorStop(0.53, '#16262b')
      sky.addColorStop(1, '#05090c')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)

      // floor / ceiling perspective grid
      for (let z = -5; z <= 5; z += 1) line3d([-6, -1.35, z], [6, -1.35, z], p, w, h, 'rgba(91,137,157,.24)')
      for (let x = -6; x <= 6; x += 1) line3d([x, -1.35, -5], [x, -1.35, 5], p, w, h, 'rgba(91,137,157,.20)')
      for (let z = -5; z <= 5; z += 2) line3d([-6, 2.6, z], [6, 2.6, z], p, w, h, 'rgba(66,102,119,.12)')

      // room frame
      const c = 'rgba(94,148,174,.58)'
      const corners: [number, number, number][] = [
        [-ROOM.halfW, -1.35, -ROOM.halfD], [ROOM.halfW, -1.35, -ROOM.halfD],
        [ROOM.halfW, -1.35, ROOM.halfD], [-ROOM.halfW, -1.35, ROOM.halfD],
      ]
      for (let i = 0; i < 4; i += 1) {
        const a = corners[i], b = corners[(i + 1) % 4]
        line3d(a, b, p, w, h, c, 2)
        line3d([a[0], 2.6, a[2]], [b[0], 2.6, b[2]], p, w, h, 'rgba(76,117,137,.28)')
        line3d(a, [a[0], 2.6, a[2]], p, w, h, 'rgba(72,118,141,.4)', 1.5)
      }

      // scanner terminal at north wall
      panel3d(-1.8, 1.8, -0.15, 1.65, -4.72, p, w, h, '#08202c', close ? '#d8bd69' : '#4f8097')
      panel3d(-1.45, 1.45, 0.08, 1.38, -4.69, p, w, h, '#0b3445', '#69a7c4')
      const screen = project(0, 0.72, -4.65, p, w, h)
      if (screen) {
        const radius = clamp(145 / screen.z, 8, 52)
        ctx.beginPath()
        ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = scannerOnline ? 'rgba(120,205,228,.85)' : 'rgba(210,90,80,.7)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(screen.x, screen.y, radius * 0.55, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(120,205,228,.35)'
        ctx.stroke()
        ctx.fillStyle = scannerOnline ? '#d7c675' : '#d06a60'
        ctx.beginPath(); ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2); ctx.fill()
      }

      // side consoles / cabinets
      panel3d(-5.6, -4.1, -0.8, 0.55, -3.9, p, w, h, '#101d23', '#355365')
      panel3d(4.1, 5.6, -0.8, 0.55, -3.9, p, w, h, '#101d23', '#355365')

      // subtle viewport crosshair
      ctx.strokeStyle = 'rgba(220,236,243,.36)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(w / 2 - 8, h / 2); ctx.lineTo(w / 2 + 8, h / 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - 8); ctx.lineTo(w / 2, h / 2 + 8); ctx.stroke()

      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [scannerOnline])

  return (
    <section style={{ position: 'relative', height: 430, border: '1px solid #36556a', borderRadius: 14, overflow: 'hidden', background: '#05090d', boxShadow: 'inset 0 0 80px #000,0 20px 60px #0008' }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Begehbarer Scannerraum"
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        onMouseDown={event => { dragRef.current = { active: true, x: event.clientX }; event.currentTarget.focus() }}
        onMouseMove={event => {
          if (!dragRef.current.active) return
          const dx = event.clientX - dragRef.current.x
          dragRef.current.x = event.clientX
          playerRef.current.yaw += dx * 0.006
        }}
        onMouseUp={() => { dragRef.current.active = false }}
        onMouseLeave={() => { dragRef.current.active = false }}
        style={{ width: '100%', height: '100%', display: 'block', cursor: dragRef.current.active ? 'grabbing' : 'grab', outline: 'none' }}
      />
      <div style={{ position: 'absolute', left: 14, top: 12, padding: '7px 9px', border: '1px solid #294a5d', borderRadius: 7, background: '#061017dd', fontFamily: 'monospace', fontSize: 10, color: '#8ab4c9' }}>
        WASD bewegen · ← → drehen · Maus ziehen · E interagieren
      </div>
      <div style={{ position: 'absolute', left: 14, bottom: 12, padding: '7px 9px', border: '1px solid #294a5d', borderRadius: 7, background: '#061017dd', fontFamily: 'monospace', fontSize: 10, color: scannerOnline ? '#91c7da' : '#df8b82' }}>
        {scannerLabel} · {hasFocus ? 'STEUERUNG AKTIV' : 'KLICKEN ZUM STEUERN'}
      </div>
      {nearTerminal && (
        <button
          onClick={interact}
          disabled={!scannerOnline || scanning}
          style={{ position: 'absolute', left: '50%', bottom: 26, transform: 'translateX(-50%)', padding: '10px 16px', border: '1px solid #b99b45', borderRadius: 8, background: scanning ? '#514922' : '#8a6a00', color: '#fff', fontWeight: 800, letterSpacing: '.06em', cursor: scanning ? 'wait' : 'pointer', boxShadow: '0 4px 20px #0008' }}
        >
          {scanning ? 'MESSUNG LÄUFT …' : 'E · SCAN AUSLÖSEN'}
        </button>
      )}
    </section>
  )
}
