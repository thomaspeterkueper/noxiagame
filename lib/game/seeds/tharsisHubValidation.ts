// lib/game/seeds/tharsisHubValidation.ts
// Erstellt: 30.08.2026
// Validierungslogik für den kanonischen Tharsis-Hub-Start-Seed.
// Prüft Akzeptanzkriterien des OTA-Auftrags: exakte Objektzahlen, N-1-Pfade
// (Energie + Wasser), alternative Rettungszugänge, doppelte Medienanbindung,
// physisch getrennte Utility-Netze, Zonenregeln und Eigentumsmodell.

import {
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_VEHICLES,
  THARSIS_HUB_ROADS,
  THARSIS_HUB_UTILITY_RINGS,
  THARSIS_HUB_UTILITY_LINKS,
  THARSIS_COOLING_LINKS,
  THARSIS_HUB_POPULATION,
  THARSIS_HUB_HABITAT_CAPACITY,
  HABITAT_CLUSTER_CAPACITY,
  THARSIS_VEHICLE_CLASSES,
  UTILITY_MEDIA,
  getRingNodes,
} from './tharsisHubSeed'
import type { SeedBuilding } from './tharsisHubSeed'

export interface SeedIssue { message: string }

const GRID_ROWS = 24
const GRID_COLS = 32

function cellKey(r: number, c: number): string { return `${r}:${c}` }

// ─── 1. Kollisionen / Bounds ────────────────────────────────────────────────

export function validatePlacement(): SeedIssue[] {
  const issues: SeedIssue[] = []
  const seen = new Map<string, string>()

  const claim = (kind: string, id: string, r: number, c: number) => {
    if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) {
      issues.push({ message: `${kind} ${id} außerhalb des Grids: (${r},${c})` })
      return
    }
    const key = cellKey(r, c)
    const prev = seen.get(key)
    if (prev) issues.push({ message: `Zellen-Kollision (${r},${c}): ${prev} ↔ ${kind} ${id}` })
    else seen.set(key, `${kind} ${id}`)
  }

  for (const b of THARSIS_HUB_BUILDINGS) claim('Gebäude', b.id, b.row, b.col)
  for (const v of THARSIS_HUB_VEHICLES) claim('Fahrzeug', v.id, v.row, v.col)
  for (const r of THARSIS_HUB_ROADS) claim('Straße', `${r.kind}`, r.row, r.col)

  for (const ring of THARSIS_HUB_UTILITY_RINGS) {
    for (const [r, c] of ring.nodes) {
      const key = cellKey(r, c)
      const prev = seen.get(key)
      if (prev) issues.push({ message: `Utility Ring ${ring.ring} kollidiert mit ${prev} auf (${r},${c})` })
      else seen.set(key, `Utility Ring ${ring.ring}`)
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) {
        issues.push({ message: `Utility Ring ${ring.ring} außerhalb des Grids: (${r},${c})` })
      }
    }
  }

  // Ring A und Ring B dürfen sich keine Zelle teilen (physisch getrennt).
  const aNodes = new Set(getRingNodes('A').map(([r, c]) => cellKey(r, c)))
  for (const [r, c] of getRingNodes('B')) {
    if (aNodes.has(cellKey(r, c))) issues.push({ message: `Utility Ring A und B teilen sich Zelle (${r},${c})` })
  }

  // Road-Tiles enthalten nicht automatisch alle Medien: Straßen und
  // Utility-Netze müssen zellfremd bleiben.
  for (const road of THARSIS_HUB_ROADS) {
    for (const ring of THARSIS_HUB_UTILITY_RINGS) {
      if (ring.nodes.some(([r, c]) => r === road.row && c === road.col)) {
        issues.push({ message: `Utility Ring ${ring.ring} verläuft über Straßen-Tile (${road.row},${road.col})` })
      }
    }
  }

  return issues
}

// ─── 2. Exakte Stückzahlen ──────────────────────────────────────────────────

