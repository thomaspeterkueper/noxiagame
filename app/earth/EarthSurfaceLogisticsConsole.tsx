'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { earthRoutingWindowFor, planEarthSurfaceRoute, type EarthSurfaceRoutePlanResult } from '@/lib/game/earthSurfaceRouting'
import type { EarthSurfaceVehicleRole } from '@/lib/game/earthSurfaceLogistics'
import {
  earthOverlayNodeFromInventory,
  earthOverlayRouteFromPlan,
  earthRouteFailureWarning,
  type EarthTransportOverlayNode,
} from '@/lib/game/earthTransportOverlay'
import { useEarthTransportOverlayStore } from '@/lib/store/earthTransportOverlayStore'
import { localMetersToGeo, type GeoPoint } from '@/lib/world/spatial/earthSpatial'
import type { ImportedEarthFeature } from '@/lib/world/spatial/earthFeatureSource'

type SpatialEntity = {
  id: string
  entity_id: string
  name?: string
  x_m: number | null
  y_m: number | null
  latitude_deg?: number | null
  longitude_deg?: number | null
  status: string
}

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  spatialRegion?: { id: string; name: string; origin: GeoPoint } | null
  entities?: SpatialEntity[]
  error?: string
}

type Inventory = {
  id: string
  owner_profile_id: string | null
  location_id: string | null
  inventory_kind: 'location' | 'facility' | 'depot' | 'surface_port' | 'vehicle' | 'station'
  storage_kind: 'native' | 'location_resources' | 'ship_cargo'
  subject_type: string
  subject_id: string | null
  label: string
  capacity: number | null
  public_deposit: boolean
  public_withdraw: boolean
  active: boolean
  metadata: Record<string, unknown>
}

type InventoryItem = {
  resource: string
  label?: string
  unit?: string
  amount: number
  reservedOutbound?: number
  available?: number
}

type InventorySnapshot = Inventory & {
  totalAmount?: number
  items?: InventoryItem[]
}

type TransportJob = {
  id: string
  source_inventory_id: string
  destination_inventory_id: string
  vehicle_inventory_id: string | null
  vehicle_role: string | null
  resource: string
  amount: number
  status: string
  route_snapshot?: Record<string, unknown>
  arrives_at?: string | null
  failure_code?: string | null
}

type LogisticsPayload = {
  ok?: boolean
  inventories?: Inventory[]
  jobs?: TransportJob[]
  inventory?: InventorySnapshot
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

type VehiclesPayload = { ok?: boolean; vehicles?: Vehicle[]; error?: string }
type RegionPayload = { ok?: boolean; features?: ImportedEarthFeature[]; error?: string }
type SpatialInventory = Inventory & { entity: SpatialEntity; point: GeoPoint }

type CargoReadinessPayload = {
  ok?: boolean
  ready?: boolean
  code?: string
  error?: string
  commodityId?: string
  amount?: number
  unit?: string | null
  massKg?: number
  reason?: string
}

type VehicleReadinessPayload = {
  ok?: boolean
  ready?: boolean
  code?: string
  error?: string
  frameId?: string
  role?: string
  cargoMassCapacityKg?: number
  vehicleInventoryId?: string | null
  reason?: string
  details?: string[]
  sourceId?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  reserved: 'Reserviert', loading: 'Lädt', in_transit: 'Unterwegs', arrived: 'Angekommen',
  unloading: 'Entlädt', completed: 'Abgeschlossen', cancelled: 'Abgebrochen', failed: 'Fehlgeschlagen',
  ready: 'Bereit', maintenance: 'Wartung', damaged: 'Beschädigt', disabled: 'Außer Betrieb',
}
const TERMINAL = new Set(['completed', 'cancelled', 'failed'])

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
}

function pointForEntity(entity: SpatialEntity, origin?: GeoPoint | null): GeoPoint | null {
  const lat = Number(entity.latitude_deg)
  const lon = Number(entity.longitude_deg)
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
  if (!origin || entity.x_m == null || entity.y_m == null) return null
  try {
    return localMetersToGeo({ eastM: Number(entity.x_m), northM: Number(entity.y_m) }, origin)
  } catch {
    return null
  }
}

