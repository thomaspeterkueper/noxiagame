'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'
import {
  assessEarthSpaceportHandover,
  buildEarthSurfaceHandoverChain,
  type EarthSurfaceHandoverNode,
  type EarthSurfaceInventoryNodeInput,
} from '@/lib/game/earthSurfaceHandover'
import { earthRoutingWindowFor, planEarthSurfaceRoute, type EarthSurfaceRoutePlanResult } from '@/lib/game/earthSurfaceRouting'
import type { EarthSurfaceVehicleRole } from '@/lib/game/earthSurfaceLogistics'
import { earthOverlayNodeFromInventory, type EarthTransportOverlayNode } from '@/lib/game/earthTransportOverlay'
import {
  EARTH_TRANSPORT_RULE_CORE_CONTRACT,
  evaluateEarthTransportRuleIntent,
  type EarthTransportRuleIntent,
  type EarthTransportRuleKind,
  type EarthTransportRuleStockEntry,
} from '@/lib/game/earthTransportRulePreview'
import { useEarthTransportOverlayStore } from '@/lib/store/earthTransportOverlayStore'
import { localMetersToGeo, type GeoPoint } from '@/lib/world/spatial/earthSpatial'
import type { ImportedEarthFeature } from '@/lib/world/spatial/earthFeatureSource'

type SpatialEntity = {
  id: string
  name?: string
  x_m: number | null
  y_m: number | null
  latitude_deg?: number | null
  longitude_deg?: number | null
}

type SpatialPayload = {
  location?: { id: string; slug: string; name: string }
  spatialRegion?: { id: string; name: string; origin: GeoPoint } | null
  entities?: SpatialEntity[]
  error?: string
}

type Inventory = EarthSurfaceInventoryNodeInput & { entity?: SpatialEntity; point?: GeoPoint }

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
type RegionPayload = { ok?: boolean; features?: ImportedEarthFeature[]; error?: string }

type ChainNode = EarthSurfaceInventoryNodeInput & { point: GeoPoint | null }

const STATUS_LABELS: Record<string, string> = {
  ready: 'Bereit', maintenance: 'Wartung', damaged: 'Beschädigt', disabled: 'Außer Betrieb',
}

const ROLE_LABELS: Record<EarthSurfaceHandoverNode['role'], string> = {
  facility: 'Gebäude · Produktion/Verarbeitung',
  depot: 'Lager · Depot',
  'spaceport-storage': 'Raumhafenlager · Umschlag',
  'surface-port': 'Shuttle-Pad · Oberflächengrenze',
  vehicle: 'Fahrzeug',
  location: 'Aggregierter Standortbestand',
  other: 'Nicht zugeordnet',
}

const HANDOVER_STATE_LABELS: Record<ReturnType<typeof assessEarthSpaceportHandover>['state'], string> = {
  ready: 'Surface-Kette vollständig',
  'storage-missing': 'Raumhafenlager fehlt',
  'surface-port-missing': 'Shuttle-Pad fehlt',
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

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
}