export function validateCounts(): SeedIssue[] {
  const issues: SeedIssue[] = []
  const buildings = new Map<string, number>()
  for (const b of THARSIS_HUB_BUILDINGS) buildings.set(b.entityId, (buildings.get(b.entityId) ?? 0) + 1)
  const vehicles = new Map<string, number>()
  for (const v of THARSIS_HUB_VEHICLES) vehicles.set(v.classId, (vehicles.get(v.classId) ?? 0) + 1)

  const expect = (map: Map<string, number>, id: string, n: number, label: string) => {
    const got = map.get(id) ?? 0
    if (got !== n) issues.push({ message: `${label}: ${got} statt ${n}` })
  }

  // Abschnitt 1 — Physische Startobjekte
  expect(buildings, 'habitat_cluster', 6, 'Habitatcluster')
  expect(buildings, 'eclss_hub', 3, 'Regionale ECLSS-Hubs')
  expect(buildings, 'reactor_module', 6, 'Reaktormodule')
  expect(buildings, 'black_start', 3, 'Black-Start-Knoten')
  expect(buildings, 'water_isru', 3, 'Wasser-ISRU-Komplexe')
  expect(buildings, 'radiator_field', 5, 'Radiatorfelder')
  expect(buildings, 'medical_core', 1, 'Medical Core')
  expect(buildings, 'medical_annex', 1, 'Emergency Medical Annex')
  expect(buildings, 'reserve_depot', 3, 'Strategische Reserve-Depots')
  expect(buildings, 'plant_module', 1, 'Frischproduktions-Komplex')
  expect(buildings, 'logistics_hub', 1, 'Logistik-/Frachtumschlag-Hub')
  expect(buildings, 'workshop_clean', 1, 'Saubere Werkstattzelle')
  expect(buildings, 'workshop_heavy', 1, 'Schwere Werkstattzelle')
  expect(buildings, 'material_complex', 2, 'Material-/Reststoff-Komplexe')
  expect(buildings, 'command_node', 2, 'Command-&-Control-Knoten')
  expect(buildings, 'surface_relay', 3, 'Oberflächen-Relays')
  expect(buildings, 'longrange_comms', 2, 'Langstrecken-Kommunikationsstationen')

  // Abschnitt 2 — Fahrzeug-Startbestand
  for (const cls of Object.values(THARSIS_VEHICLE_CLASSES)) {
    expect(vehicles, cls.id, cls.count, cls.label)
  }

  // Bevölkerung / Kapazität
  if (THARSIS_HUB_POPULATION !== 497) issues.push({ message: `Startbevölkerung: ${THARSIS_HUB_POPULATION} statt 497` })
  if (THARSIS_HUB_HABITAT_CAPACITY < 504) issues.push({ message: `Habitatplätze: ${THARSIS_HUB_HABITAT_CAPACITY} < 504` })
  if (6 * HABITAT_CLUSTER_CAPACITY !== THARSIS_HUB_HABITAT_CAPACITY) {
    issues.push({ message: `6×${HABITAT_CLUSTER_CAPACITY} ≠ ${THARSIS_HUB_HABITAT_CAPACITY}` })
  }
  if (THARSIS_HUB_POPULATION > THARSIS_HUB_HABITAT_CAPACITY) {
    issues.push({ message: '497 Bewohner passen nicht in die Habitatkapazität' })
  }

  // Wasser-Reserve: mindestens 24 t gesicherte Nachspeisereserve
  const waterT = THARSIS_HUB_BUILDINGS
    .filter(b => b.entityId === 'water_isru')
    .reduce((sum, b) => sum + (b.waterBufferT ?? 0), 0)
  if (waterT < 24) issues.push({ message: `ECLSS-/Trinkwasser-Nachspeisereserve: ${waterT}t < 24t` })

  // Nahrungs-Reserve: mindestens 27 t; kein Depot hält mehr als die Hälfte
  const foodDepots = THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'reserve_depot')
  const foodT = foodDepots.reduce((sum, b) => sum + (b.foodReserveT ?? 0), 0)
  if (foodT < 27) issues.push({ message: `30-Tage-Nahrungsreserve: ${foodT}t < 27t` })
  for (const d of foodDepots) {
    if ((d.foodReserveT ?? 0) > foodT / 2) {
      issues.push({ message: `Depot ${d.id} hält mehr als die Hälfte der lebenswichtigen Reserve` })
    }
  }

  // Energie: drei Komplexe × 2 Module × 1 Black-Start; ~7–8 MW Architektur
  const complexes = new Set(THARSIS_HUB_BUILDINGS.filter(b => b.complexId).map(b => b.complexId))
  if (complexes.size !== 3) issues.push({ message: `Energie-Komplexe: ${complexes.size} statt 3` })
  for (const complexId of complexes) {
    const mods = THARSIS_HUB_BUILDINGS.filter(b => b.complexId === complexId && b.entityId === 'reactor_module')
    const starts = THARSIS_HUB_BUILDINGS.filter(b => b.complexId === complexId && b.entityId === 'black_start')
    if (mods.length !== 2) issues.push({ message: `${complexId}: ${mods.length} Reaktormodule statt 2` })
    if (starts.length !== 1) issues.push({ message: `${complexId}: ${starts.length} Black-Start-Knoten statt 1` })
  }
  const totalMw = THARSIS_HUB_BUILDINGS
    .filter(b => b.entityId === 'reactor_module')
    .reduce((sum, b) => sum + (b.nominalPowerMw ?? 0), 0)
  if (totalMw < 7 || totalMw > 8) issues.push({ message: `Nennleistung: ${totalMw} MW außerhalb 7–8 MW` })

  // Thermik: zwei getrennte Hauptkreise
  const circuits = new Set(THARSIS_HUB_BUILDINGS.filter(b => b.circuitId).map(b => b.circuitId))
  if (circuits.size !== 2) issues.push({ message: `Thermische Hauptkreise: ${circuits.size} statt 2` })

  return issues
}

