'use client'

// app/world-lab/LandWork.tsx
// Feld, Weide und Steinbruch eines eigenen Flurstücks (NOXIA-MAT-0001). Zustand und Zahlen
// kommen vom Server (lib/worldlab/landWork.ts), die Knöpfe gehen über /api/game/parcel-offer.

import { useState } from 'react'
import type { fieldState, herdState, quarryState } from '@/lib/worldlab/landWork'
import MaterialStore from './MaterialStore'

type Field = ReturnType<typeof fieldState>
type Herd = ReturnType<typeof herdState>
type Quarry = ReturnType<typeof quarryState>

const cr = (value: number) => Math.round(value).toLocaleString('de-DE') + ' Cr'
const n = (value: number) => Math.round(value).toLocaleString('de-DE')
const date = (iso: string | null) => iso ? new Date(iso).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'

export default function LandWork({ field, herd, quarry, busy, act, version }: {
  field?: Field; herd?: Herd; quarry?: Quarry; busy: boolean; version: number
  act: (body: Record<string, unknown>, failText: string) => void
}) {
  const [count, setCount] = useState('')
  if (!field && !herd && !quarry) return null
  return <div className="work">
    {field && <>
      <small>DEIN FELD · {field.areaHa.toLocaleString('de-DE')} ha</small>
      {field.status === 'growing' && <p>{field.cropLabel} wächst ({Math.round(field.progress * 100)} %) – reif am {date(field.ripeAt)}, erwartet {n(field.expectedT)} t {field.goodLabel}.</p>}
      {field.canHarvest && <div className="row"><span>{field.cropLabel} ist reif{field.status === 'late' ? ' – spät, nur noch die Hälfte' : ''}: {n(field.expectedT)} t {field.goodLabel}.</span><button disabled={busy} onClick={() => act({ action: 'reap' }, 'Ernte nicht möglich.')}>Ernten</button></div>}
      {field.status === 'spoiled' && <p>Die letzte Ernte ist verdorben – zu spät geerntet.</p>}
      {field.status === 'harvested' && <p>Abgeerntet. Das Feld kann neu bestellt werden.</p>}
      {field.canSow && (field.options.length
        ? field.options.map(option => <div key={option.crop} className="row"><span>{option.label}: reif nach {option.growDays} Tagen, ≈ {n(option.yieldT)} t (Gemeinde zahlt {cr(option.value)})</span><button disabled={busy} onClick={() => act({ action: 'sow', crop: option.crop }, 'Säen nicht möglich.')}>Säen ({cr(option.fee)})</button></div>)
        : <p>Zu klein für einen Feldbau.</p>)}
    </>}
    {herd && <>
      <small>DEINE WEIDE · Platz für {n(herd.capacity)} Rinder</small>
      <p>{herd.count ? `${n(herd.count)} Rinder auf der Weide${herd.mature ? `, ${n(herd.mature)} schlachtreif` : ''}${herd.nextMatureAt ? ` – nächste schlachtreif am ${date(herd.nextMatureAt)}` : ''}.` : 'Noch keine Tiere. Jungrinder werden in einem Spieljahr (30 Tage) schlachtreif.'}</p>
      {herd.mature > 0 && <div className="row"><span>{n(herd.mature)} schlachtreife Rinder an die Gemeinde</span><button disabled={busy} onClick={() => act({ action: 'cattle_sell' }, 'Verkauf nicht möglich.')}>Verkaufen ({cr(herd.mature * herd.sellPrice)})</button></div>}
      {herd.free > 0 && <div className="row"><input value={count} inputMode="numeric" placeholder={`1–${herd.free}`} onChange={event => setCount(event.target.value.replace(/\D/g, '').slice(0, 4))}/><button disabled={busy || !(Number(count) >= 1 && Number(count) <= herd.free)} onClick={() => { act({ action: 'cattle_buy', count: Number(count) }, 'Kauf nicht möglich.'); setCount('') }}>Jungrinder kaufen ({cr((Number(count) || 0) * herd.buyPrice)})</button></div>}
      {herd.capacity < 1 && <p>Zu klein für Weidetiere.</p>}
    </>}
    {quarry && <>
      <small>DEIN STEINBRUCH · Vorrat {n(quarry.reserveT)} t</small>
      {quarry.exhausted
        ? <p>Erschöpft – hier ist kein Gestein mehr zu holen.</p>
        : <div className="row"><span>{quarry.extractableT > 0 ? `Abbaubereit: ${n(quarry.extractableT)} t Bruchstein (Sprengen und Laden ${cr(quarry.fee)})` : `Noch nichts abbaubereit – ${n(quarry.ratePerDay)} t je Tag.`}</span><button disabled={busy || quarry.extractableT < 1} onClick={() => act({ action: 'quarry' }, 'Abbau nicht möglich.')}>Abbauen</button></div>}
    </>}
    <MaterialStore version={version}/>
    <style jsx>{`
      .work{margin-top:8px;padding:6px 8px;border-radius:8px;background:rgba(150,120,60,.18)}
      .work small{display:block;font-size:10px;letter-spacing:.08em;color:#d6c39a;margin-top:2px}
      .work p{font-size:11px;margin:4px 0}
    `}</style>
  </div>
}
