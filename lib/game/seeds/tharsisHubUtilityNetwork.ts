// lib/game/seeds/tharsisHubUtilityNetwork.ts
// Erstellt: 31.08.2026
//
// Integritätsprojektion für die Tharsis-Hub-Mediennetze.
//
// Hintergrund:
// Die ursprünglichen Utility-Ringe A/B in tharsisHubSeed.ts enthalten räumliche
// Ankerpunkte, aber keine expliziten Kanten. Dadurch konnte ein formal vorhandener
// Ring trotz geometrischer Lücken als „redundant“ gelten. Diese Projektion macht
// aus den Ankerpunkten echte Graphen und aus den bisherigen logischen Links
// physische Feeder mit eigener Länge und Medienbelegung.
//
// WICHTIG: Das 32×24-Spielgrid ist zu grob, um die exakte unterirdische bzw.
// geschützte Trassenführung jedes Kabels/Rohres als Tilefolge abzubilden.
// Deshalb sind Ringkanten physische dedizierte Leitungssegmente zwischen
// Ankerpunkten. Straßen werden dadurch NICHT automatisch zu Medienkorridoren.

import {
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_UTILITY_LINKS,
  THARSIS_HUB_UTILITY_RINGS,
  UTILITY_MEDIA,
  type UtilityMedia,
  type UtilityRingId,
} from './tharsisHubSeed'

export type UtilityPoint = readonly [number, number]

export interface TharsisUtilityEdge {
  ring: UtilityRingId
  from: UtilityPoint
  to: UtilityPoint
  media: UtilityMedia[]
  lengthTiles: number
  routingClass: 'dedicated'
}

export interface TharsisUtilityFeeder {
  objectId: string
  ring: UtilityRingId
  object: UtilityPoint
  node: UtilityPoint
  media: UtilityMedia[]
  lengthTiles: number
  routingClass: 'dedicated'
}

/**
 * V2-Regel: Beide physisch getrennten Backbones tragen alle für Tharsis
 * modellierten Medien. Das erzeugt keine zusätzlichen Straßen oder Gebäude;
 * es verhindert lediglich, dass „zwei Ringe“ fälschlich als Redundanz gelten,
 * obwohl ein Medium nur auf einem Ring vorhanden ist.
 */
export const THARSIS_REDUNDANT_UTILITY_MEDIA: UtilityMedia[] = [...UTILITY_MEDIA]

export const THARSIS_EFFECTIVE_RING_MEDIA: Record<UtilityRingId, UtilityMedia[]> = {
  A: [...THARSIS_REDUNDANT_UTILITY_MEDIA],
  B: [...THARSIS_REDUNDANT_UTILITY_MEDIA],
}

function pointKey([row, col]: UtilityPoint): string {
  return `${row}:${col}`
}

function manhattan(a: UtilityPoint, b: UtilityPoint): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

