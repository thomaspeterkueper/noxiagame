// SsfStatusCard.tsx
// Aktualisiert: 04.07.2026 — Header ergänzt; SSF-Status-Card
// Version:      0.1.0
'use client'

import React, { useEffect, useState } from 'react'
import { T } from './ui'

type SsfModule = {
  id?: string
  title?: string
  name?: string
  reward?: string
  unlocks?: string[]
}

export default function SsfStatusCard() {
  const [module, setModule] = useState<SsfModule | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/ssf/modules', { cache: 'no-store' })
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.modules ?? data.items ?? [])
        if (!cancelled) {
          setModule(list[0] ?? null)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const title = module?.title ?? module?.name ?? 'SSF-Lernmodul'
  const unlock = module?.reward ?? module?.unlocks?.[0] ?? 'NOXIA-Unlock'

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radiusLg, padding: '0.85rem 1rem', flexShrink: 0 }}>
      <div style={{ fontSize: '0.58rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, marginBottom: '0.45rem' }}>Wissenschaft · SSF</div>
      {status === 'loading' && <div style={{ fontSize: '0.72rem', color: T.inkFaint }}>Lade Lernmodule …</div>}
      {status === 'error' && <div style={{ fontSize: '0.72rem', color: T.red }}>SSF-Brücke nicht erreichbar.</div>}
      {status === 'ready' && (
        <>
          <div style={{ fontWeight: 700, color: T.blueDeep, fontSize: '0.85rem' }}>{title}</div>
          <div style={{ fontSize: '0.68rem', color: T.inkSoft, marginTop: '0.25rem' }}>Belohnung: {unlock}</div>
          <a href="/ssf" style={{ display: 'inline-block', marginTop: '0.55rem', fontSize: '0.68rem', color: T.blue, textDecoration: 'none', fontWeight: 700 }}>Module öffnen →</a>
        </>
      )}
    </div>
  )
}
