// lib/game/seeds/tharsisHubUtilityNetwork.ts
// Erstellt: 31.08.2026
// Aktualisiert: 01.09.2026 — Review-Korrektur: keine vorweggenommene Vollredundanz
//
// Integritätsprojektion für die Tharsis-Hub-Mediennetze.
//
// Die Seed-Datei enthält räumliche Backbone-Anker und Objekt-Anbindungen. Diese
// Projektion macht daraus explizite physische Graphkanten und Feeder. Sie ändert
// NICHT die fachliche Medienbelegung des kanonischen Seeds.
//
// WICHTIG: Das 32×24-Spielgrid ist zu grob, um jede unterirdische/geschützte
// Trasse als Tilefolge abzubilden. Utility-Kanten sind deshalb dedizierte
// Leitungssegmente zwischen Ankerpunkten. Straßen bleiben ein separates System.

import {
  THARSIS_HUB_BUILDINGS,
  THARSIS_HUB_UTILITY_LINKS,
  THARSIS_HUB_UTILITY_RINGS,
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

export const THARSIS_PROVISIONAL_DUAL_PATH_MEDIA: UtilityMedia[] = [
  'power', 'data', 'water', 'o2',
]

function pointKey([row, col]: UtilityPoint): string {
  return `${row}:${col}`
}

function manhattan(a: UtilityPoint, b: UtilityPoint): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

function ringDefinition(ring: UtilityRingId) {
  return THARSIS_HUB_UTILITY_RINGS.find(item => item.ring === ring)
}

function sortedUniqueNodes(ring: UtilityRingId): UtilityPoint[] {
  const source = ringDefinition(ring)?.nodes ?? []
  const unique = new Map<string, UtilityPoint>()
  for (const node of source) unique.set(pointKey(node), [node[0], node[1]] as const)
  return [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

function mediaForRing(ring: UtilityRingId): UtilityMedia[] {
  return [...(ringDefinition(ring)?.media ?? [])]
}

function buildConnectedBackbone(ring: UtilityRingId): TharsisUtilityEdge[] {
  const nodes = sortedUniqueNodes(ring)
  const edges: TharsisUtilityEdge[] = []
  const media = mediaForRing(ring)

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
      media: [...media],
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
      media: mediaForRing(link.ring),
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

export function validateTharsisUtilityIntegrity(): UtilityIntegrityIssue[] {
  const issues: UtilityIntegrityIssue[] = []

  for (const ring of ['A', 'B'] as const) {
    const nodes = sortedUniqueNodes(ring)
    const nodeKeys = new Set(nodes.map(pointKey))
    const declaredMedia = mediaForRing(ring)

    for (const medium of declaredMedia) {
      const connected = connectedNodesForMedium(ring, medium)
      if (connected.size !== nodeKeys.size) {
        issues.push({
          message: `Utility Backbone ${ring}: Medium '${medium}' verbindet ${connected.size}/${nodeKeys.size} Anker`,
        })
      }
    }

    for (const edge of THARSIS_HUB_UTILITY_EDGES.filter(item => item.ring === ring)) {
      if (edge.lengthTiles <= 0) {
        issues.push({ message: `Utility Backbone ${ring}: Null-/Negativsegment ${pointKey(edge.from)} → ${pointKey(edge.to)}` })
      }
      if (!nodeKeys.has(pointKey(edge.from)) || !nodeKeys.has(pointKey(edge.to))) {
        issues.push({ message: `Utility Backbone ${ring}: Kante referenziert unbekannten Anker` })
      }
      for (const medium of declaredMedia) {
        if (!edge.media.includes(medium)) {
          issues.push({ message: `Utility Backbone ${ring}: Segment ${pointKey(edge.from)} → ${pointKey(edge.to)} führt '${medium}' nicht` })
        }
      }
    }
  }

  for (const medium of THARSIS_PROVISIONAL_DUAL_PATH_MEDIA) {
    for (const ring of ['A', 'B'] as const) {
      if (!mediaForRing(ring).includes(medium)) {
        issues.push({ message: `Medium '${medium}' fehlt auf dem bereits doppelt vorgesehenen Backbone ${ring}` })
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
        issues.push({ message: `${building.id}: kein physischer Feeder zu Utility Backbone ${ring}` })
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
      for (const medium of THARSIS_PROVISIONAL_DUAL_PATH_MEDIA) {
        if (!feeder.media.includes(medium)) {
          issues.push({ message: `${building.id}: Feeder ${ring} führt doppelt vorgesehenes Medium '${medium}' nicht` })
        }
      }
    }
  }

  return issues
}
