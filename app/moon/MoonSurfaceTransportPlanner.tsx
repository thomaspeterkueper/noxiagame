'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type Inventory = {
  id: string
  inventory_kind: string
  subject_type: string
  subject_id: string | null
  label: string
  metadata?: Record<string, unknown> | null
}

type InventoryItem = {
  resource: string
  label?: string
  unit?: string
  amount: number
  available?: number
}

type InventorySnapshot = Inventory & { items?: InventoryItem[] }

type LogisticsPayload = {
  inventories?: Inventory[]
  inventory?: InventorySnapshot
  jobs?: Array<{ id: string; status: string; vehicle_inventory_id?: string | null }>
  error?: string
}

type Vehicle = {
  id: string
  frameId: string
  status: string
  condition: number
  wear: number
  label?: string
  cargoCapacityT?: number
  currentNodeInventoryId?: string | null
  canonicalKey?: string | null
}

type VehiclesPayload = { vehicles?: Vehicle[]; error?: string }
type SpatialPayload = { location?: { id: string; slug: string; name: string }; error?: string }
type ReadinessPayload = {
  ok?: boolean
  ready?: boolean
  code?: string
  error?: string
  frameId?: string
  role?: string
  vehicleInventoryId?: string | null
  engineeringRequest?: string
}

const TERMINAL = new Set(['completed', 'cancelled', 'failed'])

