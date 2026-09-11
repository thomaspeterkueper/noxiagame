'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import { planEarthSurfaceRoute, type EarthSurfaceRoutePlanResult } from '@/lib/game/earthSurfaceRouting'
import type { EarthSurfaceVehicleRole } from '@/lib/game/earthSurfaceLogistics'
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

const STATUS_LABELS: Record<string, string> = {
  reserved: 'Reserviert',
  loading: 'Lädt',
  in_transit: 'Unterwegs',
  arrived: 'Angekommen',
  unloading: 'Entlädt',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
  failed: 'Fehlgeschlagen',
  ready: 'Bereit',
  maintenance: 'Wartung',
  damaged: 'Beschädigt',
  disabled: 'Außer Betrieb',
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const lat = (a.lat + b.lat) * Math.PI / 360
  const dx = (b.lon - a.lon) * 111_320 * Math.cos(lat)
  const dy = (b.lat - a.lat) * 110_540
  return Math.hypot(dx, dy)
}

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

function routeFailureLabel(result: EarthSurfaceRoutePlanResult) {
  if (!('reason' in result)) return null
  switch (result.reason) {
    case 'no-routable-roads': return 'Im geladenen OSM-Ausschnitt gibt es kein geeignetes Fahrzeugnetz.'
    case 'source-access-unresolved': return 'Die Zufahrt vom Quellknoten zur beobachteten Straße ist noch nicht aufgelöst.'
    case 'destination-access-unresolved': return 'Die Zufahrt vom Straßennetz zum Zielknoten ist noch nicht aufgelöst.'
    case 'disconnected-road-network': return 'Quelle und Ziel liegen in getrennten oder richtungsbedingt nicht verbundenen Straßennetzen.'
  }
}