export default function EarthSurfaceHandoverPanel() {
  const [spatial, setSpatial] = useState<SpatialPayload | null>(null)
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [sourceSelection, setSourceSelection] = useState('')
  const [destinationSelection, setDestinationSelection] = useState('')
  const [resourceSelection, setResourceSelection] = useState('')
  const [ruleKind, setRuleKind] = useState<EarthTransportRuleKind>('minimum-stock')
  const [thresholdAmount, setThresholdAmount] = useState(40)
  const [maxAmount, setMaxAmount] = useState(15)
  const [role, setRole] = useState<EarthSurfaceVehicleRole>('cargo-rover')
  const [stocks, setStocks] = useState<{
    key: string
    source: EarthTransportRuleStockEntry[] | null
    destination: EarthTransportRuleStockEntry[] | null
  } | null>(null)
  const [routeCheck, setRouteCheck] = useState<{ key: string; route: EarthSurfaceRoutePlanResult } | null>(null)
  const [routeBusy, setRouteBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadCoreState() {
    setLoading(true)
    setMessage(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Nicht angemeldet')
      const headers = { Authorization: `Bearer ${token}` }
      const spatialResponse = await fetch('/api/game/build/spatial?location=earth', { headers })
      const spatialJson = await spatialResponse.json() as SpatialPayload
      if (!spatialResponse.ok || !spatialJson.location?.id) throw new Error(spatialJson.error ?? 'Earth-Weltzustand konnte nicht geladen werden')

      const [logisticsResponse, vehicleResponse] = await Promise.all([
        fetch(`/api/game/logistics?locationId=${encodeURIComponent(spatialJson.location.id)}`, { headers }),
        fetch(`/api/game/vehicles?locationId=${encodeURIComponent(spatialJson.location.id)}`, { headers }),
      ])
      const logisticsJson = await logisticsResponse.json() as LogisticsPayload
      const vehicleJson = await vehicleResponse.json() as VehiclesPayload
      if (!logisticsResponse.ok) throw new Error(logisticsJson.error ?? 'Logistikzustand konnte nicht geladen werden')
      if (!vehicleResponse.ok) throw new Error(vehicleJson.error ?? 'Fahrzeugzustand konnte nicht geladen werden')

      setSpatial(spatialJson)
      setInventories(logisticsJson.inventories ?? [])
      setVehicles(vehicleJson.vehicles ?? [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadCoreState() }, [])

  /** Core inventories bound to a physical tile entity, plus their surface position. */
  const chainNodes = useMemo<ChainNode[]>(() => {
    const origin = spatial?.spatialRegion?.origin
    const entityById = new Map((spatial?.entities ?? []).map(entity => [entity.id, entity]))
    return inventories.flatMap(inventory => {
      if (inventory.subject_type !== 'tile_entity' || !inventory.subject_id) return []
      const entity = entityById.get(inventory.subject_id)
      if (!entity) return []
      const point = pointForEntity(entity, origin)
      if (!point) return []
      return [{ ...inventory, point }]
    })
  }, [inventories, spatial])

  const chain = useMemo(() => buildEarthSurfaceHandoverChain(chainNodes), [chainNodes])
  const spaceport = useMemo(() => assessEarthSpaceportHandover(chainNodes), [chainNodes])
  const nodeById = useMemo(() => new Map(chainNodes.map(node => [node.id, node])), [chainNodes])
  const vehiclesByNode = useMemo(() => {
    const grouped = new Map<string, Vehicle[]>()
    for (const vehicle of vehicles) {
      const nodeId = vehicle.currentNodeInventoryId
      if (!nodeId) continue
      const bucket = grouped.get(nodeId)
      if (bucket) bucket.push(vehicle)
      else grouped.set(nodeId, [vehicle])
    }
    return grouped
  }, [vehicles])

  // Selections fall back to the chain itself, so no effect has to repair them: a
  // vanished or never chosen node simply resolves to the first usable one.
  const ruleSources = useMemo(
    () => [...chain.facilities, ...chain.depots, ...chain.spaceportStorage],
    [chain],
  )
  const defaultDestination = chain.spaceportStorage[0] ?? chain.depots[0] ?? null
  // A rule needs two different nodes, so the default source skips the default target.
  const defaultSource = ruleSources.find(node => node.id !== defaultDestination?.id)
    ?? chainNodes.find(node => node.id !== defaultDestination?.id)
    ?? null
  const sourceId = nodeById.has(sourceSelection) ? sourceSelection : defaultSource?.id ?? ''
  const destinationId = nodeById.has(destinationSelection) ? destinationSelection : defaultDestination?.id ?? ''
  const stockKey = sourceId && destinationId ? `${sourceId}|${destinationId}` : ''
  const routeKey = `${sourceId}|${destinationId}|${role}`

  // Both snapshots are read straight from Core; the rule preview never books stock.
  // A snapshot is only rendered for the node pair it was actually loaded for.
  useEffect(() => {
    if (!sourceId || !destinationId) return
    let cancelled = false
    void (async () => {
      const key = `${sourceId}|${destinationId}`
      try {
        const token = await getToken()
        if (!token) return
        const headers = { Authorization: `Bearer ${token}` }
        const [sourceResponse, destinationResponse] = await Promise.all([
          fetch(`/api/game/logistics?inventoryId=${encodeURIComponent(sourceId)}`, { headers, cache: 'no-store' }),
          fetch(`/api/game/logistics?inventoryId=${encodeURIComponent(destinationId)}`, { headers, cache: 'no-store' }),
        ])
        const sourceJson = await sourceResponse.json() as LogisticsPayload
        const destinationJson = await destinationResponse.json() as LogisticsPayload
        if (cancelled) return
        const entries = (snapshot: InventorySnapshot | undefined): EarthTransportRuleStockEntry[] =>
          (snapshot?.items ?? []).map(item => ({ resource: item.resource, amount: item.amount, available: item.available, unit: item.unit ?? null }))
        setStocks({
          key,
          source: sourceResponse.ok ? entries(sourceJson.inventory) : null,
          destination: destinationResponse.ok ? entries(destinationJson.inventory) : null,
        })
      } catch {
        if (!cancelled) setStocks({ key, source: null, destination: null })
      }
    })()
    return () => { cancelled = true }
  }, [sourceId, destinationId])

  const source = nodeById.get(sourceId) ?? null
  const destination = nodeById.get(destinationId) ?? null
  const sourceStock = stocks && stocks.key === stockKey ? stocks.source : null
  const destinationStock = stocks && stocks.key === stockKey ? stocks.destination : null
  const sourceItems = (sourceStock ?? []).filter(item => Number(item.available ?? item.amount) > 0)
  const resource = resourceSelection && sourceItems.some(item => item.resource === resourceSelection)
    ? resourceSelection
    : sourceItems[0]?.resource ?? ''
  // A checked route belongs to exactly one node pair and vehicle role.
  const route = routeCheck && routeCheck.key === routeKey ? routeCheck.route : null

  const ruleIntent: EarthTransportRuleIntent | null = source && destination
    ? {
      kind: ruleKind,
      sourceInventoryId: source.id,
      destinationInventoryId: destination.id,
      resource,
      thresholdAmount,
      maxAmount: ruleKind === 'surplus-transfer' ? maxAmount : null,
    }
    : null
  const ruleEvaluation = ruleIntent
    ? evaluateEarthTransportRuleIntent({ intent: ruleIntent, sourceStock, destinationStock, route })
    : null

  async function checkRuleRoute() {
    if (!source?.point || !destination?.point) return
    setRouteBusy(true)
    setRouteCheck(null)
    setMessage(null)
    try {
      const window = earthRoutingWindowFor(source.point, destination.point)
      if (!window.ok) throw new Error('Quelle und Raumhafenlager liegen außerhalb des derzeit maximal 6-km-lokalen OSM-Routingfensters.')
      const query = new URLSearchParams({
        lat: String(window.center.lat),
        lon: String(window.center.lon),
        radiusKm: String(window.radiusKm),
      })
      const response = await fetch(`/api/earth/region?${query}`, { cache: 'no-store' })
      const json = await response.json() as RegionPayload
      if (!response.ok || !json.ok) throw new Error(json.error ?? 'OSM-Routingdaten konnten nicht geladen werden')
      setRouteCheck({
        key: routeKey,
        route: planEarthSurfaceRoute({
          features: json.features ?? [], source: source.point, destination: destination.point, vehicleRole: role,
        }),
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setRouteBusy(false)
    }
  }

  // The spaceport is the surface handover point of the Earth map; only these nodes
  // are contributed here, the rest of the chain stays in this panel.
  const publishOverlay = useEarthTransportOverlayStore(state => state.publish)
  const clearOverlay = useEarthTransportOverlayStore(state => state.clear)
  const spaceportNodes = useMemo<EarthTransportOverlayNode[]>(() => {
    const nodes: EarthTransportOverlayNode[] = []
    for (const chainNode of [...chain.spaceportStorage, ...chain.surfacePorts]) {
      const node = nodeById.get(chainNode.id)
      if (!node?.point) continue
      const overlayNode = earthOverlayNodeFromInventory(node, node.point)
      if (overlayNode) nodes.push(overlayNode)
    }
    return nodes
  }, [chain, nodeById])

  useEffect(() => {
    publishOverlay('spaceport-handover', { nodes: spaceportNodes })
  }, [publishOverlay, spaceportNodes])

  useEffect(() => () => clearOverlay('spaceport-handover'), [clearOverlay])

  return <section className="earth-handover">
    <header>
      <div>
        <small>EARTH · RAUMHAFEN ALS SURFACE-UMSCHLAGPUNKT</small>
        <h2>Gebäude ↔ Fahrzeug ↔ Lager</h2>
        <p>Die Kette wird vollständig aus Core-Inventaren, Core-Fahrzeugen und den bereits geladenen Earth-Layern gelesen. Earth fügt dieser Kette nur die planetare Interpretation hinzu.</p>
      </div>
      <button onClick={() => void loadCoreState()} disabled={loading}>{loading ? 'Lädt …' : 'Aktualisieren'}</button>
    </header>

    {message && <div className="notice error">{message}</div>}

    <div className="handover-summary" data-state={spaceport.state}>
      <div className="summary-head">
        <b>{HANDOVER_STATE_LABELS[spaceport.state]}</b>
        <span>Umschlaggrenze: {spaceport.boundary === 'surface-port' ? 'Shuttle-Pad (Oberfläche)' : spaceport.boundary}</span>
      </div>
      <p>{spaceport.note}</p>
      {spaceport.shuttle && <p className="shuttle">
        <b>{spaceport.shuttle.name}</b> · {spaceport.shuttle.craftId} · {spaceport.shuttle.note}
      </p>}
      <div className="summary-counts">
        <div><b>{chain.facilities.length}</b><span>Gebäude</span></div>
        <div><b>{chain.depots.length}</b><span>Depots</span></div>
        <div><b>{chain.spaceportStorage.length}</b><span>Raumhafenlager</span></div>
        <div><b>{chain.surfacePorts.length}</b><span>Shuttle-Pads</span></div>
        <div><b>{vehicles.length}</b><span>Fahrzeuge</span></div>
      </div>
    </div>

    <div className="chain-grid">
      {([
        ['facility', 'Produktion & Verarbeitung', chain.facilities],
        ['depot', 'Lager & Depots', chain.depots],
        ['spaceport-storage', 'Raumhafenlager', chain.spaceportStorage],
        ['surface-port', 'Shuttle-Pads', chain.surfacePorts],
      ] as [EarthSurfaceHandoverNode['role'], string, EarthSurfaceHandoverNode[]][]).map(([roleKey, title, nodes]) =>
        <div className="panel" key={roleKey}>
          <div className="panel-head"><strong>{title}</strong><span>{nodes.length} Knoten</span></div>
          {nodes.length ? nodes.map(node => {
            const here = vehiclesByNode.get(node.id) ?? []
            const point = nodeById.get(node.id)?.point ?? null
            return <div className="chain-node" key={node.id}>
              <div className="chain-node-head">
                <b>{node.label}</b>
                <span>{node.purpose ?? ROLE_LABELS[node.role]}</span>
              </div>
              <small>{point ? `${point.lat.toFixed(5)} / ${point.lon.toFixed(5)}` : 'ohne aufgelösten Oberflächenpunkt'}</small>
              {here.length
                ? <div className="vehicles">{here.map(vehicle => <span key={vehicle.id} className={vehicle.status === 'ready' ? 'vehicle ready' : 'vehicle'}>{vehicle.label ?? vehicle.frameId} · {STATUS_LABELS[vehicle.status] ?? vehicle.status}</span>)}</div>
                : <div className="vehicles empty">kein Fahrzeug vor Ort</div>}
            </div>
          }) : <em className="empty">Kein Knoten dieser Art im geladenen Core-Zustand.</em>}
        </div>)}
    </div>

    <div className="panel rule">
      <div className="panel-head"><strong>Automatische Transportregel · Vorschau</strong><span>nicht persistiert</span></div>
      <p className="rule-note">
        Earth prüft hier nur, ob eine Regel auf dem beobachteten Core-Bestand greifen würde und ob die planetare Route
        dafür freigegeben ist. Regelmodell, Persistenz, Reservierung und Ausführung bleiben Core-owned; dieser Teil ist
        als fehlender Contract <code>{EARTH_TRANSPORT_RULE_CORE_CONTRACT}</code> an NOXIA-CORE gemeldet.
      </p>

      {!chain.spaceportStorage.length
        ? <div className="notice">Ohne Core-Inventar mit <code>metadata.role = spaceport_storage</code> gibt es keinen Umschlagknoten, auf den eine Regel zielen könnte.</div>
        : <div className="rule-grid">
          <label>Regelart
            <select value={ruleKind} onChange={e => setRuleKind(e.currentTarget.value as EarthTransportRuleKind)}>
              <option value="minimum-stock">Mindestbestand im Raumhafenlager halten</option>
              <option value="surplus-transfer">Überschuss abgeben</option>
            </select>
          </label>
          <label>Quelle
            <select value={sourceId} onChange={e => { setSourceSelection(e.currentTarget.value); setResourceSelection('') }}>
              {ruleSources.map(node => <option key={node.id} value={node.id}>{node.label} · {node.purpose ?? node.role}</option>)}
            </select>
          </label>
          <label>Ziel (Umschlagpunkt)
            <select value={destinationId} onChange={e => setDestinationSelection(e.currentTarget.value)}>
              {[...chain.spaceportStorage, ...chain.depots].map(node => <option key={node.id} value={node.id}>{node.label} · {node.purpose ?? node.role}</option>)}
            </select>
          </label>
          <label>Gut
            <select value={resource} onChange={e => setResourceSelection(e.currentTarget.value)}>
              <option value="">–</option>
              {sourceItems.map(item => <option key={item.resource} value={item.resource}>{item.resource} · {item.available ?? item.amount} {item.unit ?? ''}</option>)}
            </select>
          </label>
          <label>{ruleKind === 'minimum-stock' ? 'Mindestbestand' : 'Schwelle im Quellbestand'}
            <input type="number" min={1} value={thresholdAmount} onChange={e => setThresholdAmount(Math.max(1, Math.floor(Number(e.currentTarget.value) || 1)))} />
          </label>
          {ruleKind === 'surplus-transfer' && <label>Maximum je Fahrt
            <input type="number" min={1} value={maxAmount} onChange={e => setMaxAmount(Math.max(1, Math.floor(Number(e.currentTarget.value) || 1)))} />
          </label>}
          <label>Earth-Routingklasse
            <select value={role} onChange={e => setRole(e.currentTarget.value as EarthSurfaceVehicleRole)}>
              <option value="cargo-rover">Cargo Rover</option>
              <option value="heavy-hauler">Heavy Hauler</option>
            </select>
          </label>
          <button className="primary" disabled={routeBusy || !source?.point || !destination?.point} onClick={() => void checkRuleRoute()}>
            {routeBusy ? 'Route wird geprüft …' : 'Earth-Route der Regel prüfen'}
          </button>
        </div>}

      {ruleEvaluation && <div className="rule-result" data-trigger={ruleEvaluation.triggerMet ? 'met' : 'idle'}>
        <div className="rule-facts">
          <div><span>Bestand Quelle</span><b>{ruleEvaluation.sourceAmount ?? 'nicht geladen'}</b></div>
          <div><span>Bestand Ziel</span><b>{ruleEvaluation.destinationAmount ?? 'nicht geladen'}</b></div>
          <div><span>Auslöser</span><b>{ruleEvaluation.triggerMet ? 'greift' : 'ruht'}</b></div>
          <div><span>Menge je Lauf</span><b>{ruleEvaluation.plannedAmount ?? '–'}</b></div>
          <div><span>Earth-Route</span><b>{ruleEvaluation.routeState === 'validated' ? 'freigegeben' : ruleEvaluation.routeState === 'blocked' ? 'blockiert' : 'ungeprüft'}</b></div>
        </div>
        {route && 'distanceM' in route && <small className="route-facts">
          {formatDistance(route.distanceM)} · Straße {formatDistance(route.roadDistanceM)} · Offroad {formatDistance(route.offroadDistanceM)}
        </small>}
        {ruleEvaluation.blockers.length > 0 && <div className="notice error">
          {ruleEvaluation.blockers.map(blocker => <span key={blocker}>{blocker}</span>)}
        </div>}
        <p className="rule-hint">
          {ruleEvaluation.plannedAmount != null
            ? `Würde die Regel laufen, bewegte sie ${ruleEvaluation.plannedAmount} Einheiten. Reservierung und Ausführung fehlen, bis Core ${EARTH_TRANSPORT_RULE_CORE_CONTRACT} bereitstellt.`
            : 'Solange die Regel nicht greift, entsteht keine Bewegung und keine Reservierung.'}
        </p>
      </div>}
    </div>

    <style jsx>{`
      .earth-handover{max-width:1500px;margin:18px auto;padding:16px;box-sizing:border-box;background:#102632;color:#e7ece8;border:1px solid #425d67;border-radius:13px;font-family:system-ui,sans-serif}
      header{display:flex;justify-content:space-between;gap:24px;align-items:start;margin-bottom:13px}header small{font-size:9px;letter-spacing:.16em;color:#d1ad55;font-weight:900}header h2{font-family:Georgia,serif;font-weight:400;font-size:24px;margin:3px 0}header p{margin:0;color:#9fb0b5;font-size:11px;max-width:820px}header button{border:1px solid #8e7433;background:#d2a843;color:#102632;border-radius:7px;padding:8px 11px;font-weight:900;cursor:pointer}header button:disabled{opacity:.5;cursor:not-allowed}
      .handover-summary{background:#132f3a;border:1px solid #35525d;border-radius:9px;padding:11px;margin-bottom:10px}.handover-summary[data-state='ready']{border-color:#39705c;background:#10342f}.handover-summary[data-state='storage-missing'],.handover-summary[data-state='surface-port-missing']{border-color:#8a6b21;background:#33290f}
      .summary-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap}.summary-head b{font-size:13px;color:#f0cc6c}.summary-head span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#9fb0b5}
      .handover-summary p{margin:6px 0 0;font-size:10px;color:#b7c6c9;line-height:1.45}.handover-summary .shuttle{color:#d9e2e0}.shuttle b{color:#e1d27e}
      .summary-counts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:9px}.summary-counts>div{background:#0d2530;border-radius:7px;padding:7px}.summary-counts b{display:block;font-size:16px;color:#f0cc6c}.summary-counts span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#9fb0b5}
      .chain-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:10px}.panel{background:#132f3a;border:1px solid #35525d;border-radius:9px;padding:11px;min-width:0}.panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.panel-head strong{font-size:12px}.panel-head span{font-size:8px;color:#91a7ad;text-transform:uppercase;letter-spacing:.08em}
      .chain-node{background:#0d2530;border-radius:7px;padding:8px;margin-bottom:6px}.chain-node-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}.chain-node-head b{font-size:10px}.chain-node-head span{font-size:8px;color:#9fb0b5}.chain-node small{display:block;margin-top:3px;font-size:8px;color:#83989f}
      .vehicles{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.vehicle{font-size:8px;background:#304650;color:#c5d0d2;border-radius:999px;padding:3px 6px}.vehicle.ready{background:#315d4a;color:#d6f0df}.vehicles.empty{font-size:8px;color:#83989f}
      .panel em.empty{display:block;font-size:9px;color:#879da3;font-style:normal}
      .rule{margin-top:2px}.rule-note{margin:0 0 9px;font-size:9px;line-height:1.5;color:#a9bcc0;max-width:1000px}
      .rule-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;align-items:end}
      label{display:grid;gap:4px;color:#9fb0b5;font-size:9px}select,input{width:100%;box-sizing:border-box;background:#0b202a;color:#e7ece8;border:1px solid #46616a;border-radius:6px;padding:8px}
      .primary{border:1px solid #8e7433;background:#d2a843;color:#102632;border-radius:7px;padding:9px;font-weight:900;cursor:pointer}.primary:disabled{opacity:.5;cursor:not-allowed}
      .rule-result{margin-top:10px;padding:9px;border-radius:7px;background:#123a35;border:1px solid #376e60}.rule-result[data-trigger='idle']{background:#173541;border-color:#35525d}
      .rule-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px}.rule-facts>div{display:flex;justify-content:space-between;gap:8px;font-size:9px}.rule-facts span{color:#a9c5bc}.rule-facts b{color:#e1d27e}
      .route-facts{display:block;margin-top:7px;font-size:8px;color:#9fb0b5}
      .notice{display:grid;gap:4px;padding:9px;margin:8px 0;border-radius:7px;background:#263f48;color:#cbd6d7;font-size:9px}.notice.error{background:#532f31;color:#f2d6d2}
      .rule-hint{margin:8px 0 0;font-size:9px;line-height:1.5;color:#a7bbb6}code{color:#e4c76e}
      @media(max-width:1050px){.chain-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){.summary-counts{grid-template-columns:repeat(2,1fr)}.chain-grid{grid-template-columns:1fr}header{flex-direction:column}}
    `}</style>
  </section>
}
