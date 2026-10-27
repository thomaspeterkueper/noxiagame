'use client'

// app/components/TravelAgency.tsx
// Reisebüro (Thomas, 27.10.2026): Reisen auf der Erde (Bahn bis 400 km, darüber
// Flug) und Linienflüge ins All (TicketCounter). Abfahrtsort ist `from` – das
// Reisebüro bzw. der Ort, an dem man steht (Heimreise aus der Ferne).

import { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import TicketCounter from './TicketCounter'
import { flightDurationText } from '@/lib/game/passengerOffers'
import type { EarthTripOffer, GeoPoint } from '@/lib/game/earthTrips'

export interface EarthTrip { id: string; destination_name: string; mode: 'rail' | 'air'; to_lat: number; to_lon: number; departed_at: string; arrives_at: string }
type Data = { offers: EarthTripOffer[]; home: EarthTripOffer | null; trip: EarthTrip | null; credits: number }

const MODE: Record<string, string> = { rail: '🚆 Bahn', air: '✈ Flug' }

export default function TravelAgency({ from, onBooked, homeOnly = false }: { from: GeoPoint; onBooked: (trip: EarthTrip) => void; homeOnly?: boolean }) {
  const [tab, setTab] = useState<'earth' | 'space'>('earth')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [booking, setBooking] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const token = await getToken()
        const response = await fetch(`/api/game/earth-trip?lat=${from.lat}&lon=${from.lon}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = await response.json().catch(() => null)
        if (!live) return
        if (!response.ok || !json?.ok) { setError(String(json?.error ?? 'Reiseangebote nicht erreichbar.')); return }
        setData(json as Data)
      } catch { if (live) setError('Reiseangebote nicht erreichbar.') }
    })()
    return () => { live = false }
  }, [from.lat, from.lon])

  async function book(offer: EarthTripOffer) {
    if (booking) return
    setBooking(offer.slug); setError('')
    try {
      const token = await getToken()
      const response = await fetch('/api/game/earth-trip', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'book', from, destination: offer.slug }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok || !json.trip) { setError(String(json.error ?? 'Buchung nicht möglich.')); return }
      onBooked(json.trip as EarthTrip)
    } catch { setError('Buchung derzeit nicht erreichbar.') } finally { setBooking(null) }
  }

  const credits = data?.credits ?? 0
  const row = (offer: EarthTripOffer, label?: string) => <li key={offer.slug}>
    <div><b>{label ?? offer.name}</b><span>{MODE[offer.mode]} · {offer.distanceKm.toLocaleString('de-DE')} km · {flightDurationText(offer.durationSeconds)}{offer.country && !label ? ` · ${offer.country}` : ''}</span></div>
    <button disabled={Boolean(booking) || credits < offer.price} title={credits < offer.price ? 'Nicht genug Credits' : undefined} onClick={() => void book(offer)}>{booking === offer.slug ? '…' : `${offer.price.toLocaleString('de-DE')} Cr`}</button>
  </li>

  return <div className="agency">
    <div className="ag-head"><small>{homeOnly ? 'WEITERREISE' : 'REISEBÜRO'}</small>{data && <span>Guthaben {credits.toLocaleString('de-DE')} Cr</span>}</div>
    {!homeOnly && <div className="tabs"><button className={tab === 'earth' ? 'on' : ''} onClick={() => setTab('earth')}>Erde</button><button className={tab === 'space' ? 'on' : ''} onClick={() => setTab('space')}>Weltraum</button></div>}
    {tab === 'space' && !homeOnly ? <TicketCounter compact/> : <>
      {!data && !error && <p>Fahrplan wird geladen …</p>}
      {data?.trip && <p>Du bist bereits unterwegs nach {data.trip.destination_name}.</p>}
      {data && !data.trip && <ul>
        {data.home && row(data.home, 'Heimreise nach Sundern')}
        {data.offers.map(offer => row(offer))}
        {!data.home && !data.offers.length && <p>Von hier gibt es keine Verbindung.</p>}
      </ul>}
    </>}
    {error && <p className="ag-error">{error}</p>}
    <style jsx>{`
      .agency{display:grid;gap:6px;padding:8px 0}
      .ag-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
      .ag-head small{color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}
      .ag-head span{font-size:10px;color:#9db0b6}
      .tabs{display:flex;gap:4px}
      .tabs button{flex:1;border:1px solid #2f4a57;border-radius:6px;background:#0a1c27;color:#9db0b6;padding:5px;cursor:pointer;font-size:11px}
      .tabs button.on{border-color:#9b8545;color:#f3e2b0;background:#2a2413}
      p{margin:0;font-size:11px;color:#b7c7cd;line-height:1.45}
      .ag-error{color:#f0a48a}
      ul{list-style:none;margin:0;padding:0;display:grid;gap:4px;max-height:320px;overflow:auto}
      li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 8px;border:1px solid #2f4a57;border-radius:7px;background:#0a1c27}
      li div{display:grid;gap:1px;min-width:0}
      li b{font-size:12px;color:#eef5f7}
      li span{font-size:9px;color:#8ba3ad}
      li button{border:1px solid #9b8545;border-radius:6px;background:#2a2413;color:#f3e2b0;padding:5px 10px;cursor:pointer;font-weight:700;white-space:nowrap}
      li button:disabled{opacity:.45;cursor:not-allowed}
    `}</style>
  </div>
}
