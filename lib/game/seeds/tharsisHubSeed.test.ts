// lib/game/seeds/tharsisHubSeed.test.ts
// Erstellt: 30.08.2026
// Aktualisiert: 02.09.2026 — Safe Haven, ECLSS 2-von-3 und Bottom-up-Energie.
// Deterministische Akzeptanztests für den kanonischen Tharsis-Hub-Start-Seed
// (OTA-NOX-REQ-20260830-THARSIS-HUB-START-SEED, Abschnitt 9).
//
// Kein Framework — `npx tsx lib/game/seeds/tharsisHubSeed.test.ts`
// Prüft: exakte Objektzahlen, 497/504, Zonenregeln, N-1-Straßenpfade,
// alternativer Rettungszugang, mediumspezifische Utility-Redundanz,
// Safe-Haven-Evakuierung, ECLSS-2-von-3, Bottom-up-Energie und Eigentumsmodell.

import {
  THARSIS_HUB_POPULATION,
  THARSIS_HUB_HABITAT_CAPACITY,
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_VEHICLES,
  THARSIS_HUB_ROADS,
  THARSIS_VEHICLE_CLASSES,
  seedObjectCounts,
  seedVehicleCounts,
} from './tharsisHubSeed'
import {
  validatePlacement,
  validateCounts,
  validateZoneRules,
  validateRoadResilience,
  validateUtilityNetworks,
  validateOwnership,
} from './tharsisHubValidation'
import { validateTharsisUtilityIntegrity } from './tharsisHubUtilityNetwork'
import {
  THARSIS_ECLSS_REGIONAL_NODES,
  THARSIS_REQUIRED_EVACUATION_CAPACITY,
  THARSIS_SAFE_HAVEN_NODES,
  availableEvacuationCapacity,
  degradedEclssCapacity,
  validateTharsisLifeSupportResilience,
} from './tharsisHubResilience'
import {
  calculateTharsisPower,
  availablePowerAfterDomainFailure,
  validateTharsisPowerModel,
} from './tharsisHubPowerModel'

let fails = 0
function pruefe(ok: boolean, was: string): void {
  if (!ok) {
    fails++
    console.log(`\n✘ FAIL: ${was}`)
  }
}

function reportIssues(title: string, issues: Array<{ message: string }>): void {
  if (issues.length === 0) {
    console.log(`✓ ${title}`)
    return
  }
  console.log(`\n✘ ${title} — ${issues.length} Verletzung(en):`)
  for (const i of issues) console.log(`  - ${i.message}`)
  fails += issues.length
}

console.log('── Tharsis Hub Start-Seed — Akzeptanztests ──────────────────────────')
console.log(`Bewohner: ${THARSIS_HUB_POPULATION} · Habitatplätze: ${THARSIS_HUB_HABITAT_CAPACITY}`)

// ── Akzeptanzkriterien Abschnitt 9 ─────────────────────────────────────────

reportIssues('Kollisionen / Bounds / getrennte Netze', validatePlacement())
reportIssues('Exakte Stückzahlen (Abschnitt 1 + 2)', validateCounts())
reportIssues('Zonen- und Abhängigkeitsregeln (Abschnitt 1/5)', validateZoneRules())
reportIssues('Straßennetz: N-1 + Rettungszugänge (Abschnitt 3)', validateRoadResilience())
reportIssues('Utility A/B: bestehende Seed-Anbindung (Abschnitt 4)', validateUtilityNetworks())
reportIssues('Utility V2: Graph + Medienredundanz + physische Feeder', validateTharsisUtilityIntegrity())
reportIssues('Safe Haven + ECLSS 2-von-3', validateTharsisLifeSupportResilience())
reportIssues('Bottom-up-Energie + Lastabwurf', validateTharsisPowerModel())
reportIssues('Eigentumsmodell (Abschnitt 6)', validateOwnership())

// ── Direkte Akzeptanzprüfungen ─────────────────────────────────────────────

pruefe(THARSIS_HUB_POPULATION === 497, 'genau 497 Startbewohner')
pruefe(THARSIS_HUB_HABITAT_CAPACITY >= 504, 'mindestens 504 Habitatplätze')

const clusters = THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'habitat_cluster')
pruefe(clusters.length === 6, 'sechs Habitatcluster')
pruefe(clusters.every(c => c.critical), 'alle Habitatcluster kritisch')

const habitatShelters = THARSIS_SAFE_HAVEN_NODES.filter(node => node.kind === 'habitat_cluster')
pruefe(habitatShelters.length === 6, 'jeder Habitatcluster besitzt lokale Safe-Haven-Funktion')
for (const cluster of habitatShelters) {
  pruefe(
    availableEvacuationCapacity(cluster.id) >= THARSIS_REQUIRED_EVACUATION_CAPACITY,
    `${cluster.id}: nach Komplettausfall mindestens 84 externe Evakuierungsplätze`,
  )
}
pruefe(
  THARSIS_HUB_HABITAT_CAPACITY === 504,
  'Evakuierungsreserve verändert die permanente Habitatkapazität 504 nicht',
)

