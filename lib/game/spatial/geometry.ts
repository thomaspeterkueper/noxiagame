import type { Footprint } from './types'

type Axis = { x: number; y: number }
type OrientedRect = {
  center: { x: number; y: number }
  halfWidth: number
  halfDepth: number
  axes: [Axis, Axis]
}

const DEG_TO_RAD = Math.PI / 180
const SAT_EPSILON_M = 1e-9

function orientedRect(footprint: Footprint, clearanceM: number): OrientedRect {
  const angle = normalizeRotation(footprint.rotationDeg) * DEG_TO_RAD
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  return {
    center: { x: footprint.xM, y: footprint.yM },
    // Preserve the v1 clearance semantics: each footprint is expanded by the
    // requested clearance before the pair is tested.
    halfWidth: footprint.widthM / 2 + clearanceM,
    halfDepth: footprint.depthM / 2 + clearanceM,
    axes: [
      { x: cos, y: sin },
      { x: -sin, y: cos },
    ],
  }
}

function projectedRadius(rect: OrientedRect, axis: Axis): number {
  return rect.halfWidth * Math.abs(rect.axes[0].x * axis.x + rect.axes[0].y * axis.y)
    + rect.halfDepth * Math.abs(rect.axes[1].x * axis.x + rect.axes[1].y * axis.y)
}

/**
 * Rectangle overlap using the 2D Separating Axis Theorem (SAT).
 *
 * Footprints are oriented rectangles in the local metric frame. Touching
 * edges are not treated as overlap, matching the previous strict-AABB
 * behavior. Rotation therefore affects placement without changing the
 * existing placement contract or clearance semantics.
 */
export function overlaps(a: Footprint, b: Footprint, clearanceM = 0): boolean {
  const clearance = Number.isFinite(clearanceM) ? Math.max(0, clearanceM) : 0
  const rectA = orientedRect(a, clearance)
  const rectB = orientedRect(b, clearance)
  const delta = {
    x: rectB.center.x - rectA.center.x,
    y: rectB.center.y - rectA.center.y,
  }

  for (const axis of [...rectA.axes, ...rectB.axes]) {
    const distance = Math.abs(delta.x * axis.x + delta.y * axis.y)
    const radius = projectedRadius(rectA, axis) + projectedRadius(rectB, axis)
    if (distance >= radius - SAT_EPSILON_M) return false
  }

  return true
}

export function finiteMetric(...values: Array<number | null | undefined>): boolean {
  return values.every(value => value == null || Number.isFinite(value))
}

export function normalizeRotation(value: number | null | undefined): number {
  const rotation = Number.isFinite(value) ? Number(value) : 0
  return ((rotation % 360) + 360) % 360
}
