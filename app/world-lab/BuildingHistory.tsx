'use client'
// Verlauf eines Gebäudes im Infofenster (Issue #541): Bau, Änderungen, Eigentümerwechsel, Abriss,
// nur aus dem angemeldeten Reader /api/world-lab/building-history. Lücken im Eventstore stehen
// offen da, es wird nichts geraten. Lädt erst beim Aufklappen.

import { useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { Chronicle, ChronicleEntry } from '@/lib/worldlab/buildingChronicle'
import { chronicleLine, chronicleGapLine } from '@/lib/worldlab/buildingChronicleText'

export default function BuildingHistory({ entityId, sourceRef }: { entityId?: string | null; sourceRef?: string | null }) {
  const [open, setOpen] = useState(false)
  const [chronicle, setChronicle] = useState<Chronicle | null>(null)
  const [error, setError] = useState(false)
  const key = (entityId ?? '') + '|' + (sourceRef ?? '')

  useEffect(() => { setChronicle(null); setError(false) }, [key])
  useEffect(() => {
    if (!open || chronicle || error || (!entityId && !sourceRef)) return
    let stale = false
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) throw new Error('keine Anmeldung')
        const query = new URLSearchParams()
        if (entityId) query.set('entityId', entityId)
        if (sourceRef) query.set('sourceRef', sourceRef)
        const response = await fetch('/api/world-lab/building-history?' + query, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        if (!response.ok) throw new Error(String(response.status))
        const json = await response.json() as Chronicle
        if (!stale) setChronicle(json)
      } catch { if (!stale) setError(true) }
    })()
    return () => { stale = true }
  }, [open, chronicle, error, entityId, sourceRef])

  if (!entityId && !sourceRef) return null
  const entries: ChronicleEntry[] = chronicle?.entries ?? []
  return <details className="history" open={open} onToggle={event => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
    <summary>Verlauf</summary>
    {open && !chronicle && !error && <p>Wird geladen …</p>}
    {error && <p>Der Verlauf ist gerade nicht erreichbar.</p>}
    {chronicle && !entries.length && <p>Noch nichts verzeichnet.</p>}
    {entries.length > 0 && <ol>{entries.map(entry => <li key={entry.id}><time dateTime={entry.at}>{new Date(entry.at).toLocaleDateString('de-DE')}</time> {chronicleLine(entry)}</li>)}</ol>}
    {chronicle?.gaps.map((gap, index) => <p key={index} className="gap">{chronicleGapLine(gap)}</p>)}
    <style jsx>{`
      .history{margin:6px 0;font-size:11px;color:#c9d8d3}
      .history summary{cursor:pointer;color:#d9bb6a;font-weight:700}
      .history ol{margin:4px 0 0;padding-left:16px;display:grid;gap:2px}
      .history time{color:#9fb5b0;font-variant-numeric:tabular-nums}
      .history p{margin:4px 0;color:#9fb5b0}
      .history .gap{color:#e0b08a}
    `}</style>
  </details>
}
