'use client'

// app/components/TicketCounter.tsx
// Ticketschalter für Linienflüge ohne eigenes Schiff (Thomas, 27.10.2026).
// Zeigt die Ziele vom aktuellen Ort mit Preis und Flugdauer (GET
// /api/game/transit?offers=1) und bucht über den bestehenden Abflug
// (POST /api/game/transit, Passagierweg auf dem Server). Danach übernimmt der
// Spielstand den Flug (loadFromServer → Flug-Overlay).

import { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { useGameStore } from '@/lib/store/gameStore'
import { flightDurationText, type PassengerOffer } from '@/lib/game/passengerOffers'

type Offers = { from: string | null; hasShip: boolean; inTransit: boolean; credits: number; offers: PassengerOffer[] }

export default function TicketCounter({ compact = false }: { compact?: boolean }) {
  const loadFromServer = useGameStore(state => state.loadFromServer)
  const [data, setData] = useState<Offers | null>(null)
  const [error, setError] = useState('')
  const [booking, setBooking] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const token = await getToken()
        const response = await fetch('/api/game/transit?offers=1', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const json = await response.json().catch(() => null)
        if (!live) return
        if (!response.ok || !json?.ok) { setError(String(json?.error ?? 'Flugplan nicht erreichbar.')); return }
        setData(json as Offers)
      } catch { if (live) setError('Flugplan nicht erreichbar.') }
    })()
    return () => { live = false }
  }, [])

  async function book(offer: PassengerOffer) {
    if (booking) return
    setBooking(offer.slug); setError('')
    try {
      const token = await getToken()
      const response = await fetch('/api/game/transit', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', destination: offer.slug }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) { setError(String(json.error ?? 'Buchung nicht möglich.')); return }
      // Der Spielstand liest den Flug vom Server und zeigt ihn an.
      await loadFromServer()
    } catch { setError('Buchung derzeit nicht erreichbar.') } finally { setBooking(null) }
  }

  const credits = data?.credits ?? 0
  return <div className={'ticket-counter' + (compact ? ' compact' : '')}>
    <div className="tc-head"><small>LINIENFLUG · TICKETSCHALTER</small>{data && <span>Guthaben {credits.toLocaleString('de-DE')} Cr</span>}</div>
    {!data && !error && <p>Flugplan wird geladen …</p>}
    {data?.inTransit && <p>Du bist bereits unterwegs.</p>}
    {data?.hasShip && <p>Du hast ein eigenes Schiff – Abflug über die Navigation. Der Linienflug ist für Reisende ohne Schiff.</p>}
    {data && !data.hasShip && !data.inTransit && (data.offers.length
      ? <ul>{data.offers.map(offer => <li key={offer.slug}>
          <div><b>{offer.name}</b><span>{flightDurationText(offer.durationSeconds)} Flug</span></div>
          <button disabled={Boolean(booking) || credits < offer.ticketPrice} title={credits < offer.ticketPrice ? 'Nicht genug Credits' : undefined} onClick={() => void book(offer)}>{booking === offer.slug ? '…' : `${offer.ticketPrice.toLocaleString('de-DE')} Cr`}</button>
        </li>)}</ul>
      : <p>Von hier gibt es keinen Linienflug.</p>)}
    {error && <p className="tc-error">{error}</p>}
    <style jsx>{`
      .ticket-counter{display:grid;gap:6px;padding:8px 0}
      .tc-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
      .tc-head small{color:#d7b96e;font:800 8px monospace;letter-spacing:.12em}
      .tc-head span{font-size:10px;color:#9db0b6}
      p{margin:0;font-size:11px;color:#b7c7cd;line-height:1.45}
      .tc-error{color:#f0a48a}
      ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}
      li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 8px;border:1px solid #2f4a57;border-radius:7px;background:#0a1c27}
      li div{display:grid;gap:1px}
      li b{font-size:12px;color:#eef5f7}
      li span{font-size:9px;color:#8ba3ad}
      button{border:1px solid #9b8545;border-radius:6px;background:#2a2413;color:#f3e2b0;padding:5px 10px;cursor:pointer;font-weight:700;white-space:nowrap}
      button:disabled{opacity:.45;cursor:not-allowed}
      .compact li{padding:5px 7px}
    `}</style>
  </div>
}
