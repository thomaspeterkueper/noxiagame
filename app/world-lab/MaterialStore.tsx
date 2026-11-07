'use client'

// app/world-lab/MaterialStore.tsx
// Lager des Spielers auf der Erde (NOXIA-MAT-0001): Bestand, an die Gemeinde verkaufen,
// Rundholz im Sägewerk schneiden, Bruchstein zu Schotter brechen lassen. Baustoffe im Lager senken den Preis beim Bauen.

import { useCallback, useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'

type Row = { resource: string; name: string; unit: string; amount: number; buyPrice: number | null }

export default function MaterialStore({ version = 0 }: { version?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [sawFee, setSawFee] = useState(2)
  const [crushFee, setCrushFee] = useState(1)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/game/materials', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = await response.json().catch(() => null)
        if (!live || !json) return
        setRows(Array.isArray(json.stock) ? json.stock : [])
        if (Number.isFinite(json.sawFeePerM3)) setSawFee(Number(json.sawFeePerM3))
        if (Number.isFinite(json.crushFeePer2t)) setCrushFee(Number(json.crushFeePer2t))
      } catch { if (live) setRows([]) }
    })()
    return () => { live = false }
  }, [version, reload])

  const act = useCallback(async (body: Record<string, unknown>, done: (json: Record<string, number>) => string) => {
    if (busy) return
    setBusy(true); setNote('')
    try {
      const { token } = await getSessionInfo()
      const response = await fetch('/api/game/materials', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await response.json().catch(() => ({}))
      setNote(response.ok ? done(json) : String(json.error ?? 'Nicht möglich.'))
      setReload(value => value + 1)
    } catch { setNote('Gerade nicht erreichbar.') } finally { setBusy(false) }
  }, [busy])

  if (!rows) return null
  return <div className="store">
    <small>DEIN LAGER</small>
    {rows.length === 0 && <p>Leer. Holz, Ernte und Stein von eigenen Flurstücken landen hier; beim Bauen wird zuerst aus dem Lager genommen.</p>}
    {rows.map(row => <div key={row.resource} className="row">
      <span>{row.amount.toLocaleString('de-DE')} {row.unit} {row.name}</span>
      {row.resource === 'roundwood' && row.amount >= 2 && <button disabled={busy} title={`Ausbeute 60 %, ${sawFee} Cr je m³`} onClick={() => void act({ action: 'saw', amount: row.amount }, json => `Geschnitten: ${json.lumber} m³ Schnittholz (Gebühr ${json.fee} Cr).`)}>Sägen lassen</button>}
      {row.resource === 'stone' && <button disabled={busy} title={`1 t Bruchstein → 1 t Schotter, ${crushFee} Cr je angefangene 2 t`} onClick={() => void act({ action: 'crush', amount: row.amount }, json => `Gebrochen: ${json.out} t Schotter (Gebühr ${json.fee} Cr).`)}>Brechen lassen</button>}
      {row.buyPrice && <button disabled={busy} onClick={() => void act({ action: 'sell', resource: row.resource, amount: row.amount }, json => `Verkauft für ${json.total?.toLocaleString('de-DE')} Cr.`)}>Verkaufen ({(row.amount * row.buyPrice).toLocaleString('de-DE')} Cr)</button>}
    </div>)}
    {note && <p>{note}</p>}
    <style jsx>{`
      .store{margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12)}
      .store small{font-size:10px;letter-spacing:.08em;color:#9fb5b0}
      .store p{font-size:11px;margin:4px 0}
    `}</style>
  </div>
}