const counts = seedObjectCounts()
pruefe(counts['reactor_module'] === 6, 'sechs Reaktormodule')
pruefe(counts['black_start'] === 3, 'drei Black-Start-Knoten')
const domains = new Set(THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'reactor_module').map(b => b.zone))
pruefe(domains.size === 3 && !domains.has('A') && !domains.has('B'), 'drei Energie-Domänen außerhalb des Druckkerns')

pruefe(counts['water_isru'] === 3, 'drei Wasser-ISRU-Komplexe')
pruefe(new Set(THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'water_isru').map(b => b.strandId)).size === 3, 'drei unabhängige Prozessstränge')
pruefe(counts['eclss_hub'] === 3, 'drei regionale ECLSS-Hubs')
pruefe(counts['radiator_field'] === 5, 'fünf Radiatorfelder')

for (const node of THARSIS_ECLSS_REGIONAL_NODES) {
  pruefe(node.criticalDemandShare >= 0.55 && node.criticalDemandShare <= 0.60, `${node.id}: 55–60 % kritische Auslegung`)
  pruefe(degradedEclssCapacity(node.id) >= 1, `${node.id}: Einzel-Ausfall lässt >=100 % kritische Restkapazität`)
}

const normalPower = calculateTharsisPower('normal')
const peakPower = calculateTharsisPower('peak')
pruefe(normalPower.classA >= 1.5 && normalPower.classA <= 2.5, 'kritische Dauerlast innerhalb 1,5–2,5 MW')
pruefe(normalPower.total >= 3 && normalPower.total <= 5, 'Normallast innerhalb 3–5 MW')
pruefe(peakPower.total >= 5 && peakPower.total <= 8, 'Spitzenlast innerhalb 5–8 MW')
for (const complexId of ['energy_complex_1', 'energy_complex_2', 'energy_complex_3']) {
  pruefe(
    availablePowerAfterDomainFailure(complexId) >= normalPower.classA,
    `${complexId}: N-1 hält Klasse A`,
  )
}

pruefe(counts['medical_core'] === 1 && counts['medical_annex'] === 1, 'Medical Core + Emergency Annex vorhanden')
const annex = THARSIS_HUB_BUILDINGS.find(b => b.entityId === 'medical_annex')
const core = THARSIS_HUB_BUILDINGS.find(b => b.entityId === 'medical_core')
pruefe(!!annex && !!core && annex.clusterRef !== core!.clusterRef, 'Annex in anderem Habitatcluster als Medical Core')

const depots = THARSIS_HUB_BUILDINGS.filter(b => b.entityId === 'reserve_depot')
const foodT = depots.reduce((s, d) => s + (d.foodReserveT ?? 0), 0)
pruefe(depots.length === 3 && foodT >= 27, 'drei Reserve-Depots mit ≥27 t Nahrungsreserve')
pruefe(depots.every(d => (d.foodReserveT ?? 0) <= foodT / 2), 'kein Depot hält mehr als die Hälfte der lebenswichtigen Reserve')

pruefe(counts['plant_module'] === 1, 'ein staatliches Pflanzen-/Frischproduktionsmodul im Startbestand')
const plantModule = THARSIS_HUB_BUILDINGS.find(b => b.entityId === 'plant_module')
pruefe(!!plantModule && !plantModule.critical, 'Pflanzenmodul ist nicht survival-critical')

pruefe(counts['workshop_clean'] === 1 && counts['workshop_heavy'] === 1, 'zwei Werkstattzellen (sauber + schwer)')
pruefe(counts['material_complex'] === 2, 'zwei Material-/Reststoff-Komplexe')

pruefe(counts['command_node'] === 2, 'zwei Command-&-Control-Knoten')
pruefe(counts['surface_relay'] === 3, 'drei Oberflächen-Relays')
pruefe(counts['longrange_comms'] === 2, 'zwei Langstrecken-Kommunikationsstationen')

const vCounts = seedVehicleCounts()
for (const cls of Object.values(THARSIS_VEHICLE_CLASSES)) {
  pruefe(vCounts[cls.id] === cls.count, `Flotte ${cls.id}: ${vCounts[cls.id]} statt ${cls.count}`)
}

const kinds = new Set(THARSIS_HUB_ROADS.map(r => r.kind))
pruefe(kinds.has('ring'), 'innerer Service-Ring vorhanden')
pruefe(kinds.has('energy') && kinds.has('water') && kinds.has('freight'), 'drei Hauptkorridore (Energie/Wasser/Fracht) vorhanden')
const allowedRoadKinds: string[] = ['ring', 'energy', 'water', 'freight', 'spur']
pruefe(THARSIS_HUB_ROADS.every(r => allowedRoadKinds.includes(r.kind)), 'keine Schiene / keine unbekannten Fahrweg-Typen im Startzustand')

const allSeeded = [...THARSIS_HUB_BUILDINGS, ...THARSIS_HUB_VEHICLES]
pruefe(allSeeded.length > 0, 'Seed enthält Startobjekte')

console.log('')
if (fails > 0) {
  console.log(`✘ ${fails} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
} else {
  console.log('✓ Alle Tharsis-Hub-Seed-Prüfungen bestanden.')
  console.log(`  ${THARSIS_HUB_BUILDINGS.length} Gebäude · ${THARSIS_HUB_VEHICLES.length} Fahrzeuge · ${THARSIS_HUB_ROADS.length} Fahrweg-Tiles`)
}