function sortedUniqueNodes(ring: UtilityRingId): UtilityPoint[] {
  const source = THARSIS_HUB_UTILITY_RINGS.find(r => r.ring === ring)?.nodes ?? []
  const unique = new Map<string, UtilityPoint>()
  for (const node of source) unique.set(pointKey(node), [node[0], node[1]] as const)
  return [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

/**
 * Deterministischer, zusammenhängender Baum über alle Backbone-Anker eines Rings.
 * Jeder neue Anker wird mit dem nächsten bereits eingebundenen Anker verbunden.
 * Damit ist die Netzkonnektivität explizit und testbar; diagonale/weite Anker
 * sind nicht länger implizit „verbunden“.
 */
function buildConnectedBackbone(ring: UtilityRingId): TharsisUtilityEdge[] {
  const nodes = sortedUniqueNodes(ring)
  const edges: TharsisUtilityEdge[] = []

  for (let index = 1; index < nodes.length; index++) {
    const child = nodes[index]
    let parent = nodes[0]
    let bestDistance = manhattan(child, parent)

    for (let candidateIndex = 1; candidateIndex < index; candidateIndex++) {
      const candidate = nodes[candidateIndex]
      const distance = manhattan(child, candidate)
      if (
        distance < bestDistance ||
        (distance === bestDistance && pointKey(candidate) < pointKey(parent))
      ) {
        parent = candidate
        bestDistance = distance
      }
    }

    edges.push({
      ring,
      from: parent,
      to: child,
      media: [...THARSIS_EFFECTIVE_RING_MEDIA[ring]],
      lengthTiles: bestDistance,
      routingClass: 'dedicated',
    })
  }

  return edges
}

export const THARSIS_HUB_UTILITY_EDGES: TharsisUtilityEdge[] = [
  ...buildConnectedBackbone('A'),
  ...buildConnectedBackbone('B'),
]

const buildingById = new Map(THARSIS_HUB_BUILDINGS.map(building => [building.id, building]))

/**
 * Physische Feeder-Projektion. Ein Feeder ist nicht nur „Objekt X hängt an Ring
 * A“, sondern ein eigenes Leitungssegment zwischen Objektkoordinate und
 * Backbone-Anker mit expliziter Länge und Medienbelegung.
 */
export const THARSIS_HUB_UTILITY_FEEDERS: TharsisUtilityFeeder[] =
  THARSIS_HUB_UTILITY_LINKS.flatMap(link => {
    const building = buildingById.get(link.objectId)
    if (!building) return []

    const object: UtilityPoint = [building.row, building.col]
    const node: UtilityPoint = [link.node[0], link.node[1]]

    return [{
      objectId: link.objectId,
      ring: link.ring,
      object,
      node,
      media: [...THARSIS_EFFECTIVE_RING_MEDIA[link.ring]],
      lengthTiles: manhattan(object, node),
      routingClass: 'dedicated' as const,
    }]
  })

export interface UtilityIntegrityIssue {
  message: string
}

function connectedNodesForMedium(
  ring: UtilityRingId,
  medium: UtilityMedia,
): Set<string> {
  const nodes = sortedUniqueNodes(ring)
  if (nodes.length === 0) return new Set()

  const adjacency = new Map<string, Set<string>>()
  for (const node of nodes) adjacency.set(pointKey(node), new Set())

  for (const edge of THARSIS_HUB_UTILITY_EDGES) {
    if (edge.ring !== ring || !edge.media.includes(medium)) continue
    const from = pointKey(edge.from)
    const to = pointKey(edge.to)
    adjacency.get(from)?.add(to)
    adjacency.get(to)?.add(from)
  }

  const start = pointKey(nodes[0])
  const seen = new Set<string>([start])
  const queue = [start]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }

  return seen
}

/**
 * Prüft die drei im Implementierungs-/Layout-Review gefundenen NOXIA-Fehler:
 * 1. echte Graph-Konnektivität je Ring,
 * 2. Redundanz je Medium statt nur je Ringname,
 * 3. explizite physische Feeder Objekt ↔ Backbone.
 */
export function validateTharsisUtilityIntegrity(): UtilityIntegrityIssue[] {
  const issues: UtilityIntegrityIssue[] = []

  for (const ring of ['A', 'B'] as const) {
    const nodes = sortedUniqueNodes(ring)
    const nodeKeys = new Set(nodes.map(pointKey))

    for (const medium of THARSIS_REDUNDANT_UTILITY_MEDIA) {
      const connected = connectedNodesForMedium(ring, medium)
      if (connected.size !== nodeKeys.size) {
        issues.push({
          message: `Utility Ring ${ring}: Medium '${medium}' verbindet ${connected.size}/${nodeKeys.size} Backbone-Anker`,
        })
      }
    }

    for (const edge of THARSIS_HUB_UTILITY_EDGES.filter(e => e.ring === ring)) {
      if (edge.lengthTiles <= 0) {
        issues.push({ message: `Utility Ring ${ring}: Null-/Negativsegment ${pointKey(edge.from)} → ${pointKey(edge.to)}` })
      }
      if (!nodeKeys.has(pointKey(edge.from)) || !nodeKeys.has(pointKey(edge.to))) {
        issues.push({ message: `Utility Ring ${ring}: Kante referenziert unbekannten Backbone-Anker` })
      }
      for (const medium of THARSIS_REDUNDANT_UTILITY_MEDIA) {
        if (!edge.media.includes(medium)) {
          issues.push({ message: `Utility Ring ${ring}: Segment ${pointKey(edge.from)} → ${pointKey(edge.to)} führt '${medium}' nicht` })
        }
      }
    }
  }

  const criticalBuildings = THARSIS_HUB_BUILDINGS.filter(building => building.critical)
  for (const building of criticalBuildings) {
    const feeders = THARSIS_HUB_UTILITY_FEEDERS.filter(feeder => feeder.objectId === building.id)
    const byRing = new Map(feeders.map(feeder => [feeder.ring, feeder]))

    for (const ring of ['A', 'B'] as const) {
      const feeder = byRing.get(ring)
      if (!feeder) {
        issues.push({ message: `${building.id}: kein physischer Feeder zu Utility Ring ${ring}` })
        continue
      }

      const ringNodes = new Set(sortedUniqueNodes(ring).map(pointKey))
      if (!ringNodes.has(pointKey(feeder.node))) {
        issues.push({ message: `${building.id}: Feeder ${ring} endet nicht auf einem Backbone-Anker` })
      }
      if (feeder.object[0] !== building.row || feeder.object[1] !== building.col) {
        issues.push({ message: `${building.id}: Feeder ${ring} startet nicht an der Objektkoordinate` })
      }
      if (feeder.lengthTiles <= 0) {
        issues.push({ message: `${building.id}: Feeder ${ring} besitzt keine physische Leitungslänge` })
      }
      for (const medium of THARSIS_REDUNDANT_UTILITY_MEDIA) {
        if (!feeder.media.includes(medium)) {
          issues.push({ message: `${building.id}: Feeder ${ring} führt redundantes Medium '${medium}' nicht` })
        }
      }
    }
  }

  return issues
}
