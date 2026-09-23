const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

type NamespaceTarget = {
  namespaceURI?: string | null
}

/**
 * Records whether pointer-down originated on the SVG before the map container
 * captures that pointer. The later click may be retargeted to the container.
 */
export function isEarthMapSurfaceTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object' || !('namespaceURI' in target)) return false
  return (target as NamespaceTarget).namespaceURI === SVG_NAMESPACE
}

export function shouldChooseEarthMapSpot(startedOnSurface: boolean, dragged: boolean): boolean {
  return startedOnSurface && !dragged
}
