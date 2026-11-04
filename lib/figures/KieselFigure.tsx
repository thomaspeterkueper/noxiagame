'use client'

// lib/figures/KieselFigure.tsx
// Kiesel-Figur für die Innenräume (04.11.2026). Zeichnet kieselSVG und läuft beim
// Gehen in vier Schritten; bei reduzierter Bewegung steht sie still.

import { useEffect, useState } from 'react'
import { kieselSVG, type KieselDir, type KieselLook, type KieselPose } from './kiesel'

let reduced: boolean | null = null
const reduceMotion = () => (reduced ??= typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export function KieselFigure({ look, dir = 'se', pose = 'stehen', width = 38, title }: { look: KieselLook; dir?: KieselDir; pose?: KieselPose; width?: number; title?: string }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (pose !== 'gehen' || reduceMotion()) { setFrame(0); return }
    const id = setInterval(() => setFrame(f => (f + 1) % 4), 150)
    return () => clearInterval(id)
  }, [pose])
  return <svg viewBox="0 0 64 96" width={width} height={width * 1.5} role="img" aria-label={title} style={{ display: 'block', overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: (title ? `<title>${title.replace(/[<&]/g, '')}</title>` : '') + kieselSVG(look, dir, pose, frame) }} />
}