export default function EarthSurfaceLogisticsConsole() {
  const [spatial, setSpatial] = useState<SpatialPayload | null>(null)
  const [logistics, setLogistics] = useState<LogisticsPayload | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [sourceId, setSourceId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [resource, setResource] = useState('')
  const [amount, setAmount] = useState(1)
  const [sourceSnapshot, setSourceSnapshot] = useState<InventorySnapshot | null>(null)
  const [role, setRole] = useState<EarthSurfaceVehicleRole>('cargo-rover')
  const [route, setRoute] = useState<EarthSurfaceRoutePlanResult | null>(null)
  const [routeBusy, setRouteBusy] = useState(false)
  const [cargoReadiness, setCargoReadiness] = useState<CargoReadinessPayload | null>(null)
  const [vehicleReadiness, setVehicleReadiness] = useState<VehicleReadinessPayload | null>(null)
  const [checkingCargo, setCheckingCargo] = useState(false)
  const [checkingVehicle, setCheckingVehicle] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadCoreState() {
    setLoading(true)
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const spatialResponse = await fetch('/api/game/build/spatial?location=earth', { headers: { Authorization: `Bearer ${token}` } })
      const spatialJson = await spatialResponse.json() as SpatialPayload
      if (!spatialResponse.ok || !spatialJson.location?.id) throw new Error(spatialJson.error ?? 'Earth-Weltzustand konnte nicht geladen werden')
      setSpatial(spatialJson)

      const [logisticsResponse, vehicleResponse] = await Promise.all([
        fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatialJson.location.id)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/game/vehicles?locationId=${encodeURIComponent(spatialJson.location.id)}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const logisticsJson = await logisticsResponse.json() as LogisticsPayload
      const vehicleJson = await vehicleResponse.json() as VehiclesPayload
      if (!logisticsResponse.ok) throw new Error(logisticsJson.error ?? 'Logistikzustand konnte nicht geladen werden')
      if (!vehicleResponse.ok) throw new Error(vehicleJson.error ?? 'Fahrzeugzustand konnte nicht geladen werden')
      setLogistics(logisticsJson)
      setVehicles(vehicleJson.vehicles ?? [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadCoreState() }, [])

  const entityById = useMemo(() => new Map((spatial?.entities ?? []).map(entity => [entity.id, entity])), [spatial])
  const spatialInventories = useMemo<SpatialInventory[]>(() => {
    const origin = spatial?.spatialRegion?.origin
    return (logistics?.inventories ?? []).flatMap(inventory => {
      if (inventory.subject_type !== 'tile_entity' || !inventory.subject_id) return []
      const entity = entityById.get(inventory.subject_id)
      if (!entity) return []
      const point = pointForEntity(entity, origin)
      return point ? [{ ...inventory, entity, point }] : []
    })
  }, [logistics, entityById, spatial])

  useEffect(() => {
    if (!sourceId && spatialInventories[0]) setSourceId(spatialInventories[0].id)
    if (!destinationId && spatialInventories[1]) setDestinationId(spatialInventories[1].id)
  }, [spatialInventories, sourceId, destinationId])

  useEffect(() => {
    if (!vehicleId && vehicles[0]) setVehicleId(vehicles[0].id)
  }, [vehicles, vehicleId])

  useEffect(() => {
    setRoute(null)
  }, [sourceId, destinationId, role])

  useEffect(() => {
    setSourceSnapshot(null)
    setResource('')
    setAmount(1)
    if (!sourceId) return
    let cancelled = false
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch(`/api/game/logistics?inventoryId=${encodeURIComponent(sourceId)}`, { headers: { Authorization: `Bearer ${token}` } })
        const json = await response.json() as LogisticsPayload
        if (!cancelled && response.ok) setSourceSnapshot(json.inventory ?? null)
      } catch {
        if (!cancelled) setSourceSnapshot(null)
      }
    })()
    return () => { cancelled = true }
  }, [sourceId])

  const source = spatialInventories.find(item => item.id === sourceId) ?? null
  const destination = spatialInventories.find(item => item.id === destinationId) ?? null
  const selectedVehicle = vehicles.find(item => item.id === vehicleId) ?? null
  const jobs = logistics?.jobs ?? []
  const allInventories = logistics?.inventories ?? []
  const nonSpatialInventories = allInventories.filter(item => !spatialInventories.some(spatialItem => spatialItem.id === item.id))
  const stock = (sourceSnapshot?.items ?? []).filter(item => Number(item.available ?? item.amount) > 0)
  const selectedStock = stock.find(item => item.resource === resource) ?? null
  const available = Number(selectedStock?.available ?? selectedStock?.amount ?? 0)

  useEffect(() => {
    if (!resource && stock[0]) setResource(stock[0].resource)
  }, [stock, resource])

  useEffect(() => {
    setCargoReadiness(null)
    if (!sourceId || !resource || amount <= 0 || amount > available) return
    let cancelled = false
    setCheckingCargo(true)
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch('/api/game/surface-transport/cargo-readiness', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceInventoryId: sourceId, resource, amount }),
          cache: 'no-store',
        })
        const payload = await response.json() as CargoReadinessPayload
        if (!cancelled) setCargoReadiness(payload)
      } catch (error) {
        if (!cancelled) setCargoReadiness({ ready: false, code: 'CARGO_READINESS_UNAVAILABLE', error: error instanceof Error ? error.message : String(error) })
      } finally {
        if (!cancelled) setCheckingCargo(false)
      }
    })()
    return () => { cancelled = true }
  }, [sourceId, resource, amount, available])

  useEffect(() => {
    setVehicleReadiness(null)
    if (!vehicleId) return
    let cancelled = false
    setCheckingVehicle(true)
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch('/api/game/earth/surface-transport/readiness', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicleId }),
          cache: 'no-store',
        })
        const payload = await response.json() as VehicleReadinessPayload
        if (!cancelled) setVehicleReadiness(payload)
      } catch (error) {
        if (!cancelled) setVehicleReadiness({ ready: false, code: 'VEHICLE_READINESS_UNAVAILABLE', error: error instanceof Error ? error.message : String(error) })
      } finally {
        if (!cancelled) setCheckingVehicle(false)
      }
    })()
    return () => { cancelled = true }
  }, [vehicleId])

  const activeVehicleInventoryIds = useMemo(() => new Set(jobs
    .filter(job => !TERMINAL.has(job.status) && job.vehicle_inventory_id)
    .map(job => job.vehicle_inventory_id as string)), [jobs])
  const vehicleBusy = Boolean(vehicleReadiness?.vehicleInventoryId && activeVehicleInventoryIds.has(vehicleReadiness.vehicleInventoryId))
  const vehicleAtSource = Boolean(selectedVehicle && selectedVehicle.currentNodeInventoryId === sourceId)
  const vehicleCoreReady = Boolean(selectedVehicle?.status === 'ready' && !vehicleBusy)

  async function calculateRoute() {
    if (!source || !destination || source.id === destination.id) return
    setRouteBusy(true)
    setRoute(null)
    setMessage(null)
    try {
      const window = earthRoutingWindowFor(source.point, destination.point)
      if (!window.ok) throw new Error('Die beiden Knoten liegen außerhalb des derzeit maximal 6-km-lokalen OSM-Routingfensters.')
      const query = new URLSearchParams({ lat: String(window.center.lat), lon: String(window.center.lon), radiusKm: String(window.radiusKm) })
      const response = await fetch(`/api/earth/region?${query}`, { cache: 'no-store' })
      const json = await response.json() as RegionPayload
      if (!response.ok || !json.ok) throw new Error(json.error ?? 'OSM-Routingdaten konnten nicht geladen werden')
      setRoute(planEarthSurfaceRoute({
        features: json.features ?? [], source: source.point, destination: destination.point, vehicleRole: role,
      }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setRouteBusy(false)
    }
  }

  const routeFailure = route ? earthRouteFailureWarning(route) : null
  const routeReady = Boolean(route && !('reason' in route))
  const plannedOverlay = useMemo(() => route && !('reason' in route) && source && destination
    ? earthOverlayRouteFromPlan({
      id: `planned:${source.id}:${destination.id}`,
      label: `${source.label} → ${destination.label}`,
      statusLabel: 'Earth-validierte Route',
      plan: route,
    })
    : null, [route, source, destination])

  // The Earth map draws whatever transport context is being prepared here. Only the
  // derived overlay is shared; inventories, vehicles and jobs stay Core-owned.
  const publishOverlay = useEarthTransportOverlayStore(state => state.publish)
  const clearOverlay = useEarthTransportOverlayStore(state => state.clear)
  const overlayNodes = useMemo<EarthTransportOverlayNode[]>(() => {
    const nodes: EarthTransportOverlayNode[] = []
    for (const node of [source, destination]) {
      if (!node) continue
      const overlayNode = earthOverlayNodeFromInventory({
        id: node.id,
        label: node.label,
        inventory_kind: node.inventory_kind,
        subject_type: node.subject_type,
        subject_id: node.subject_id,
        metadata: node.metadata,
      }, node.point)
      if (overlayNode) nodes.push(overlayNode)
    }
    return nodes
  }, [source, destination])

  useEffect(() => {
    publishOverlay('logistics-console', {
      nodes: overlayNodes,
      planned: plannedOverlay,
      warnings: routeFailure ? [routeFailure] : [],
    })
  }, [publishOverlay, overlayNodes, plannedOverlay, routeFailure])

  useEffect(() => () => clearOverlay('logistics-console'), [clearOverlay])

  let blocker: string | null = null
  if (!source || !destination || source.id === destination.id) blocker = 'Quelle und Ziel müssen zwei verschiedene räumliche Earth-Knoten sein.'
  else if (!resource || amount <= 0 || amount > available) blocker = 'Ware und verfügbare Menge müssen vollständig gewählt sein.'
  else if (checkingCargo) blocker = 'Physikalische Frachtmasse wird geprüft …'
  else if (!cargoReadiness?.ready) blocker = cargoReadiness?.reason
    ? `${cargoReadiness.error ?? 'Frachtmasse nicht aufgelöst'} (${cargoReadiness.reason})`
    : cargoReadiness?.error ?? 'Für die gewählte Fracht fehlt eine autoritative physikalische Massenbasis.'
  else if (!selectedVehicle) blocker = 'Kein reales Earth-Surface-Fahrzeug ausgewählt.'
  else if (checkingVehicle) blocker = 'Engineering-Frame wird geprüft …'
  else if (!vehicleReadiness?.vehicleInventoryId) blocker = vehicleReadiness?.error ?? 'Das Cargo-Inventar des Fahrzeugs ist nicht aufgelöst.'
  else if (!vehicleCoreReady) blocker = 'Das ausgewählte Fahrzeug ist nicht bereit oder bereits einem aktiven Transport zugewiesen.'
  else if (!vehicleAtSource) blocker = 'Das ausgewählte Fahrzeug befindet sich laut Core nicht am gewählten Quellknoten.'
  else if (!vehicleReadiness?.ready) blocker = vehicleReadiness?.reason
    ? `${vehicleReadiness.error ?? 'Surface-Profil nicht aufgelöst'} (${vehicleReadiness.reason})`
    : vehicleReadiness?.error ?? 'Für diesen Fahrzeug-Frame fehlen kanonische Earth-Surface-Engineeringwerte.'
  else if (!routeReady) blocker = routeFailure ?? 'Eine Earth-validierte OSM-Route muss vorliegen.'
  else blocker = 'Cargo, Fahrzeug und Route sind freigegeben. Als nächster Core-Schritt folgt der serverseitige prospective Mission Draft; die UI startet noch keinen Job.'

  return <section className="earth-logistics-console">
    <header>
      <div>
        <small>EARTH LOGISTICS · CORE LIVE</small>
        <h2>Surface-Transport</h2>
        <p>Reale Core-Bestände und Fahrzeuge · autoritative Frachtmasse · Earth-Routen auf OSM · keine parallele Transport-State-Machine.</p>
      </div>
      <button onClick={() => void loadCoreState()} disabled={loading}>{loading ? 'Lädt …' : 'Aktualisieren'}</button>
    </header>

    {message && <div className="notice error">{message}</div>}

    <div className="summary-grid">
      <div><b>{allInventories.length}</b><span>Core-Inventare</span></div>
      <div><b>{spatialInventories.length}</b><span>räumliche Earth-Knoten</span></div>
      <div><b>{vehicles.length}</b><span>Fahrzeuge</span></div>
      <div><b>{jobs.filter(job => !TERMINAL.has(job.status)).length}</b><span>aktive Jobs</span></div>
    </div>

    <div className="console-grid">
      <div className="panel planner">
        <div className="panel-head"><strong>Transport vorbereiten</strong><span>Core + OSM + Shared Vehicle</span></div>
        {spatialInventories.length < 2 ? <div className="notice"><b>Noch keine zwei räumlich gebundenen Earth-Inventare.</b><span>Facility→Facility-Routing benötigt zwei reale `tile_entity`-Inventarknoten.</span></div> : <>
          <label>Quelle<select value={sourceId} onChange={e => setSourceId(e.currentTarget.value)}>{spatialInventories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Ziel<select value={destinationId} onChange={e => setDestinationId(e.currentTarget.value)}>{spatialInventories.filter(item => item.id !== sourceId).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Ware<select value={resource} onChange={e => { setResource(e.currentTarget.value); setAmount(1) }}><option value="">–</option>{stock.map(item => <option key={item.resource} value={item.resource}>{item.label ?? item.resource} · {item.available ?? item.amount} {item.unit ?? ''}</option>)}</select></label>
          <label>Menge<input type="number" min={1} max={Math.max(1, available)} value={amount} onChange={e => setAmount(Math.max(1, Math.floor(Number(e.currentTarget.value) || 1)))} /></label>
          <label>Fahrzeug<select value={vehicleId} onChange={e => setVehicleId(e.currentTarget.value)}><option value="">–</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.label ?? vehicle.frameId} · {STATUS_LABELS[vehicle.status] ?? vehicle.status}</option>)}</select></label>
          <label>Earth-Routingklasse<select value={role} onChange={e => setRole(e.currentTarget.value as EarthSurfaceVehicleRole)}><option value="cargo-rover">Cargo Rover</option><option value="heavy-hauler">Heavy Hauler</option></select></label>
          <button className="primary" disabled={routeBusy || !source || !destination || source.id === destination.id} onClick={() => void calculateRoute()}>{routeBusy ? 'Route wird berechnet …' : 'OSM-Route prüfen'}</button>
        </>}

        <div className="readiness-grid">
          <div className={cargoReadiness?.ready ? 'gate good' : 'gate'}><small>FRACHTMASSE</small><b>{checkingCargo ? 'prüft …' : cargoReadiness?.ready ? 'autorisiert' : cargoReadiness?.reason ?? cargoReadiness?.code ?? 'unresolved'}</b><span>{cargoReadiness?.massKg != null ? `${cargoReadiness.massKg} kg` : selectedStock?.unit ? `Quelle: ${selectedStock.unit}` : 'keine physikalische Masse'}</span></div>
          <div className={vehicleReadiness?.ready ? 'gate good' : 'gate'}><small>ENGINEERING</small><b>{checkingVehicle ? 'prüft …' : vehicleReadiness?.ready ? 'freigegeben' : vehicleReadiness?.reason ?? vehicleReadiness?.code ?? 'unresolved'}</b><span>{vehicleReadiness?.frameId ?? selectedVehicle?.frameId ?? 'kein Frame'}{vehicleReadiness?.cargoMassCapacityKg != null ? ` · ${vehicleReadiness.cargoMassCapacityKg} kg` : ''}</span></div>
          <div className={vehicleCoreReady && vehicleAtSource ? 'gate good' : 'gate'}><small>CORE-FAHRZEUG</small><b>{vehicleCoreReady ? vehicleAtSource ? 'am Quellknoten' : 'falscher Standort' : vehicleBusy ? 'belegt' : selectedVehicle?.status ?? 'unresolved'}</b><span>{selectedVehicle?.currentNodeInventoryId ? `Node ${selectedVehicle.currentNodeInventoryId.slice(0, 8)}` : 'kein Standort aufgelöst'}</span></div>
          <div className={routeReady ? 'gate good' : 'gate'}><small>EARTH-ROUTE</small><b>{routeBusy ? 'prüft …' : routeReady ? 'validiert' : routeFailure ? 'blockiert' : 'unresolved'}</b><span>{routeReady && route && !('reason' in route) ? formatDistance(route.distanceM) : 'OSM + Earth Policy'}</span></div>
        </div>

        <div className="notice"><b>Freigabestatus</b><span>{blocker}</span></div>

        {sourceSnapshot?.items && <div className="stock"><small>QUELLBESTAND</small>{stock.length ? stock.map(item => <div key={item.resource}><span>{item.label ?? item.resource}</span><b>{item.available ?? item.amount} {item.unit ?? ''}</b></div>) : <em>Kein physischer Bestand vorhanden.</em>}</div>}

        {route && !('reason' in route) && <div className="route-result ok">
          <div><span>Distanz</span><b>{formatDistance(route.distanceM)}</b></div>
          <div><span>Straße</span><b>{formatDistance(route.roadDistanceM)}</b></div>
          <div><span>Offroad</span><b>{formatDistance(route.offroadDistanceM)}</b></div>
          <div><span>Energie-Faktor</span><b>× {route.energyMultiplier.toFixed(2)}</b></div>
          <div><span>Wear-Faktor</span><b>× {route.wearMultiplier.toFixed(2)}</b></div>
          <div className="segments">{route.segments.map((segment, index) => <span key={`${segment.featureId ?? 'access'}-${index}`}>{segment.routeClass}</span>)}</div>
          <p>Die Route ist Earth-validiert und kann in den gemeinsamen SurfaceMissionPlan überführt werden. Absolute ETA, Energie und Wear entstehen erst aus einem exakt freigegebenen Engineering-Profil.</p>
        </div>}
        {routeFailure && <div className="notice error"><b>Route blockiert</b><span>{routeFailure}</span></div>}
      </div>

      <div className="panel">
        <div className="panel-head"><strong>Inventare</strong><span>Core Source of Truth</span></div>
        <div className="rows">{allInventories.length ? allInventories.map(inventory => {
          const spatialNode = spatialInventories.find(item => item.id === inventory.id)
          return <div className="row" key={inventory.id}><div><b>{inventory.label}</b><small>{inventory.inventory_kind} · {inventory.storage_kind}</small></div><span className={spatialNode ? 'badge good' : 'badge'}>{spatialNode ? 'räumlich' : inventory.subject_type}</span></div>
        }) : <em>Keine zugänglichen Inventare an dieser Location.</em>}</div>
        {nonSpatialInventories.some(item => item.inventory_kind === 'location') && <small className="hint">Aggregierter Standortbestand bleibt sichtbar, wird aber nicht als physische Route-Quelle missbraucht.</small>}
      </div>

      <div className="panel">
        <div className="panel-head"><strong>Fahrzeuge</strong><span>Vehicle Core</span></div>
        <div className="rows">{vehicles.length ? vehicles.map(vehicle => <div className="row" key={vehicle.id}><div><b>{vehicle.label ?? vehicle.frameId}</b><small>{vehicle.frameId} · Persistenz-Kapazität {vehicle.cargoCapacityT ?? '–'} t · Wear {Number(vehicle.wear ?? 0).toFixed(1)}</small></div><span className={`badge ${vehicle.status === 'ready' ? 'good' : ''}`}>{STATUS_LABELS[vehicle.status] ?? vehicle.status}</span></div>) : <em>Noch keine Surface-Fahrzeuge an Earth registriert.</em>}</div>
      </div>

      <div className="panel jobs">
        <div className="panel-head"><strong>Transportaufträge</strong><span>persistierter Core-Status</span></div>
        <div className="rows">{jobs.length ? jobs.slice(0, 8).map(job => <div className="row" key={job.id}><div><b>{job.amount} {job.resource}</b><small>{job.vehicle_role ?? 'ohne Fahrzeugrolle'}{job.arrives_at ? ` · ETA ${new Date(job.arrives_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}</small></div><span className={`badge ${job.status === 'completed' ? 'good' : job.status === 'failed' ? 'bad' : ''}`}>{STATUS_LABELS[job.status] ?? job.status}</span></div>) : <em>Noch keine Earth-Transportaufträge.</em>}</div>
      </div>
    </div>

    <style jsx>{`
      .earth-logistics-console{max-width:1500px;margin:18px auto;padding:16px;box-sizing:border-box;background:#102632;color:#e7ece8;border:1px solid #425d67;border-radius:13px;box-shadow:0 16px 45px #162c3330;font-family:system-ui,sans-serif}
      header{display:flex;justify-content:space-between;gap:24px;align-items:start;margin-bottom:13px}header small{font-size:9px;letter-spacing:.16em;color:#d1ad55;font-weight:900}h2{font-family:Georgia,serif;font-weight:400;font-size:24px;margin:3px 0}header p{margin:0;color:#9fb0b5;font-size:11px;max-width:780px}header button,.primary{border:1px solid #8e7433;background:#d2a843;color:#102632;border-radius:7px;padding:8px 11px;font-weight:900;cursor:pointer}header button:disabled,.primary:disabled{opacity:.5;cursor:not-allowed}
      .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.summary-grid>div{background:#173541;border:1px solid #31505b;border-radius:8px;padding:9px}.summary-grid b{display:block;color:#f0cc6c;font-size:18px}.summary-grid span{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#9fb0b5}
      .console-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:10px}.panel{background:#132f3a;border:1px solid #35525d;border-radius:9px;padding:11px;min-width:0}.planner{grid-row:span 2}.jobs{grid-column:2}.panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.panel-head strong{font-size:12px}.panel-head span{font-size:8px;color:#91a7ad;text-transform:uppercase;letter-spacing:.08em}
      label{display:grid;gap:4px;color:#9fb0b5;font-size:9px;margin:7px 0}select,input{width:100%;box-sizing:border-box;background:#0b202a;color:#e7ece8;border:1px solid #46616a;border-radius:6px;padding:8px}.primary{width:100%;margin:5px 0 8px}.rows{display:grid;gap:5px}.row{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px;background:#0d2530;border-radius:6px}.row b{display:block;font-size:10px}.row small{display:block;color:#8fa2a8;font-size:8px;margin-top:2px}.badge{font-size:8px;background:#304650;color:#c5d0d2;border-radius:999px;padding:4px 6px;white-space:nowrap}.badge.good{background:#315d4a;color:#d6f0df}.badge.bad{background:#703d3d;color:#ffe2df}.hint{display:block;margin-top:8px;color:#83989f;font-size:8px;line-height:1.4}
      .readiness-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:9px 0}.gate{background:#0d2530;border:1px solid #39515a;border-radius:7px;padding:7px;display:grid;gap:2px}.gate.good{border-color:#39705c;background:#10342f}.gate small{font-size:7px;letter-spacing:.1em;color:#8fa2a8}.gate b{font-size:9px;color:#d9e2e0}.gate span{font-size:8px;color:#91a7ad;overflow-wrap:anywhere}
      .notice{display:grid;gap:4px;padding:9px;margin:8px 0;border-radius:7px;background:#263f48;color:#cbd6d7;font-size:9px}.notice.error{background:#532f31;color:#f2d6d2}.notice b{font-size:10px}.stock{margin:10px 0;padding:8px;background:#0c222c;border-radius:7px}.stock>small{display:block;color:#d4b45e;font-size:8px;font-weight:900;margin-bottom:5px}.stock>div{display:flex;justify-content:space-between;font-size:9px;border-top:1px solid #25404a;padding:5px 0}.stock em,.rows>em{font-size:9px;color:#879da3;font-style:normal}
      .route-result{margin-top:9px;padding:9px;border-radius:7px;background:#123a35;border:1px solid #376e60;display:grid;grid-template-columns:repeat(2,1fr);gap:5px 10px}.route-result>div:not(.segments){display:flex;justify-content:space-between;font-size:9px}.route-result span{color:#a9c5bc}.route-result b{color:#e1d27e}.segments{grid-column:1/-1;display:flex;gap:4px;flex-wrap:wrap}.segments span{background:#31564b;color:#e0eee8;border-radius:999px;padding:3px 6px;font-size:8px}.route-result p{grid-column:1/-1;margin:4px 0 0;color:#a7bbb6;font-size:8px;line-height:1.4}
      @media(max-width:850px){.summary-grid,.readiness-grid{grid-template-columns:repeat(2,1fr)}.console-grid{grid-template-columns:1fr}.planner{grid-row:auto}.jobs{grid-column:auto}header{align-items:stretch;flex-direction:column}}
    `}</style>
  </section>
}
