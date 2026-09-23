const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

type NamespaceTarget = {
  namespaceURI?: string | null
}

/**
 * The map container owns pointer capture for panning. Therefore the final click
 * can target the container instead of the nested SVG. Only clicks originating
 * from the SVG surface may create a building placement; HTML controls layered
 * over the map must stay inert.
 */
export function isEarthMapSurfaceTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object' || !('namespaceURI' in target)) return false
  return (target as NamespaceTarget).namespaceURI === SVG_NAMESPACE
}
