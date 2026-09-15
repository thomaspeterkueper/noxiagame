'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  error?: string
}

type Inventory = {
  id: string
  owner_profile_id: string | null
  subject_type: string
  subject_id: string | null
  label: string
  active: boolean
}

type LogisticsPayload = {
  inventories?: Inventory[]
  error?: string
}

type Vehicle = {
  id: string
  frameId: string
  status: string
  label?: string
  currentNodeInventoryId?: string | null
}

type VehiclesPayload = {
  vehicles?: Vehicle[]
  error?: string
}

type CommandPayload = {
  ok?: boolean
  error?: string
  code?: string
}

const EARTH_STARTER_FRAME = 'eng-earth-cargo-rover-r1'

export default function EarthVehicleStagingPanel() {
  const [locationId, setLocationId] = useState('')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [vehicleId, setVehicleId] = useState('')
  const [targetInventoryId, setTargetInventoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const spatialResponse = await fetch('/api/game/build/spatial?location=earth', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      })
      const spatial = await spatialResponse.json() as SpatialPayload
      if (!spatialResponse.ok || !spatial.location?.id) throw new Error(spatial.error ?? 'Earth-Standort nicht aufgelöst')
      setLocationId(spatial.location.id)

      const [vehicleResponse, logisticsResponse] = await Promise.all([
        fetch(`/api/game/vehicles?locationId=${encodeURIComponent(spatial.location.id)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        }),
        fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatial.location.id)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        }),
      ])
      const vehiclePayload = await vehicleResponse.json() as VehiclesPayload
      const logisticsPayload = await logisticsResponse.json() as LogisticsPayload
      if (!vehicleResponse.ok) throw new Error(vehiclePayload.error ?? 'Fahrzeuge konnten nicht geladen werden')
      if (!logisticsResponse.ok) throw new Error(logisticsPayload.error ?? 'Inventare konnten nicht geladen werden')
      setVehicles(vehiclePayload.vehicles ?? [])
      setInventories((logisticsPayload.inventories ?? []).filter(item => item.active && item.subject_type === 'tile_entity' && item.subject_id))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => { void load() }, [])

  const earthVehicles = useMemo(() => vehicles.filter(vehicle => vehicle.frameId === EARTH_STARTER_FRAME), [vehicles])
  const selectedVehicle = earthVehicles.find(vehicle => vehicle.id === vehicleId) ?? null

  useEffect(() => {
    if (!vehicleId && earthVehicles[0]) setVehicleId(earthVehicles[0].id)
  }, [earthVehicles, vehicleId])

  useEffect(() => {
    if (!targetInventoryId && inventories[0]) setTargetInventoryId(inventories[0].id)
  }, [inventories, targetInventoryId])

  async function command(body: Record<string, unknown>) {
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch('/api/game/vehicles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json() as CommandPayload
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? payload.code ?? 'Fahrzeugvorgang fehlgeschlagen')
      await load()
      setMessage('Core-Zustand aktualisiert.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const stagedLabel = selectedVehicle?.currentNodeInventoryId
    ? inventories.find(item => item.id === selectedVehicle.currentNodeInventoryId)?.label ?? selectedVehicle.currentNodeInventoryId.slice(0, 8)
    : null

  return <section className="earth-logistics-console">
    <header>
      <div>
        <small>EARTH VEHICLES · CORE STAGING</small>
        <h2>Fahrzeug bereitstellen</h2>
        <p>Explizite Zuordnung eines Engineering-freigegebenen Earth-Fahrzeugs zu einem realen Logistikknoten. Kein Auto-Spawn und keine freie Repositionierung.</p>
      </div>
      <button onClick={() => void load()} disabled={busy}>Aktualisieren</button>
    </header>

    {message && <div className="notice"><span>{message}</span></div>}

    {!earthVehicles.length ? <div className="panel planner">
      <div className="panel-head"><strong>Noch kein Earth Cargo Rover</strong><span>Engineering r1</span></div>
      <p>Der ECR-8 wird zunächst nur am groben Earth-Standort erzeugt. Der exakte Logistikknoten wird anschließend separat gewählt.</p>
      <button
        className="primary"
        disabled={busy || !locationId}
        onClick={() => void command({ action: 'provision-earth-starter-cargo-rover', locationId })}
      >{busy ? 'Bereitstellung läuft …' : 'ECR-8 bereitstellen'}</button>
    </div> : <div className="panel planner">
      <div className="panel-head"><strong>Earth-Fahrzeug stagen</strong><span>expliziter Core-Command</span></div>
      <label>Fahrzeug<select value={vehicleId} onChange={event => setVehicleId(event.currentTarget.value)}>
        {earthVehicles.map(vehicle => <option value={vehicle.id} key={vehicle.id}>{vehicle.label ?? vehicle.frameId} · {vehicle.status}</option>)}
      </select></label>
      <label>Zielknoten<select value={targetInventoryId} onChange={event => setTargetInventoryId(event.currentTarget.value)}>
        <option value="">–</option>
        {inventories.map(inventory => <option value={inventory.id} key={inventory.id}>{inventory.label}</option>)}
      </select></label>
      <div className={stagedLabel ? 'notice' : 'notice error'}>
        <b>Aktueller exakter Knoten</b><span>{stagedLabel ?? 'noch nicht gesetzt'}</span>
      </div>
      <button
        className="primary"
        disabled={busy || !selectedVehicle || selectedVehicle.status !== 'ready' || !targetInventoryId || selectedVehicle.currentNodeInventoryId === targetInventoryId}
        onClick={() => void command({ action: 'stage-earth-vehicle', vehicleId: selectedVehicle?.id, targetInventoryId })}
      >{busy ? 'Staging läuft …' : 'Fahrzeug an Zielknoten bereitstellen'}</button>
      <p>Der Core akzeptiert nur eigene aktive räumliche Earth-Knoten und blockiert Fahrzeuge mit aktivem Transportjob.</p>
    </div>}
  </section>
}