export default function EarthSurfaceLogisticsConsole() {
  const [spatial, setSpatial] = useState<SpatialPayload | null>(null)
  const [logistics, setLogistics] = useState<LogisticsPayload | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [sourceId, setSourceId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [sourceSnapshot, setSourceSnapshot] = useState<InventorySnapshot | null>(null)
  const [role, setRole] = useState<EarthSurfaceVehicleRole>('cargo-rover')
  const [route, setRoute] = useState<EarthSurfaceRoutePlanResult | null>(null)
  const [routeBusy, setRouteBusy] = useState(false)
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
    setRoute(null)
    setSourceSnapshot(null)
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
  const jobs = logistics?.jobs ?? []
  const allInventories = logistics?.inventories ?? []
  const nonSpatialInventories = allInventories.filter(item => !spatialInventories.some(spatialItem => spatialItem.id === item.id))

  async function calculateRoute() {
    if (!source || !destination || source.id === destination.id) return
    setRouteBusy(true)
    setRoute(null)
    setMessage(null)
    try {
      const directDistance = distanceMeters(source.point, destination.point)
      if (directDistance > 10_500) throw new Error('Die beiden Knoten liegen außerhalb des derzeit maximal 6-km-lokalen OSM-Routingfensters.')
      const center = { lat: (source.point.lat + destination.point.lat) / 2, lon: (source.point.lon + destination.point.lon) / 2 }
      const radiusKm = Math.min(6, Math.max(.6, directDistance / 2000 + .75))
      const query = new URLSearchParams({ lat: String(center.lat), lon: String(center.lon), radiusKm: String(radiusKm) })
      const response = await fetch(`/api/earth/region?${query}`, { cache: 'no-store' })
      const json = await response.json() as RegionPayload
      if (!response.ok || !json.ok) throw new Error(json.error ?? 'OSM-Routingdaten konnten nicht geladen werden')
      const result = planEarthSurfaceRoute({
        features: json.features ?? [],
        source: source.point,
        destination: destination.point,
        vehicleRole: role,
      })
      setRoute(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setRouteBusy(false)
    }
  }

  const routeFailure = route ? routeFailureLabel(route) : null

  return <section className="earth-logistics-console">
    <header>
      <div>
        <small>EARTH LOGISTICS · CORE LIVE</small>
        <h2>Surface-Transport</h2>
        <p>Core-Bestände und Fahrzeuge lesen · Earth-Routen auf realen OSM-Straßen prüfen · keine parallele Transport-State-Machine.</p>
      </div>
      <button onClick={() => void loadCoreState()} disabled={loading}>{loading ? 'Lädt …' : 'Aktualisieren'}</button>
    </header>

    {message && <div className="notice error">{message}</div>}

    <div className="summary-grid">
      <div><b>{allInventories.length}</b><span>Core-Inventare</span></div>
      <div><b>{spatialInventories.length}</b><span>räumliche Earth-Knoten</span></div>
      <div><b>{vehicles.length}</b><span>Fahrzeuge</span></div>
      <div><b>{jobs.filter(job => !['completed', 'cancelled', 'failed'].includes(job.status)).length}</b><span>aktive Jobs</span></div>
    </div>

    <div className="console-grid">
      <div className="panel planner">
        <div className="panel-head"><strong>Route planen</strong><span>OSM + Earth Policy</span></div>
        {spatialInventories.length < 2 ? <div className="notice">
          <b>Noch keine zwei räumlich gebundenen Earth-Inventare.</b>
          <span>Core liefert bereits Inventar und TransportJobs. Für echte Facility→Facility-Routen fehlen auf Earth noch die `tile_entity`-Inventarknoten; dieser Restpunkt ist im offenen Core-Handoff dokumentiert.</span>
        </div> : <>
          <label>Quelle<select value={sourceId} onChange={e => setSourceId(e.currentTarget.value)}>{spatialInventories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Ziel<select value={destinationId} onChange={e => setDestinationId(e.currentTarget.value)}>{spatialInventories.filter(item => item.id !== sourceId).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Earth-Fahrzeugrolle<select value={role} onChange={e => setRole(e.currentTarget.value as EarthSurfaceVehicleRole)}><option value="cargo-rover">Cargo Rover</option><option value="heavy-hauler">Heavy Hauler</option></select></label>
          <button className="primary" disabled={routeBusy || !source || !destination || source.id === destination.id} onClick={() => void calculateRoute()}>{routeBusy ? 'Route wird berechnet …' : 'OSM-Route prüfen'}</button>
        </>}

        {sourceSnapshot?.items && <div className="stock"><small>QUELLBESTAND</small>{sourceSnapshot.items.filter(item => Number(item.amount) > 0).length ? sourceSnapshot.items.filter(item => Number(item.amount) > 0).map(item => <div key={item.resource}><span>{item.label ?? item.resource}</span><b>{item.available ?? item.amount} {item.unit ?? ''}</b></div>) : <em>Kein physischer Bestand vorhanden.</em>}</div>}

        {route && !('reason' in route) && <div className="route-result ok">
          <div><span>Distanz</span><b>{formatDistance(route.distanceM)}</b></div>
          <div><span>Straße</span><b>{formatDistance(route.roadDistanceM)}</b></div>
          <div><span>Offroad</span><b>{formatDistance(route.offroadDistanceM)}</b></div>
          <div><span>Energie-Faktor</span><b>× {route.energyMultiplier.toFixed(2)}</b></div>
          <div><span>Wear-Faktor</span><b>× {route.wearMultiplier.toFixed(2)}</b></div>
          <div className="segments">{route.segments.map((segment, index) => <span key={`${segment.featureId ?? 'access'}-${index}`}>{segment.routeClass}</span>)}</div>
          <p>Die Route ist Earth-validiert. ETA, Energiebudget und TransportJob werden nicht lokal erfunden; dafür wird der gemeinsame Surface-Mission-Vertrag verwendet, sobald er auf `main` verfügbar ist.</p>
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
        <div className="rows">{vehicles.length ? vehicles.map(vehicle => <div className="row" key={vehicle.id}><div><b>{vehicle.label ?? vehicle.frameId}</b><small>{vehicle.frameId} · Kapazität {vehicle.cargoCapacityT ?? '–'} t · Wear {Number(vehicle.wear ?? 0).toFixed(1)}</small></div><span className={`badge ${vehicle.status === 'ready' ? 'good' : ''}`}>{STATUS_LABELS[vehicle.status] ?? vehicle.status}</span></div>) : <em>Noch keine Surface-Fahrzeuge an Earth registriert.</em>}</div>
      </div>

      <div className="panel jobs">
        <div className="panel-head"><strong>Transportaufträge</strong><span>persistierter Core-Status</span></div>
        <div className="rows">{jobs.length ? jobs.slice(0, 8).map(job => <div className="row" key={job.id}><div><b>{job.amount} {job.resource}</b><small>{job.vehicle_role ?? 'ohne Fahrzeugrolle'}{job.arrives_at ? ` · ETA ${new Date(job.arrives_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}</small></div><span className={`badge ${job.status === 'completed' ? 'good' : job.status === 'failed' ? 'bad' : ''}`}>{STATUS_LABELS[job.status] ?? job.status}</span></div>) : <em>Noch keine Earth-Transportaufträge.</em>}</div>
      </div>
    </div>

    <style jsx>{`
      .earth-logistics-console{max-width:1500px;margin:18px auto;padding:16px;box-sizing:border-box;background:#102632;color:#e7ece8;border:1px solid #425d67;border-radius:13px;box-shadow:0 16px 45px #162c3330;font-family:system-ui,sans-serif}
      header{display:flex;justify-content:space-between;gap:24px;align-items:start;margin-bottom:13px}header small{font-size:9px;letter-spacing:.16em;color:#d1ad55;font-weight:900}h2{font-family:Georgia,serif;font-weight:400;font-size:24px;margin:3px 0}header p{margin:0;color:#9fb0b5;font-size:11px;max-width:780px}header button,.primary{border:1px solid #8e7433;background:#d2a843;color:#102632;border-radius:7px;padding:8px 11px;font-weight:900;cursor:pointer}header button:disabled,.primary:disabled{opacity:.5;cursor:wait}
      .summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.summary-grid>div{background:#173541;border:1px solid #31505b;border-radius:8px;padding:9px}.summary-grid b{display:block;color:#f0cc6c;font-size:18px}.summary-grid span{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#9fb0b5}
      .console-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:10px}.panel{background:#132f3a;border:1px solid #35525d;border-radius:9px;padding:11px;min-width:0}.planner{grid-row:span 2}.jobs{grid-column:2}.panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.panel-head strong{font-size:12px}.panel-head span{font-size:8px;color:#91a7ad;text-transform:uppercase;letter-spacing:.08em}
      label{display:grid;gap:4px;color:#9fb0b5;font-size:9px;margin:7px 0}select{width:100%;background:#0b202a;color:#e7ece8;border:1px solid #46616a;border-radius:6px;padding:8px}.primary{width:100%;margin:5px 0 8px}.rows{display:grid;gap:5px}.row{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px;background:#0d2530;border-radius:6px}.row b{display:block;font-size:10px}.row small{display:block;color:#8fa2a8;font-size:8px;margin-top:2px}.badge{font-size:8px;background:#304650;color:#c5d0d2;border-radius:999px;padding:4px 6px;white-space:nowrap}.badge.good{background:#315d4a;color:#d6f0df}.badge.bad{background:#703d3d;color:#ffe2df}.hint{display:block;margin-top:8px;color:#83989f;font-size:8px;line-height:1.4}
      .notice{display:grid;gap:4px;padding:9px;margin:8px 0;border-radius:7px;background:#263f48;color:#cbd6d7;font-size:9px}.notice.error{background:#532f31;color:#f2d6d2}.notice b{font-size:10px}.stock{margin:10px 0;padding:8px;background:#0c222c;border-radius:7px}.stock>small{display:block;color:#d4b45e;font-size:8px;font-weight:900;margin-bottom:5px}.stock>div{display:flex;justify-content:space-between;font-size:9px;border-top:1px solid #25404a;padding:5px 0}.stock em,.rows>em{font-size:9px;color:#879da3;font-style:normal}
      .route-result{margin-top:9px;padding:9px;border-radius:7px;background:#123a35;border:1px solid #376e60;display:grid;grid-template-columns:repeat(2,1fr);gap:5px 10px}.route-result>div:not(.segments){display:flex;justify-content:space-between;font-size:9px}.route-result span{color:#a9c5bc}.route-result b{color:#e1d27e}.segments{grid-column:1/-1;display:flex;gap:4px;flex-wrap:wrap}.segments span{background:#31564b;color:#e0eee8;border-radius:999px;padding:3px 6px;font-size:8px}.route-result p{grid-column:1/-1;margin:4px 0 0;color:#a7bbb6;font-size:8px;line-height:1.4}
      @media(max-width:850px){.summary-grid{grid-template-columns:repeat(2,1fr)}.console-grid{grid-template-columns:1fr}.planner{grid-row:auto}.jobs{grid-column:auto}header{align-items:stretch;flex-direction:column}}
    `}</style>
  </section>
}
