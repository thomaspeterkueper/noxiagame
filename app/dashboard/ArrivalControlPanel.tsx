'use client'

import { useCallback, useEffect, useState } from 'react'
import { preferredHoldingZone } from '@/lib/game/arrivalControl'
import { getShipDockingProfile } from '@/lib/game/shipDockingProfiles'

type LiveArrival = {
  shipId: string
  stationSlug: string
  phase: 'arrival-rendezvous' | 'holding' | 'approach' | 'docked' | 'departing'
  holdingZoneId: string | null
  holdingReason: string | null
  queuePosition: number | null
  targetPortId: string | null
  updatedAt: string | null
}

async function authToken(): Promise<string | null> {
  const { createBrowserClient } = await import('@supabase/ssr')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

const PHASE_LABEL: Record<LiveArrival['phase'], string> = {
  'arrival-rendezvous': 'Rendezvous',
  holding: 'Holding',
  approach: 'Approach',
  docked: 'Docked',
  departing: 'Departing',
}

export default function ArrivalControlPanel({
  stationSlug,
  shipTypeId,
}: {
  stationSlug: string
  shipTypeId: string
}) {
  const shipProfile = getShipDockingProfile(shipTypeId)
  const holdingZone = shipProfile ? preferredHoldingZone(stationSlug, shipProfile.vesselClass) : null
  const [arrival, setArrival] = useState<LiveArrival | null>(null)
  const [coreLive, setCoreLive] = useState(false)

  const loadArrival = useCallback(async () => {
    const token = await authToken()
    if (!token) return
    try {
      const res = await fetch('/api/game/transit', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) return
      const live = data?.transit?.arrival as LiveArrival | null | undefined
      setArrival(live?.stationSlug === (stationSlug === 'kepler' ? 'prometheus' : stationSlug) ? live : null)
      setCoreLive(Boolean(live))
    } catch {
      setCoreLive(false)
    }
  }, [stationSlug])

  useEffect(() => {
    void loadArrival()
    const timer = window.setInterval(() => void loadArrival(), 5000)
    return () => window.clearInterval(timer)
  }, [loadArrival])

  if (!shipProfile || !holdingZone) return null

  const zoneLabel = arrival?.holdingZoneId ?? holdingZone.label
  const phase = arrival?.phase ?? null

  return (
    <div style={{ marginTop: 10, padding: '10px 11px', background: '#0a1620', border: '1px solid #2b4053', borderRadius: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <strong style={{ fontSize: 10, color: '#7fb8de', fontFamily: 'monospace', letterSpacing: '.08em' }}>
          ARRIVAL CONTROL
        </strong>
        <span style={{ fontSize: 9, color: coreLive ? '#83c99a' : '#64788a' }}>
          {coreLive ? 'Core live' : 'Core-Queue nicht aktiv'}
        </span>
      </div>

      <div style={{ marginTop: 7, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 6 }}>
        <div style={{ padding: 7, background: '#0b1924', borderRadius: 6, border: '1px solid #22384a' }}>
          <div style={{ fontSize: 9, color: '#64788a' }}>Holding Zone</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#d6e2ec', fontWeight: 700 }}>{zoneLabel}</div>
        </div>
        <div style={{ padding: 7, background: '#0b1924', borderRadius: 6, border: '1px solid #22384a' }}>
          <div style={{ fontSize: 9, color: '#64788a' }}>Traffic Class</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#c9a961', fontFamily: 'monospace' }}>{holdingZone.zoneClass}</div>
        </div>
        <div style={{ padding: 7, background: '#0b1924', borderRadius: 6, border: '1px solid #22384a' }}>
          <div style={{ fontSize: 9, color: '#64788a' }}>Phase</div>
          <div style={{ marginTop: 2, fontSize: 11, color: phase ? '#83c99a' : '#d6e2ec' }}>{phase ? PHASE_LABEL[phase] : '—'}</div>
        </div>
        <div style={{ padding: 7, background: '#0b1924', borderRadius: 6, border: '1px solid #22384a' }}>
          <div style={{ fontSize: 9, color: '#64788a' }}>Queue</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#d6e2ec' }}>
            {arrival?.phase === 'holding' && arrival.queuePosition ? `Position ${arrival.queuePosition}` : '—'}
          </div>
        </div>
        <div style={{ padding: 7, background: '#0b1924', borderRadius: 6, border: '1px solid #22384a' }}>
          <div style={{ fontSize: 9, color: '#64788a' }}>Zielport</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#d6e2ec' }}>{arrival?.targetPortId ?? '—'}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: '#8aa0b5', lineHeight: 1.45 }}>
        Transitende → Holding → Portfreigabe → Approach → Docked. Die Holding-Zone ist ein lokaler Rendezvous-/Traffic-Control-Korridor im Stationsbezugssystem, kein automatisch angenommener stabiler Orbit um den Zielkörper.
      </div>

      {arrival?.holdingReason && (
        <div style={{ marginTop: 6, fontSize: 9, color: '#e0b060' }}>
          Holding-Grund: {arrival.holdingReason.replaceAll('-', ' ')}
        </div>
      )}

      {!coreLive && (
        <div style={{ marginTop: 6, fontSize: 9, color: '#64788a' }}>
          Bis die neue Arrival-Core-Migration in dieser Datenbank aktiv ist, werden keine Queue-Positionen oder Portfreigaben erfunden.
        </div>
      )}
    </div>
  )
}
