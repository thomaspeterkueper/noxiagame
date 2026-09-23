const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

type NamespaceTarget = {
  namespaceURI?: string | null
  closest?: (selector: string) => unknown
}

/**
 * Records whether pointer-down originated on the SVG before the map container
 * captures that pointer. The later click may be retargeted to the container.
 */
export function isEarthMapSurfaceTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object' || !('namespaceURI' in target)) return false
  const candidate = target as NamespaceTarget
  if (candidate.namespaceURI !== SVG_NAMESPACE) return false
  return typeof candidate.closest !== 'function' || !candidate.closest('[role="button"]')
}

export function shouldChooseEarthMapSpot(startedOnSurface: boolean, dragged: boolean): boolean {
  return startedOnSurface && !dragged
}
