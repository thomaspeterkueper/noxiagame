'use client'
// Sprechblasen über den Figuren der offenen Runde (Thomas, 02.11.2026). Lesbar bleibt es, weil
// immer nur eine Blase nacheinander erscheint, lange Sätze gekürzt sind und jede so lange steht,
// wie man zum Lesen braucht (lib/game/rounds/bubbles.ts). Den vollen Text zeigt der Verlauf.

import { useEffect, useRef, useState } from 'react'
import { queueBubbles, visibleBubbles, type Bubble } from '@/lib/game/rounds/bubbles'
import type { RoundLine } from './useRoundTalk'

export default function RoundBubbles({ lines, figures, width }: {
  lines: RoundLine[]
  figures: Array<{ id: string; x: number; y: number }>
  width: number
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [now, setNow] = useState(() => Date.now())
  const seen = useRef<Set<number>>(new Set())

  // Im Takt: neue Beiträge einreihen (jeder nur einmal), Uhr weiterstellen. Kein setState im Effektrumpf.
  useEffect(() => {
    const tick = () => {
      const t = Date.now()
      const fresh = lines.filter(line => !seen.current.has(line.id))
      fresh.forEach(line => seen.current.add(line.id))
      setBubbles(current => (fresh.length || current.length) ? queueBubbles(current, fresh.map(line => ({
        id: line.id, speakerId: line.speakerId, mine: line.mine, text: line.text,
        atMs: line.at ? Date.parse(line.at) || t : t,
      })), t) : current)
      setNow(t)
    }
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 400)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [lines])

  const shown = visibleBubbles(bubbles, now)
  return <>
    {shown.map(bubble => {
      const figure = figures.find(item => item.id === bubble.speakerId)
      if (!figure) return null
      const left = Math.min(width - 80, Math.max(80, figure.x))
      const top = Math.max(64, figure.y - 40)
      return <div key={bubble.id} className="bubble" role="status" style={{ left, top }}>
        {bubble.text}
        <style jsx>{`
          .bubble{position:absolute;z-index:7;transform:translate(-50%,-100%);width:max-content;max-width:150px;padding:5px 7px;border:1px solid #d9e6dd;border-radius:8px;background:#f4f8f5;color:#16241c;font-size:10px;line-height:1.35;box-shadow:0 2px 8px #0008;pointer-events:none;animation:in .18s ease-out}
          .bubble::after{content:'';position:absolute;left:50%;bottom:-5px;width:8px;height:8px;margin-left:-4px;background:#f4f8f5;border-right:1px solid #d9e6dd;border-bottom:1px solid #d9e6dd;transform:rotate(45deg)}
          @keyframes in{from{opacity:0;transform:translate(-50%,-90%)}to{opacity:1;transform:translate(-50%,-100%)}}
        `}</style>
      </div>
    })}
  </>
}