export default function MoonSurfaceTransportPlanner() {
  const [locationId, setLocationId] = useState('')
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [jobs, setJobs] = useState<LogisticsPayload['jobs']>([])
  const [sourceId, setSourceId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [resource, setResource] = useState('')
  const [amount, setAmount] = useState(1)
  const [sourceSnapshot, setSourceSnapshot] = useState<InventorySnapshot | null>(null)
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null)
  const [checkingReadiness, setCheckingReadiness] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadCore() {
    setLoading(true)
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const headers = { Authorization: `Bearer ${token}` }
      const spatialResponse = await fetch('/api/game/build/spatial?location=moon', { headers, cache: 'no-store' })
      const spatial = await spatialResponse.json() as SpatialPayload
      if (!spatialResponse.ok || !spatial.location?.id) throw new Error(spatial.error ?? 'Moon-Standort nicht verfügbar')
      setLocationId(spatial.location.id)

      const [logisticsResponse, vehiclesResponse] = await Promise.all([
        fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatial.location.id)}`, { headers, cache: 'no-store' }),
        fetch(`/api/game/vehicles?locationId=${encodeURIComponent(spatial.location.id)}`, { headers, cache: 'no-store' }),
      ])
      const logistics = await logisticsResponse.json() as LogisticsPayload
      const vehiclePayload = await vehiclesResponse.json() as VehiclesPayload
      if (!logisticsResponse.ok) throw new Error(logistics.error ?? 'Moon-Logistik nicht verfügbar')
      if (!vehiclesResponse.ok) throw new Error(vehiclePayload.error ?? 'Moon-Fahrzeuge nicht verfügbar')
      setInventories(logistics.inventories ?? [])
      setJobs(logistics.jobs ?? [])
      setVehicles(vehiclePayload.vehicles ?? [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadCore() }, [])

  const nodeInventories = useMemo(() => inventories.filter(item => item.inventory_kind !== 'vehicle'), [inventories])
  const vehicleInventoryByVehicleId = useMemo(() => new Map(inventories
    .filter(item => item.inventory_kind === 'vehicle' && item.subject_id)
    .map(item => [item.subject_id as string, item.id])), [inventories])
  const source = nodeInventories.find(item => item.id === sourceId) ?? null
  const destination = nodeInventories.find(item => item.id === destinationId) ?? null
  const selectedVehicle = vehicles.find(item => item.id === vehicleId) ?? null
  const selectedVehicleInventoryId = selectedVehicle ? vehicleInventoryByVehicleId.get(selectedVehicle.id) ?? null : null
  const activeVehicleInventoryIds = useMemo(() => new Set((jobs ?? [])
    .filter(job => !TERMINAL.has(job.status) && job.vehicle_inventory_id)
    .map(job => job.vehicle_inventory_id as string)), [jobs])

  useEffect(() => {
    if (!sourceId && nodeInventories[0]) setSourceId(nodeInventories[0].id)
    if (!destinationId && nodeInventories[1]) setDestinationId(nodeInventories[1].id)
  }, [nodeInventories, sourceId, destinationId])

  useEffect(() => {
    if (!sourceId) return
    let cancelled = false
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch(`/api/game/logistics?inventoryId=${encodeURIComponent(sourceId)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        })
        const payload = await response.json() as LogisticsPayload
        if (cancelled) return
        setSourceSnapshot(response.ok ? payload.inventory ?? null : null)
      } catch {
        if (!cancelled) setSourceSnapshot(null)
      }
    })()
    return () => { cancelled = true }
  }, [sourceId])

  useEffect(() => {
    setReadiness(null)
    if (!vehicleId) return
    let cancelled = false
    setCheckingReadiness(true)
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch('/api/game/moon/surface-transport/readiness', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicleId }),
          cache: 'no-store',
        })
        const payload = await response.json() as ReadinessPayload
        if (!cancelled) setReadiness(payload)
      } catch (error) {
        if (!cancelled) setReadiness({ ready: false, code: 'READINESS_UNAVAILABLE', error: error instanceof Error ? error.message : String(error) })
      } finally {
        if (!cancelled) setCheckingReadiness(false)
      }
    })()
    return () => { cancelled = true }
  }, [vehicleId])

  const stock = useMemo(() => (sourceSnapshot?.items ?? []).filter(item => Number(item.available ?? item.amount) > 0), [sourceSnapshot])
  useEffect(() => {
    if (!resource && stock[0]) setResource(stock[0].resource)
    if (resource && !stock.some(item => item.resource === resource)) setResource(stock[0]?.resource ?? '')
  }, [stock, resource])

  const selectedStock = stock.find(item => item.resource === resource)
  const available = Number(selectedStock?.available ?? selectedStock?.amount ?? 0)
  const vehicleAtSource = selectedVehicle?.currentNodeInventoryId === sourceId
  const vehicleBusy = selectedVehicleInventoryId ? activeVehicleInventoryIds.has(selectedVehicleInventoryId) : false
  const vehicleReady = selectedVehicle?.status === 'ready' && !vehicleBusy
  const basicSelectionReady = Boolean(locationId && source && destination && source.id !== destination.id && resource && amount > 0 && amount <= available)

  let blocker: string | null = null
  if (!basicSelectionReady) blocker = 'Quelle, Ziel, Ware und verfügbare Menge müssen vollständig gewählt sein.'
  else if (!selectedVehicle) blocker = 'Kein reales Moon-Surface-Fahrzeug ausgewählt. Engineering-Frame und Instanz fehlen noch.'
  else if (!selectedVehicleInventoryId) blocker = 'Das Cargo-Inventar des ausgewählten Fahrzeugs ist im Core noch nicht aufgelöst.'
  else if (!vehicleReady) blocker = 'Das ausgewählte Fahrzeug ist nicht bereit oder bereits einem aktiven Transport zugewiesen.'
  else if (!vehicleAtSource) blocker = 'Das Fahrzeug befindet sich laut Core nicht am gewählten Quellknoten.'
  else if (checkingReadiness) blocker = 'Engineering-Frame wird geprüft …'
  else if (!readiness?.ready) blocker = readiness?.error ?? 'Für diesen Fahrzeug-Frame fehlen kanonische Moon-Surface-Engineeringwerte.'
  else blocker = 'Engineering-Frame ist freigegeben; als letzter Schritt fehlt die LOLA-Routenauflösung zum Core-routeSnapshot.'

  return <section className="planner">
    <header>
      <div><small>MOON LOGISTICS · CORE LIVE</small><h2>Transportauftrag vorbereiten</h2><p>Reale Core-Inventare und Fahrzeuginstanzen. Kein Dummy-Rover, keine erfundene ETA.</p></div>
      <button onClick={() => void loadCore()} disabled={loading}>{loading ? 'Lädt …' : 'Aktualisieren'}</button>
    </header>

    {message && <div className="notice error">{message}</div>}

    <div className="summary">
      <div><b>{nodeInventories.length}</b><span>Moon-Knoten</span></div>
      <div><b>{vehicles.length}</b><span>reale Fahrzeuge</span></div>
      <div><b>{(jobs ?? []).filter(job => !TERMINAL.has(job.status)).length}</b><span>aktive Jobs</span></div>
      <div><b>{stock.length}</b><span>Waren an Quelle</span></div>
    </div>

    <div className="grid">
      <div className="panel">
        <label>Quelle<select value={sourceId} onChange={e => setSourceId(e.currentTarget.value)}>{nodeInventories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Ziel<select value={destinationId} onChange={e => setDestinationId(e.currentTarget.value)}>{nodeInventories.filter(item => item.id !== sourceId).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Ware<select value={resource} onChange={e => setResource(e.currentTarget.value)}><option value="">–</option>{stock.map(item => <option key={item.resource} value={item.resource}>{item.label ?? item.resource} · {item.available ?? item.amount} {item.unit ?? ''}</option>)}</select></label>
        <label>Menge<input type="number" min={1} max={Math.max(1, available)} value={amount} onChange={e => setAmount(Math.max(1, Math.floor(Number(e.currentTarget.value) || 1)))} /></label>
      </div>

      <div className="panel">
        <label>Fahrzeug<select value={vehicleId} onChange={e => setVehicleId(e.currentTarget.value)}><option value="">Kein Fahrzeug ausgewählt</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.label ?? vehicle.frameId} · {vehicle.status}</option>)}</select></label>
        {selectedVehicle ? <div className="vehicle-card">
          <strong>{selectedVehicle.label ?? selectedVehicle.frameId}</strong>
          <span>Frame: {selectedVehicle.frameId}</span>
          <span>Status: {selectedVehicle.status}</span>
          <span>Cargo-Inventar: {selectedVehicleInventoryId ? selectedVehicleInventoryId.slice(0, 8) : 'unresolved'}</span>
          <span>Kapazität: {selectedVehicle.cargoCapacityT ?? '–'} t</span>
          <span>Condition: {Math.round(selectedVehicle.condition * 100)}%</span>
          <span>Wear: {Math.round(selectedVehicle.wear * 100)}%</span>
          <span>Am Quellknoten: {vehicleAtSource ? 'ja' : 'nein'}</span>
          <span>Engineering: {checkingReadiness ? 'prüft …' : readiness?.ready ? 'freigegeben' : readiness?.code ?? 'unresolved'}</span>
        </div> : <div className="notice"><b>Engineering noch offen</b><span>Der Auftrag für Cargo Rover und Heavy Hauler ist vorhanden, aber noch nicht abgeschlossen. Deshalb wird keine Fahrzeuginstanz erfunden.</span></div>}
      </div>
    </div>

    <div className="gate">
      <div><small>STARTFREIGABE</small><strong>{blocker ? 'BLOCKIERT' : 'BEREIT'}</strong></div>
      <p>{blocker ?? 'Alle Voraussetzungen erfüllt.'}</p>
      <button className="primary" disabled>Transportjob anlegen</button>
    </div>

    <style jsx>{`
      .planner{max-width:1400px;margin:0 auto 18px;background:#0e171d;border:1px solid #293943;border-radius:16px;padding:16px;color:#e8edf0;font-family:system-ui,sans-serif}header{display:flex;justify-content:space-between;gap:18px;align-items:start;margin-bottom:14px}header small,.gate small{font-size:10px;letter-spacing:.16em;color:#c8a75a;font-weight:800}h2{font-family:Georgia,serif;font-weight:400;font-size:24px;margin:2px 0}header p{margin:0;color:#8d9aa2;font-size:12px}button{border:1px solid #465b66;background:#13222a;color:#dbe5e9;padding:8px 12px;border-radius:8px;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.summary div{background:#111f27;border:1px solid #293943;border-radius:10px;padding:10px}.summary b{display:block;font-size:20px}.summary span{font-size:9px;color:#82929c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.panel{display:grid;gap:10px;background:#101a20;border:1px solid #263740;border-radius:12px;padding:12px}label{display:grid;gap:5px;color:#8fa0a9;font-size:10px}select,input{width:100%;box-sizing:border-box;background:#091117;color:#e8edf0;border:1px solid #344852;border-radius:7px;padding:8px}.vehicle-card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;background:#0b1419;border-radius:8px;padding:10px}.vehicle-card strong{grid-column:1/-1}.vehicle-card span{font-size:10px;color:#93a3aa}.notice{display:grid;gap:4px;background:#16242c;border:1px dashed #3a4d57;border-radius:8px;padding:10px;color:#9fadb3;font-size:10px}.notice b{color:#dde6ea}.error{border-color:#684247;background:#2a181b}.gate{margin-top:12px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;background:#101a20;border:1px solid #354852;border-radius:12px;padding:12px}.gate strong{display:block;color:#e0b963;margin-top:2px}.gate p{margin:0;color:#9aa9b0;font-size:11px}.primary{background:#5d4d2b;border-color:#8b7340;color:#f4dfaa}@media(max-width:800px){.summary{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.gate{grid-template-columns:1fr}.vehicle-card{grid-template-columns:1fr}}
    `}</style>
  </section>
}
