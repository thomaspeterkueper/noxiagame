'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type SpatialEntity = { id: string; status: string }
type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  entities?: SpatialEntity[]
  error?: string
}
type Inventory = {
  id: string
  subject_type: string
  subject_id: string | null
  label: string
  active: boolean
}
type InventoryItem = { resource: string; label?: string; unit?: string; amount: number; available?: number }
type InventorySnapshot = { items?: InventoryItem[] }
type LogisticsPayload = { inventories?: Inventory[]; inventory?: InventorySnapshot; error?: string }
type Vehicle = {
  id: string
  frameId: string
  label?: string
  status: string
  currentNodeInventoryId?: string | null
}
type VehiclesPayload = { vehicles?: Vehicle[]; error?: string }
type MissionDraftPayload = {
  ok?: boolean
  ready?: boolean
  code?: string
  error?: string
  reason?: string
  routeId?: string
  frameId?: string
  vehicleRole?: string
  engineeringSourceId?: string | null
  cargo?: { resource: string; amount: number; unit?: string | null; massKg: number }
  route?: { distanceM: number; roadDistanceM: number; offroadDistanceM: number; segmentCount: number }
  estimate?: {
    feasible: boolean
    blockReasons: string[]
    distanceKm: number
    etaSeconds: number | null
    energyStoreId: string
    energyRequired: number | null
    energyUnit: string | null
    cargoMassKg: number | null
    cargoCapacityKg: number
    wearIncrement: number | null
  }
  routeSnapshot?: Record<string, unknown>
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return '–'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export default function EarthSurfaceMissionDraftPanel() {
  const [locationId, setLocationId] = useState('')
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [entityIds, setEntityIds] = useState<Set<string>>(new Set())
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [sourceId, setSourceId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [sourceSnapshot, setSourceSnapshot] = useState<InventorySnapshot | null>(null)
  const [resource, setResource] = useState('')
  const [amount, setAmount] = useState(1)
  const [draft, setDraft] = useState<MissionDraftPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [drafting, setDrafting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const spatialResponse = await fetch('/api/game/build/spatial?location=earth', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const spatial = await spatialResponse.json() as SpatialPayload
      if (!spatialResponse.ok || !spatial.location?.id) throw new Error(spatial.error ?? 'Earth-Zustand konnte nicht geladen werden')
      setLocationId(spatial.location.id)
      setEntityIds(new Set((spatial.entities ?? []).filter(entity => entity.status === 'active').map(entity => entity.id)))

      const [logisticsResponse, vehiclesResponse] = await Promise.all([
        fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatial.location.id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
        fetch(`/api/game/vehicles?locationId=${encodeURIComponent(spatial.location.id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
      ])
      const logistics = await logisticsResponse.json() as LogisticsPayload
      const vehiclePayload = await vehiclesResponse.json() as VehiclesPayload
      if (!logisticsResponse.ok) throw new Error(logistics.error ?? 'Logistikzustand konnte nicht geladen werden')
      if (!vehiclesResponse.ok) throw new Error(vehiclePayload.error ?? 'Fahrzeugzustand konnte nicht geladen werden')
      setInventories(logistics.inventories ?? [])
      setVehicles(vehiclePayload.vehicles ?? [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const spatialInventories = useMemo(() => inventories.filter(inventory =>
    inventory.active
    && inventory.subject_type === 'tile_entity'
    && Boolean(inventory.subject_id && entityIds.has(inventory.subject_id))), [inventories, entityIds])

  useEffect(() => {
    if (!sourceId && spatialInventories[0]) setSourceId(spatialInventories[0].id)
    if (!destinationId && spatialInventories[1]) setDestinationId(spatialInventories[1].id)
  }, [spatialInventories, sourceId, destinationId])

  useEffect(() => {
    const staged = vehicles.find(vehicle => vehicle.currentNodeInventoryId === sourceId && vehicle.status === 'ready')
    if (staged && vehicleId !== staged.id) setVehicleId(staged.id)
    else if (!vehicleId && vehicles[0]) setVehicleId(vehicles[0].id)
  }, [vehicles, sourceId, vehicleId])

  useEffect(() => {
    setDraft(null)
    setSourceSnapshot(null)
    setResource('')
    setAmount(1)
    if (!sourceId) return
    let cancelled = false
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch(`/api/game/logistics?inventoryId=${encodeURIComponent(sourceId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const payload = await response.json() as LogisticsPayload
        if (!cancelled && response.ok) setSourceSnapshot(payload.inventory ?? null)
      } catch {
        if (!cancelled) setSourceSnapshot(null)
      }
    })()
    return () => { cancelled = true }
  }, [sourceId])

  const stock = (sourceSnapshot?.items ?? []).filter(item => Number(item.available ?? item.amount) > 0)
  const selectedStock = stock.find(item => item.resource === resource)
  const available = Number(selectedStock?.available ?? selectedStock?.amount ?? 0)

  useEffect(() => {
    if (!resource && stock[0]) setResource(stock[0].resource)
  }, [resource, stock])

  useEffect(() => { setDraft(null) }, [destinationId, vehicleId, resource, amount])

  async function calculateDraft() {
    if (!sourceId || !destinationId || !vehicleId || !resource || amount <= 0 || amount > available) return
    setDrafting(true)
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const response = await fetch('/api/game/earth/surface-transport/draft', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceInventoryId: sourceId, destinationInventoryId: destinationId, vehicleId, resource, amount }),
        cache: 'no-store',
      })
      const payload = await response.json() as MissionDraftPayload
      setDraft(payload)
      if (!response.ok && !payload.error) setMessage('Mission-Draft wurde blockiert.')
    } catch (error) {
      setDraft(null)
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setDrafting(false)
    }
  }

  const selectedVehicle = vehicles.find(vehicle => vehicle.id === vehicleId)
  const stagedAtSource = Boolean(selectedVehicle && selectedVehicle.currentNodeInventoryId === sourceId)
  const inputsReady = Boolean(sourceId && destinationId && sourceId !== destinationId && vehicleId && resource && amount > 0 && amount <= available)

  return <section className="earth-mission-draft">
    <header>
      <div>
        <small>EARTH · SERVER MISSION DRAFT</small>
        <h2>Physikalische Transportfreigabe</h2>
        <p>OSM, Cargo-Masse, Engineering, Energie und Wear werden serverseitig erneut geprüft. Der Browser liefert nur die gewünschte Mission.</p>
      </div>
      <button onClick={() => void load()} disabled={loading}>{loading ? 'Lädt …' : 'Aktualisieren'}</button>
    </header>

    {message && <div className="notice bad">{message}</div>}
    {!locationId && !loading && <div className="notice bad">Earth-Location konnte nicht aufgelöst werden.</div>}

    <div className="grid">
      <div className="inputs">
        <label>Quelle<select value={sourceId} onChange={event => setSourceId(event.currentTarget.value)}><option value="">–</option>{spatialInventories.map(inventory => <option key={inventory.id} value={inventory.id}>{inventory.label}</option>)}</select></label>
        <label>Ziel<select value={destinationId} onChange={event => setDestinationId(event.currentTarget.value)}><option value="">–</option>{spatialInventories.filter(inventory => inventory.id !== sourceId).map(inventory => <option key={inventory.id} value={inventory.id}>{inventory.label}</option>)}</select></label>
        <label>Fahrzeug<select value={vehicleId} onChange={event => setVehicleId(event.currentTarget.value)}><option value="">–</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.label ?? vehicle.frameId} · {vehicle.status}{vehicle.currentNodeInventoryId === sourceId ? ' · am Quellknoten' : ''}</option>)}</select></label>
        <label>Ware<select value={resource} onChange={event => { setResource(event.currentTarget.value); setAmount(1) }}><option value="">–</option>{stock.map(item => <option key={item.resource} value={item.resource}>{item.label ?? item.resource} · {item.available ?? item.amount} {item.unit ?? ''}</option>)}</select></label>
        <label>Menge<input type="number" min={1} max={Math.max(1, available)} value={amount} onChange={event => setAmount(Math.max(1, Math.floor(Number(event.currentTarget.value) || 1)))} /></label>
        <div className={`stage ${stagedAtSource ? 'good' : ''}`}><b>{stagedAtSource ? 'Fahrzeug am Quellknoten' : 'Fahrzeug nicht am Quellknoten'}</b><span>{selectedVehicle?.currentNodeInventoryId ? `Node ${selectedVehicle.currentNodeInventoryId.slice(0, 8)}` : 'Bitte zuerst im Staging-Panel bereitstellen.'}</span></div>
        <button className="primary" disabled={!inputsReady || drafting || !stagedAtSource} onClick={() => void calculateDraft()}>{drafting ? 'Server prüft Mission …' : 'Server-Mission prüfen'}</button>
      </div>

      <div className="result">
        {!draft && <div className="notice">Noch kein serverseitiger Draft berechnet.</div>}
        {draft && !draft.ready && <div className="notice bad"><b>{draft.code ?? 'BLOCKED'}</b><span>{draft.error ?? draft.reason ?? 'Mission nicht freigegeben.'}</span></div>}
        {draft?.ready && draft.estimate && draft.route && <>
          <div className="ready"><small>MISSION DRAFT</small><b>freigegeben</b><span>{draft.frameId} · {draft.engineeringSourceId ?? 'Engineering source unresolved'}</span></div>
          <div className="metrics">
            <div><span>Distanz</span><b>{formatDistance(draft.route.distanceM)}</b></div>
            <div><span>ETA</span><b>{formatDuration(draft.estimate.etaSeconds)}</b></div>
            <div><span>Energie</span><b>{draft.estimate.energyRequired?.toFixed(2)} {draft.estimate.energyUnit ?? ''}</b></div>
            <div><span>Frachtmasse</span><b>{draft.estimate.cargoMassKg?.toFixed(0)} kg</b></div>
            <div><span>Kapazität</span><b>{draft.estimate.cargoCapacityKg.toFixed(0)} kg</b></div>
            <div><span>Wear</span><b>+{draft.estimate.wearIncrement?.toFixed(4)}</b></div>
            <div><span>Straße</span><b>{formatDistance(draft.route.roadDistanceM)}</b></div>
            <div><span>Offroad</span><b>{formatDistance(draft.route.offroadDistanceM)}</b></div>
          </div>
          <p className="hint">Der Route-Snapshot inklusive Geometrie ist jetzt serverseitig vorbereitet, wird aber noch nicht als TransportJob persistiert. Der nächste Schritt ist ein atomarer Create/Load/Start-Flow auf genau diesem Draft.</p>
        </>}
      </div>
    </div>

    <style jsx>{`
      .earth-mission-draft{max-width:1500px;margin:18px auto;padding:16px;box-sizing:border-box;background:#102632;color:#e7ece8;border:1px solid #425d67;border-radius:13px;font-family:system-ui,sans-serif}header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:12px}header small{font-size:9px;letter-spacing:.15em;color:#d1ad55;font-weight:900}h2{font-family:Georgia,serif;font-weight:400;font-size:22px;margin:3px 0}header p{margin:0;color:#9fb0b5;font-size:10px;max-width:820px}button{border:1px solid #8e7433;background:#d2a843;color:#102632;border-radius:7px;padding:8px 11px;font-weight:900;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}.grid{display:grid;grid-template-columns:minmax(300px,.8fr) 1.2fr;gap:10px}.inputs,.result{background:#132f3a;border:1px solid #35525d;border-radius:9px;padding:11px;min-width:0}label{display:grid;gap:4px;color:#9fb0b5;font-size:9px;margin:6px 0}select,input{width:100%;box-sizing:border-box;background:#0b202a;color:#e7ece8;border:1px solid #46616a;border-radius:6px;padding:8px}.primary{width:100%;margin-top:8px}.stage,.ready{display:grid;gap:3px;background:#0d2530;border:1px solid #43575e;border-radius:7px;padding:8px;margin-top:8px}.stage.good,.ready{background:#10342f;border-color:#39705c}.stage b,.ready b{font-size:10px}.stage span,.ready span,.ready small{font-size:8px;color:#9db3b1;overflow-wrap:anywhere}.ready small{letter-spacing:.1em;color:#d1ad55}.notice{display:grid;gap:3px;background:#263f48;border-radius:7px;padding:9px;color:#cbd6d7;font-size:9px}.notice.bad{background:#532f31;color:#f2d6d2}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.metrics>div{display:flex;justify-content:space-between;gap:10px;background:#0d2530;border-radius:6px;padding:8px;font-size:9px}.metrics span{color:#94a9af}.metrics b{color:#e1d27e}.hint{font-size:8px;color:#9fb0b5;line-height:1.45;margin:9px 0 0}@media(max-width:850px){header{flex-direction:column}.grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}}
    `}</style>
  </section>
}
