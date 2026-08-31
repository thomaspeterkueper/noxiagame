'use client'

import { useEffect, useMemo, useState } from 'react'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'

interface AwarenessResponse { items?: WorldAwarenessItem[] }

export default function WorldAwarenessTicker() {
  const [items, setItems] = useState<WorldAwarenessItem[]>([])
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/game/world-awareness')
      .then(response => response.ok ? response.json() as Promise<AwarenessResponse> : Promise.reject())
      .then(data => {
        if (live) setItems(Array.isArray(data.items) ? data.items.slice(0, 12) : [])
      })
      .catch(() => { if (live) setItems([]) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (items.length < 2) return
    const timer = setInterval(() => setIndex(value => (value + 1) % items.length), 12000)
    return () => clearInterval(timer)
  }, [items.length])

  const item = items[index % Math.max(1, items.length)]
  const source = useMemo(() => item ? sourceForAwarenessItem(item) : null, [item])
  if (!item) return null

  return (
    <div style={{ position: 'absolute', zIndex: 115, left: 12, top: 10, maxWidth: 420, pointerEvents: 'auto', fontFamily: 'monospace' }}>
      <button
        onClick={() => setOpen(value => !value)}
        style={{ width: '100%', textAlign: 'left', border: '1px solid #425b70', borderRadius: 7, background: '#081522e8', color: '#dbe7ee', padding: '7px 10px', cursor: 'pointer', boxShadow: '0 5px 18px #0005' }}
      >
        <span style={{ color: '#f1d57a', fontSize: 9, fontWeight: 800, letterSpacing: '.08em' }}>HEUTE AUF DER ERDE</span>
        <span style={{ display: 'block', marginTop: 3, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
      </button>
      {open && (
        <div style={{ marginTop: 4, border: '1px solid #425b70', borderRadius: 7, background: '#081522f4', color: '#bac9d3', padding: 10, fontSize: 10, lineHeight: 1.5 }}>
          {item.summary && <div>{item.summary}</div>}
          <div style={{ marginTop: 7, color: '#8396a5', fontSize: 9 }}>{source?.name ?? item.sourceId} · reale Meldung</div>
          <a href={item.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, color: '#f1d57a' }}>Quelle öffnen ↗</a>
          <div style={{ marginTop: 7, color: '#718493', fontSize: 9 }}>Diese Meldung kann Gesprächsthema der Kolonisten werden.</div>
        </div>
      )}
    </div>
  )
}
