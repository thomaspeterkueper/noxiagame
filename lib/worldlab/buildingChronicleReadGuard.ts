/** Fail closed when a Core read fails; a failed read is never an empty history. */
export function requireChronicleOptional<T>(
  result: { data: T | null; error: unknown }, source: string,
): T | null {
  if (!result || result.error !== null) {
    throw new Error(`Building chronicle Core read failed: ${source}`)
  }
  return result.data
}

/** Collection reads must contain an actual array, not null or missing data. */
export function requireChronicleRows<T>(
  result: { data: T[] | null; error: unknown }, source: string,
): T[] {
  const data = requireChronicleOptional(result, source)
  if (!Array.isArray(data)) {
    throw new Error(`Building chronicle Core read incomplete: ${source}`)
  }
  return data
}

/** Never query all worlds if the canonical Earth location cannot be resolved. */
export function requireEarthLocationId(earth: { id: string } | null): string {
  if (!earth || typeof earth.id !== 'string' || !earth.id.trim()) {
    throw new Error('Building chronicle Core read incomplete: locations.earth')
  }
  return earth.id
}

/** Unknown source refs may have tombstones, but must not query every Earth event. */
export function shouldReadChronicleEvents(sourceRef: string | null | undefined, entityId: string | null): boolean {
  return !sourceRef || Boolean(entityId)
}
