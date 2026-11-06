'use client'
// app/dashboard/FleetDispatch.tsx
// Erstellt: 06.11.2026 – eigene Schiffe am Ort: Ladung ansehen, Piloten wählen, Schiff losschicken oder an Bord gehen

import { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { useGameStore } from '@/lib/store/gameStore'
import { hiredPilotFee, type HiredPilot } from '@/lib/game/pilots'

type FleetShip = {
  id: string
  name: string | null
  shipTypeId: string | null
  location: string
  status: string
  aboard: boolean
  canDispatch: boolean
  cargo: Array<{ resource: string; amount: number }>
  pilots: HiredPilot[]
}

export default function FleetDispatch({ destination, destinationName, energy, onDone }: { destination: string; destinationName: string; energy: number | null; onDone: () => void }) {
  const [ships, setShips] = useState<FleetShip[]>([])
  const [pilot, setPilot] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const token = await getToken()
      const response = await fetch('/api/game/transit?fleet=1', { headers: { Authorization: `Bearer ${token}` } })
      const json = await response.json().catch(() => ({}))
      if (!cancelled && response.ok && json.ok) setShips(json.ships as FleetShip[])
    })()
    return () => { cancelled = true }
  }, [])

  const here = ships.filter(s => !s.aboard && s.status === 'docked' && s.canDispatch)
  if (here.length === 0) return null

  async function post(shipId: string, action: 'dispatch' | 'board', extra: Record<string, unknown> = {}) {
    setBusy(shipId + action)
    setMessage(null)
    try {
      const token = await getToken()
      const response = await fetch('/api/game/transit', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, shipId, ...extra }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) { setMessage(String(json.error ?? 'Das ist gerade nicht möglich.')); return }
      await useGameStore.getState().loadFromServer()
      onDone()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ marginTop: '8px', border: '1px solid #26405e', borderRadius: '8px', padding: '8px', background: '#0e1a2b' }}>
      <div style={{ fontSize: '0.72rem', color: '#7d93b0', marginBottom: '6px' }}>Deine Schiffe hier</div>
      {here.map(ship => {
        const pilots = ship.pilots
        const chosen = pilots[pilot[ship.id] ?? 1] ?? pilots[1]
        const fee = energy != null && chosen ? hiredPilotFee({ energy }, chosen) : null
        return (
          <div key={ship.id} style={{ borderTop: '1px solid #1b2f48', paddingTop: '6px', marginTop: '6px' }}>
            <div style={{ fontSize: '0.8rem', color: '#d7e3f4' }}>{ship.name ?? ship.shipTypeId ?? 'Schiff'}</div>
            <div style={{ fontSize: '0.68rem', color: '#7d93b0', margin: '2px 0 4px' }}>
              {ship.cargo.length ? `Ladung: ${ship.cargo.map(c => `${c.amount}t ${c.resource}`).join(', ')}` : 'Keine Ladung an Bord'}
            </div>
            <select
              value={pilot[ship.id] ?? 1}
              onChange={event => setPilot(prev => ({ ...prev, [ship.id]: Number(event.target.value) }))}
              style={{ width: '100%', fontSize: '0.74rem', padding: '4px', background: '#122033', color: '#d7e3f4', border: '1px solid #26405e', borderRadius: '6px' }}
            >
              {pilots.map(p => (
                <option key={p.index} value={p.index}>
                  {p.name} · {p.levelLabel}{energy != null ? ` · ${hiredPilotFee({ energy }, p).toLocaleString('de')} Cr` : ''}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                disabled={busy !== null}
                onClick={() => void post(ship.id, 'dispatch', { destination, pilot: pilot[ship.id] ?? 1 })}
                style={{ flex: 2, padding: '7px 0', fontSize: '0.76rem', borderRadius: '8px', border: '1px solid #4a6a99', background: '#122033', color: '#a9c4ee', cursor: 'pointer' }}
              >
                {busy === ship.id + 'dispatch' ? '…' : `Mit Pilot nach ${destinationName}${fee != null ? ` · ${fee.toLocaleString('de')} Cr` : ''}`}
              </button>
              <button
                disabled={busy !== null}
                onClick={() => void post(ship.id, 'board')}
                style={{ flex: 1, padding: '7px 0', fontSize: '0.76rem', borderRadius: '8px', border: '1px solid #3d7a64', background: '#12261f', color: '#9ee2c6', cursor: 'pointer' }}
              >
                {busy === ship.id + 'board' ? '…' : 'An Bord'}
              </button>
            </div>
          </div>
        )
      })}
      {message && <div style={{ fontSize: '0.7rem', color: '#e0846a', marginTop: '6px' }}>{message}</div>}
    </div>
  )
}
