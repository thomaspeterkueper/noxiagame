import type { Footprint } from './types'

/**
 * Conservative axis-aligned bounds for placement validation.
 * Rotation is intentionally ignored in v1, so we never permit overlap that
 * would only be safe because of a rotated rectangle. This can later be
 * replaced with SAT/OBB collision without changing the placement contract.
 */
export function overlaps(a: Footprint, b: Footprint, clearanceM = 0): boolean {
  const ax = a.widthM / 2 + clearanceM
  const ay = a.depthM / 2 + clearanceM
  const bx = b.widthM / 2 + clearanceM
  const by = b.depthM / 2 + clearanceM

  return Math.abs(a.xM - b.xM) < ax + bx && Math.abs(a.yM - b.yM) < ay + by
}

export function finiteMetric(...values: Array<number | null | undefined>): boolean {
  return values.every(value => value == null || Number.isFinite(value))
}

export function normalizeRotation(value: number | null | undefined): number {
  const rotation = Number.isFinite(value) ? Number(value) : 0
  return ((rotation % 360) + 360) % 360
}