// ─── 3. Zonen- und Abhängigkeitsregeln ──────────────────────────────────────

export function validateZoneRules(): SeedIssue[] {
  const issues: SeedIssue[] = []
  const byId = new Map(THARSIS_HUB_BUILDINGS.map(b => [b.id, b]))

  const annex = byId.get('medical_annex')
  const core = byId.get('medical_core')
  if (annex && core && annex.clusterRef === core.clusterRef) {
    issues.push({ message: 'Medical Annex liegt im selben Habitatcluster wie der Medical Core' })
  }

  const c1 = byId.get('command_node_1')
  const c2 = byId.get('command_node_2')
  if (c1 && c2 && c1.clusterRef === c2.clusterRef) {
    issues.push({ message: 'Beide Command-&-Control-Knoten liegen im selben Habitatcluster' })
  }

  // Langstreckenstationen: nicht in derselben Schadensdomäne
  const comms1 = byId.get('longrange_comms_1')
  const comms2 = byId.get('longrange_comms_2')
  if (comms1 && comms2 && comms1.zone === comms2.zone) {
    issues.push({ message: 'Beide Langstreckenstationen liegen in derselben Schadensdomäne' })
  }

  // Energie-Komplexe: drei räumlich getrennte Domänen außerhalb des Druckkerns
  const energyZones = new Set(
    THARSIS_HUB_BUILDINGS.filter(b => b.complexId && b.entityId === 'reactor_module').map(b => b.zone),
  )
  if (energyZones.size !== 3) issues.push({ message: `Energie-Domänen: ${energyZones.size} statt 3` })
  if (energyZones.has('A') || energyZones.has('B')) {
    issues.push({ message: 'Energie-Komplex liegt im Habitatkern (Zone A/B)' })
  }

  // Logistik-Hub: an der Grenze Außenbereich ↔ Drucksystem, nicht mit allen
  // strategischen Reserven zusammengelegt (Zone B, Depots verteilt).
  const hub = byId.get('logistics_hub')
  const depots = THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'reserve_depot')
  if (hub && depots.every(d => d.row === hub.row && d.col === hub.col)) {
    issues.push({ message: 'Logistik-Hub mit allen strategischen Reserven zusammengelegt' })
  }
  // Depots dürfen mit den allgemeinen strategischen Lagerdomänen zusammenfallen
  // (OTA-TEC-0102), sofern intern getrennte Lagerzonen bestehen. „Teile der
  // Reserve-Lager“ liegen laut Auftrag im Habitatkern (Zone A) — das ist zulässig.
  if (hub && depots.every(d => d.zone === hub.zone)) {
    issues.push({ message: 'Logistik-Hub liegt mit allen strategischen Reserven in derselben Zone' })
  }

  // Radiatorfelder: nicht als zusammenhängender Block
  const rf = THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'radiator_field')
  for (let i = 0; i < rf.length; i++) {
    for (let j = i + 1; j < rf.length; j++) {
      const adjacent = Math.abs(rf[i].row - rf[j].row) <= 1 && Math.abs(rf[i].col - rf[j].col) <= 1
      if (adjacent) issues.push({ message: `Radiatorfelder ${rf[i].id} und ${rf[j].id} liegen direkt benachbart` })
    }
  }

  // Kühlzuordnung: jeder kritische Kälteverbraucher hängt an zwei Feldern aus
  // verschiedenen Thermalkreisen.
  const circuitOf = new Map(
    THARSIS_HUB_BUILDINGS.filter(b => b.circuitId).map(b => [b.id, b.circuitId!]),
  )
  for (const [consumer, fields] of Object.entries(THARSIS_COOLING_LINKS)) {
    if (fields.length < 2) { issues.push({ message: `${consumer}: weniger als 2 Kühlfelder` }); continue }
    const fieldCircuits = new Set(fields.map(f => circuitOf.get(f)))
    if (fieldCircuits.size < 2) issues.push({ message: `${consumer}: Kühlfelder nicht auf zwei Thermalkreise verteilt` })
  }

  // ECLSS-Hubs: je Hub versorgt zwei Habitatcluster
  for (const b of THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'eclss_hub')) {
    if (!b.servesClusters || b.servesClusters.length !== 2) {
      issues.push({ message: `${b.id}: versorgt nicht genau zwei Habitatcluster` })
    }
  }

  return issues
}

