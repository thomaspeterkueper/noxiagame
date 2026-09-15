'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDockingApproachOptions } from '@/lib/game/dockingApproach'
import { getShipDockingProfile } from '@/lib/game/shipDockingProfiles'
import { useGameStore } from '@/lib/store/gameStore'

type LivePort = {
  id: string
  stationSlug: string
  label: string
  portClass: 'shuttle' | 'standard' | 'heavy' | 'service'
  role: string
  cargoEnabled: boolean
  crewEnabled: boolean
  status: 'available' | 'reserved' | 'occupied' | 'offline'
  reservedForVesselId: string | null
  occupiedByVesselId: string | null
  reservationExpiresAt: string | null
  connectionId: string | null
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

export default function DockingApproachPlanner({ stationSlug, shipTypeId }: { stationSlug: string; shipTypeId: string }) {
  const shipId = useGameStore(s => s.shipId)
  const loadFromServer = useGameStore(s => s.loadFromServer)
  const shipProfile = getShipDockingProfile(shipTypeId)
  const staticOptions = useMemo(
    () => shipProfile ? getDockingApproachOptions(stationSlug, shipProfile.vesselClass) : [],
    [stationSlug, shipProfile],
  )
  const [ports, setPorts] = useState<LivePort[] | null>(null)
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [coreAvailable, setCoreAvailable] = useState(true)

  const loadPorts = useCallback(async () => {
    const token = await authToken()
    if (!token) return
    try {
      const res = await fetch(`/api/game/docking?stationSlug=${encodeURIComponent(stationSlug)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.code === 'DOCKING_CORE_NOT_DEPLOYED') {
          setCoreAvailable(false)
          setPorts(null)
          return
        }
        throw new Error(data?.error ?? 'Dockingstatus konnte nicht geladen werden.')
      }
      setCoreAvailable(true)
      setPorts(Array.isArray(data?.ports) ? data.ports : [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dockingstatus konnte nicht geladen werden.')
    }
  }, [stationSlug])

  useEffect(() => { void loadPorts() }, [loadPorts])

  const options = useMemo(() => {
    if (!shipProfile) return []
    if (!ports) return staticOptions.map(option => ({ ...option, live: null as LivePort | null }))
    const liveById = new Map(ports.map(port => [port.id, port]))
    return staticOptions.map(option => ({ ...option, live: liveById.get(option.port.id) ?? null }))
  }, [shipProfile, ports, staticOptions])

  useEffect(() => {
    const firstSelectable = options.find(option => !option.live || option.live.status === 'available' || option.live.reservedForVesselId === shipId || option.live.occupiedByVesselId === shipId)
    setSelectedPortId(firstSelectable?.port.id ?? options[0]?.port.id ?? null)
  }, [stationSlug, shipTypeId, shipId, options])

  if (!shipProfile || options.length === 0) return null

  const selected = options.find(option => option.port.id === selectedPortId) ?? null
  const selectedLive = selected?.live ?? null
  const reservedByMe = !!shipId && selectedLive?.reservedForVesselId === shipId
  const occupiedByMe = !!shipId && selectedLive?.occupiedByVesselId === shipId

  const command = useCallback(async (action: 'reserve' | 'dock' | 'undock' | 'cancel-reservation') => {
    if (!shipId || !selectedPortId) return
    setLoading(true)
    setMessage('')
    try {
      const token = await authToken()
      if (!token) throw new Error('Bitte melde dich erneut an.')
      const res = await fetch('/api/game/docking', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, shipId, portId: selectedPortId, commandId: crypto.randomUUID() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Docking-Vorgang fehlgeschlagen.')
      const labels = {
        reserve: 'Port reserviert.',
        dock: 'Schiff angedockt.',
        undock: 'Schiff abgedockt. Port wieder freigegeben.',
        'cancel-reservation': 'Reservierung aufgehoben.',
      } as const
      setMessage(labels[action])
      await Promise.all([loadPorts(), loadFromServer()])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Docking-Vorgang fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }, [shipId, selectedPortId, loadPorts, loadFromServer])

  return (
    <div style={{ marginTop: 10, padding: '9px 10px', background: '#0a1721', border: '1px solid #294052', borderRadius: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <strong style={{ fontSize: 10, color: '#c9a961', fontFamily: 'monospace', letterSpacing: '.08em' }}>ANFLUG / DOCKING</strong>
        <span style={{ fontSize: 9, color: coreAvailable && ports ? '#83c99a' : '#e0b060' }}>
          {coreAvailable && ports ? 'Core live' : 'Planungsmodus'}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
        {options.map(({ port, exactClassMatch, live }) => {
          const selectedNow = port.id === selectedPortId
          const status = live?.status ?? 'unknown'
          const mine = !!shipId && (live?.reservedForVesselId === shipId || live?.occupiedByVesselId === shipId)
          const disabled = !!live && status !== 'available' && !mine
          return (
            <button key={port.id} type="button" disabled={disabled} onClick={() => setSelectedPortId(port.id)} style={{
              padding: '5px 8px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
              border: `1px solid ${selectedNow ? '#c9a961' : '#294052'}`,
              background: selectedNow ? 'rgba(201,169,97,.12)' : '#0b1924',
              color: disabled ? '#566775' : selectedNow ? '#e2c978' : '#8aa0b5', fontSize: 10,
            }}>
              {port.label}{exactClassMatch ? ' · bevorzugt' : ''}{live ? ` · ${status}` : ''}
            </button>
          )
        })}
      </div>

      {selected && <div style={{ marginTop: 7, fontSize: 10, color: '#8aa0b5', lineHeight: 1.4 }}>
        Ziel: <strong style={{ color: '#d6e2ec' }}>{selected.port.label}</strong>.{' '}
        {selectedLive
          ? occupiedByMe ? 'Dieses Schiff ist an diesem Port physisch angedockt. Abdocken löst nur die Docking-Verbindung und bewegt keine Fracht.'
            : reservedByMe ? 'Port ist für dieses Schiff reserviert; der nächste Schritt ist Docking.'
            : selectedLive.status === 'available' ? 'Port ist aktuell frei und kann reserviert werden.'
            : `Portstatus: ${selectedLive.status}.`
          : 'Die Auswahl ist nur lokal; die persistente Core-Projektion ist noch nicht verfügbar.'}
      </div>}

      {coreAvailable && ports && shipId && selectedLive && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {selectedLive.status === 'available' && <button disabled={loading} onClick={() => void command('reserve')}>Port reservieren</button>}
          {reservedByMe && <button disabled={loading} onClick={() => void command('dock')}>Andocken</button>}
          {reservedByMe && <button disabled={loading} onClick={() => void command('cancel-reservation')}>Reservierung lösen</button>}
          {occupiedByMe && <button disabled={loading} onClick={() => void command('undock')}>Abdocken</button>}
        </div>
      )}

      {!coreAvailable && <div style={{ marginTop: 7, fontSize: 9, color: '#e0b060' }}>
        Der Docking-Core ist in dieser Datenbank noch nicht ausgerollt; deshalb bleibt diese Ansicht bewusst ohne Fake-Belegung.
      </div>}
      {message && <div style={{ marginTop: 7, fontSize: 10, color: '#d6e2ec' }}>{message}</div>}
    </div>
  )
}
