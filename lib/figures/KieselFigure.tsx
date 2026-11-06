'use client'

// lib/figures/KieselFigure.tsx
// Kiesel-Figur (04.11.2026). Zeichnet kieselSVG und läuft in vier Bildern, wenn die
// Pose sich bewegt (Gehen, Tanzen, Arbeit, Rangelei, Kampf); bei reduzierter
// Bewegung steht sie still. Hinfallen läuft einmal und bleibt liegen.
// KieselFigure ist ein eigenes <svg> (Innenräume, Porträts), KieselG eine Gruppe
// für Szenen, die selbst SVG sind (Erdkarte, Oberflächen).

import { useEffect, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { cleanPlayerLook, defaultPlayerLook } from './playerLook'
import { kieselAnimated, kieselDirFrom, kieselSVG, type KieselDir, type KieselLook, type KieselPose } from './kiesel'

let reduced: boolean | null = null
const reduceMotion = () => (reduced ??= typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

const TEMPO: Partial<Record<KieselPose, number>> = { trinken: 650, plaudern: 420, plaudern_sitzend: 460, gehen: 150, tragen: 150, tanzen: 230, polieren: 260, wischen: 280, haemmern: 210, hacken: 260, schaufeln: 300, schubsen: 200, hinfallen: 160, zuschlagen: 170, abwehren: 240, getroffen: 160 }

/** Bild 0–3 der Pose; Hinfallen bleibt am Ende stehen. */
export function useKieselFrame(pose: KieselPose, moving = false): number {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    setFrame(0)
    if (!kieselAnimated(pose, moving) || reduceMotion()) { if (pose === 'hinfallen') setFrame(3); return }
    const once = pose === 'hinfallen'
    const id = setInterval(() => setFrame(f => once ? Math.min(3, f + 1) : (f + 1) % 4), TEMPO[pose] ?? 180)
    return () => clearInterval(id)
  }, [pose, moving])
  return frame
}

/** Blickrichtung und Gehen aus der Lage auf dem Bildschirm, über die Renderings hinweg. */
export function useKieselMotion(x: number, y: number, idleMs = 350): { dir: KieselDir; moving: boolean } {
  const last = useRef<{ x: number; y: number; dir: KieselDir; at: number } | null>(null)
  const [, tick] = useState(0)
  const prev = last.current
  let dir: KieselDir = prev?.dir ?? 'se'
  let at = prev?.at ?? 0
  if (prev && (Math.abs(x - prev.x) > .3 || Math.abs(y - prev.y) > .3)) { dir = kieselDirFrom(x - prev.x, y - prev.y, prev.dir); at = Date.now() }
  const moving = at > 0 && Date.now() - at < idleMs
  useEffect(() => { last.current = { x, y, dir, at } })
  useEffect(() => { if (!moving) return; const id = setTimeout(() => tick(t => t + 1), idleMs); return () => clearTimeout(id) })
  return { dir, moving }
}

export function KieselFigure({ look, dir = 'se', pose = 'stehen', moving = false, width = 38, title }: { look: KieselLook; dir?: KieselDir; pose?: KieselPose; moving?: boolean; width?: number; title?: string }) {
  const frame = useKieselFrame(pose, moving)
  return <svg viewBox="0 0 64 96" width={width} height={width * 1.5} role="img" aria-label={title} style={{ display: 'block', overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: (title ? `<title>${title.replace(/[<&]/g, '')}</title>` : '') + kieselSVG(look, dir, pose, frame, moving) }} />
}

/** Für SVG-Szenen: Füße bei (0,0), Höhe in Bildpunkten der Szene. */
export function KieselG({ look, dir = 'se', pose = 'stehen', moving = false, height = 34 }: { look: KieselLook; dir?: KieselDir; pose?: KieselPose; moving?: boolean; height?: number }) {
  const frame = useKieselFrame(pose, moving)
  const k = height / 96
  return <g transform={`translate(${(-32 * k).toFixed(2)} ${(-90 * k).toFixed(2)}) scale(${k.toFixed(4)})`} dangerouslySetInnerHTML={{ __html: kieselSVG(look, dir, pose, frame, moving) }} />
}

let myId: string | null = null
/** Kennung der eigenen Figur – dieselbe auf Karte und im Lokal, damit man gleich aussieht. */
export function useMyFigureId(fallback = 'player'): string {
  const [id, setId] = useState(myId ?? fallback)
  useEffect(() => {
    if (myId) { setId(myId); return }
    let live = true
    getSessionInfo().then(({ userId }) => { if (userId) { myId = userId; if (live) setId(userId) } }).catch(() => {})
    return () => { live = false }
  }, [])
  return id
}

// ── Eigenes Aussehen (player_appearance), einmal geladen, überall gleich ──
let myLook: KieselLook | null = null
let loading: Promise<void> | null = null
const listeners = new Set<(l: KieselLook) => void>()
function setMine(l: KieselLook) { myLook = l; listeners.forEach(f => f(l)) }

/** Die eigene Figur – Vorgabe aus der Kennung, bis das gespeicherte Aussehen da ist. */
export function useMyLook(): { look: KieselLook; save: (next: KieselLook) => Promise<{ ok: boolean; error?: string }> } {
  const id = useMyFigureId()
  const [look, setLook] = useState<KieselLook>(myLook ?? defaultPlayerLook(id))
  useEffect(() => {
    const f = (l: KieselLook) => setLook(l)
    listeners.add(f)
    if (myLook) setLook(myLook)
    else {
      setLook(defaultPlayerLook(id))
      loading ??= (async () => {
        try {
          const { token, userId } = await getSessionInfo()
          if (!token || !userId) { loading = null; return }
          const r = await fetch('/api/game/appearance', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
          const d = await r.json().catch(() => ({}))
          if (r.ok && d.look) setMine(cleanPlayerLook(d.look, userId))
        } catch { loading = null }
      })()
    }
    return () => { listeners.delete(f) }
  }, [id])
  return {
    look,
    async save(next) {
      try {
        const { token, userId } = await getSessionInfo()
        if (!token || !userId) return { ok: false, error: 'Nicht angemeldet.' }
        const r = await fetch('/api/game/appearance', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ look: next }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) return { ok: false, error: String(d.error ?? 'Nicht gespeichert.') }
        setMine(cleanPlayerLook(d.look, userId))
        return { ok: true }
      } catch { return { ok: false, error: 'Keine Verbindung.' } }
    },
  }
}