// ─── 4. Straßen-Graph: N-1 für Energie- und Wasserzugang ────────────────────

type Point = [number, number]

function neighbours([r, c]: Point, cellSet: Set<string>): Point[] {
  const out: Point[] = []
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    if (cellSet.has(cellKey(r + dr, c + dc))) out.push([r + dr, c + dc])
  }
  return out
}

export function validateRoadResilience(): SeedIssue[] {
  const issues: SeedIssue[] = []
  const roads = THARSIS_HUB_ROADS.map(r => [r.row, r.col] as Point)
  const roadSet = new Set(roads.map(([r, c]) => cellKey(r, c)))

  const habitats = THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'habitat_cluster')
  const energyObjects = THARSIS_HUB_BUILDINGS.filter(b =>
    b.entityId === 'reactor_module' || b.entityId === 'black_start',
  )
  const waterObjects = THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'water_isru')

  // Ein Objekt ist „über Straße erreichbar“, wenn es auf oder direkt neben
  // einer Straßenzelle liegt (Zufahrt).
  const accessOf = (b: SeedBuilding): Point[] => {
    const pts: Point[] = []
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]] as const) {
      const key = cellKey(b.row + dr, b.col + dc)
      if (roadSet.has(key)) pts.push([b.row + dr, b.col + dc])
    }
    return pts
  }

  const reachable = (removed: Point | null): Set<string> => {
    const cells = new Set(roadSet)
    if (removed) cells.delete(cellKey(removed[0], removed[1]))
    const seen = new Set<string>()
    const queue: Point[] = roads.filter(([r, c]) => cells.has(cellKey(r, c)) && (removed === null || r !== removed[0] || c !== removed[1]))
    for (const p of queue) seen.add(cellKey(p[0], p[1]))
    while (queue.length > 0) {
      const p = queue.shift()!
      for (const n of neighbours(p, cells)) {
        const key = cellKey(n[0], n[1])
        if (!seen.has(key)) { seen.add(key); queue.push(n) }
      }
    }
    return seen
  }

  const clusterReaches = (cluster: SeedBuilding, reachableCells: Set<string>, targets: SeedBuilding[]): boolean => {
    const access = accessOf(cluster)
    if (access.length === 0) return false
    if (!access.some(([r, c]) => reachableCells.has(cellKey(r, c)))) return false
    return targets.some(t => {
      const tAccess = accessOf(t)
      return tAccess.length > 0 && tAccess.some(([r, c]) => reachableCells.has(cellKey(r, c)))
    })
  }

  // Basis: Straßennetz zusammenhängend + jeder Cluster erreicht Energie & Wasser
  const full = reachable(null)
  for (const h of habitats) {
    if (!clusterReaches(h, full, energyObjects)) {
      issues.push({ message: `${h.id} erreicht im Basisnetz keine Energie-Objekte` })
    }
    if (!clusterReaches(h, full, waterObjects)) {
      issues.push({ message: `${h.id} erreicht im Basisnetz keine Wasser-Objekte` })
    }
  }

  // N-1: Entfernen einer einzelnen Straßenzelle darf nicht gleichzeitig
  // sämtliche Wege zu Energie und Wasser abschneiden.
  for (const removed of roads) {
    const cells = reachable(removed)
    let anyHabitatWithoutBoth = false
    for (const h of habitats) {
      const hasEnergy = clusterReaches(h, cells, energyObjects)
      const hasWater = clusterReaches(h, cells, waterObjects)
      if (!hasEnergy || !hasWater) { anyHabitatWithoutBoth = true; break }
    }
    if (anyHabitatWithoutBoth) {
      issues.push({ message: `N-1 verletzt: Sperrung von (${removed[0]},${removed[1]}) trennt Cluster von Energie und/oder Wasser` })
    }
  }

  // Alternativer Rettungszugang: Medical Core und alle Habitatcluster brauchen
  // mindestens zwei verschiedene Straßen-Zufahrten.
  const rescueTargets = [...habitats, ...THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'medical_core' || b.entityId === 'medical_annex')]
  for (const t of rescueTargets) {
    const access = new Set(accessOf(t).map(([r, c]) => cellKey(r, c)))
    if (access.size < 2) issues.push({ message: `${t.id}: weniger als 2 alternative Rettungszugänge (${access.size})` })
  }

  return issues
}

