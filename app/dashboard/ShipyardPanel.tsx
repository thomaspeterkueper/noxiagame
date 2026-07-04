// ShipyardPanel.tsx
// Aktualisiert: 31.05.2026 — Werft-Panel
// Version:      0.1.0
// app/dashboard/ShipyardPanel.tsx
// Erstellt: 31.05.2026

'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/store/gameStore'

///-> hier?

async function getToken(): Promise<string | null> {
  const { createBrowserClient } = await import('@supabase/ssr')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}





interface ShipType {
  id:           string
  name:         string
  description:  string
  cost_credits: number
  cargo_max:    number
  speed_mult:   number
  available_at: string
}

export default function ShipyardPanel({ onPurchase, locations }: {
  onPurchase: () => void
  locations: any[]
}) {
  const { location, credits, shipTypeId, loadFromServer, loaded } = useGameStore()
  const [shipTypes, setShipTypes] = useState<ShipType[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const loadedFor = useRef<string | null>(null)

  const currentLoc = locations?.find((l: any) => l.slug === location)
  const hasShipyard = currentLoc?.has_shipyard ?? false

  useEffect(() => {
    if (!hasShipyard) return
    if (loadedFor.current === location) return

    async function loadShipTypes() {
      const token = await getToken()
      const res = await fetch('/api/game/ships', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setShipTypes(data.shipTypes ?? [])
      loadedFor.current = location

      
    }
    loadShipTypes()
  }, [location, hasShipyard])

 

  if (!hasShipyard) return null

if (!loaded) return (
  <div style={{ marginBottom: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
    🔧 Werft wird geladen...
  </div>
)

  async function handleBuyShip(typeId: string) {
    setLoading(true)
    setMsg(null)
    const token = await getToken()
    const res = await fetch(`/api/game/ships?action=buy&shipTypeId=${typeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()

    

    setLoading(false)
    if (data.ok) {
      setMsg({ text: `Schiff gekauft! Neuer Laderaum: ${data.cargoMax}t`, ok: true })
      await loadFromServer()
      onPurchase()
    } else {
      setMsg({ text: data.error, ok: false })
    }
  }

  const s = {
    btnPrimary:  { background: '#2a4e7a', color: '#fff', border: 'none', padding: '0.4rem 1rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', borderRadius: '4px', cursor: 'pointer' },
    btnDisabled: { background: '#e2ddd4', color: '#94a3b8', border: 'none', padding: '0.4rem 1rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', borderRadius: '4px', cursor: 'not-allowed' },
  }

 

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '3px', color: '#b99b6b', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>
        🔧 Werft – {currentLoc?.name}
      </span>

      {msg && (
        <div style={{
          padding: '0.6rem 1rem', borderRadius: '4px', marginBottom: '0.75rem',
          background: msg.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${msg.ok ? '#86efac' : '#fecaca'}`,
          fontSize: '0.8rem', color: msg.ok ? '#166534' : '#c0392b',
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2ddd4', borderRadius: '8px', overflow: 'hidden' }}>
        {shipTypes.length === 0 && (
          <div style={{ padding: '1.25rem', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>
            Lade Schiffe...
          </div>
        )}
        {shipTypes.map((st, i) => {
          const isCurrent = st.id === shipTypeId
          const canAfford = credits >= st.cost_credits
          const speedLabel = st.speed_mult < 1
            ? `${Math.round((1 - st.speed_mult) * 100)}% schneller`
            : st.speed_mult > 1
            ? `${Math.round((st.speed_mult - 1) * 100)}% langsamer`
            : 'Normalgeschwindigkeit'

          return (
            <div key={st.id} style={{
              padding: '1rem 1.25rem',
              borderBottom: i < shipTypes.length - 1 ? '1px solid #f1f1f1' : 'none',
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              alignItems: 'center',
              gap: '1.5rem',
              background: isCurrent ? '#f8faff' : '#fff',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2a4e7a', marginBottom: '0.2rem' }}>
                  🚀 {st.name}
                  {isCurrent && <span style={{ fontSize: '0.55rem', background: '#2a4e7a', color: '#fff', borderRadius: '3px', padding: '1px 6px', marginLeft: '6px' }}>AN BORD</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{st.description}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.2rem' }}>Laderaum</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e2a36' }}>{st.cargo_max}t</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.2rem' }}>Geschwindigkeit</div>
                <div style={{ fontWeight: 600, fontSize: '0.75rem', color: st.speed_mult < 1 ? '#27ae60' : st.speed_mult > 1 ? '#e67e22' : '#64748b' }}>
                  {speedLabel}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
  {isCurrent ? (
    <button style={s.btnDisabled} disabled>Aktuell</button>
  ) : st.cost_credits === 0 ? (
    <button
      style={s.btnPrimary}
      disabled={loading}
      onClick={() => handleBuyShip(st.id)}
    >
      Wechseln
    </button>
  ) : (
    <button
      style={{ ...s.btnPrimary, opacity: canAfford ? 1 : 0.5 }}
      disabled={!canAfford || loading}
      onClick={() => handleBuyShip(st.id)}
    >
      {st.cost_credits.toLocaleString('de')} Cr
    </button>
  )}
</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}