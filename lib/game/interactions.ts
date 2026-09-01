export type InteractionKind = 'building' | 'person' | 'vehicle'

export interface WorldPoint {
  col: number
  row: number
}

export interface Interactable extends WorldPoint {
  kind: InteractionKind
  id: string
  label: string
  action: string
  range: number
}

export interface NearbyInteraction extends Interactable {
  distance: number
}

export function worldDistance(a: WorldPoint, b: WorldPoint) {
  return Math.hypot(a.col - b.col, a.row - b.row)
}

export function nearestInteraction(origin: WorldPoint, interactables: Interactable[]): NearbyInteraction | null {
  let nearest: NearbyInteraction | null = null

  for (const interactable of interactables) {
    const distance = worldDistance(origin, interactable)
    if (distance > interactable.range) continue
    if (!nearest || distance < nearest.distance) nearest = { ...interactable, distance }
  }

  return nearest
}