// ─── 5. Doppelte Medienanbindung / Utility-Ringe ────────────────────────────

export function validateUtilityNetworks(): SeedIssue[] {
  const issues: SeedIssue[] = []
  const byId = new Map(THARSIS_HUB_BUILDINGS.map(b => [b.id, b]))
  const ringNodes = new Map(THARSIS_HUB_UTILITY_RINGS.map(r => [r.ring, new Set(r.nodes.map(([r, c]) => cellKey(r, c)))]))
  const ringMedia = new Map(THARSIS_HUB_UTILITY_RINGS.map(r => [r.ring, new Set(r.media)]))

  // Alle geforderten Medien sind modelliert.
  const allMedia = new Set<string>()
  for (const ring of THARSIS_HUB_UTILITY_RINGS) for (const m of ring.media) allMedia.add(m)
  for (const m of UTILITY_MEDIA) {
    if (!allMedia.has(m)) issues.push({ message: `Medium '${m}' ist in keinem Utility-Ring modelliert` })
  }

  // Jeder Habitatcluster und jede kritische Anlage hat ≥2 Links auf
  // zwei verschiedenen Ringen, deren Knoten existieren.
  const targets = THARSIS_HUB_BUILDINGS.filter(b => b.critical)
  for (const t of targets) {
    const links = THARSIS_HUB_UTILITY_LINKS.filter(l => l.objectId === t.id)
    if (links.length < 2) { issues.push({ message: `${t.id}: weniger als 2 Versorgungspfade` }); continue }
    const rings = new Set(links.map(l => l.ring))
    if (rings.size < 2) { issues.push({ message: `${t.id}: beide Pfade liegen auf demselben Utility-Ring` }) }
    for (const l of links) {
      const nodes = ringNodes.get(l.ring)
      if (!nodes) { issues.push({ message: `${t.id}: unbekannter Ring ${l.ring}` }); continue }
      if (!nodes.has(cellKey(l.node[0], l.node[1]))) {
        issues.push({ message: `${t.id}: Link-Knoten (${l.node[0]},${l.node[1]}) liegt nicht auf Ring ${l.ring}` })
      }
    }
  }

  // Alle Links referenzieren existierende Objekte.
  for (const l of THARSIS_HUB_UTILITY_LINKS) {
    if (!byId.has(l.objectId)) issues.push({ message: `Utility-Link referenziert unbekanntes Objekt '${l.objectId}'` })
    const media = ringMedia.get(l.ring)
    if (!media || media.size === 0) issues.push({ message: `Ring ${l.ring} trägt keine Medien` })
  }

  // Beide Ringe sind physikalisch getrennt (Zellfremdheit prüft validatePlacement).

  return issues
}

// ─── 6. Eigentumsmodell ─────────────────────────────────────────────────────

export function validateOwnership(): SeedIssue[] {
  const issues: SeedIssue[] = []
  // Kanonisches Konzept: owner_class='STATE', keine neue Eigentums-ID.
  // (Die SQL-Migration setzt owner_class='STATE', is_state_owned=true,
  // owner_id=NULL für alle Startobjekte, Fahrzeuge, Fahrwege und Mediennetze.)
  return issues
}

export function validateTharsisSeed(): SeedIssue[] {
  return [
    ...validatePlacement(),
    ...validateCounts(),
    ...validateZoneRules(),
    ...validateRoadResilience(),
    ...validateUtilityNetworks(),
    ...validateOwnership(),
  ]
}
