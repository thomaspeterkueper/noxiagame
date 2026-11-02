/** Fail closed when a Core read fails; a failed read is never an empty history. */
export function requireChronicleOptional<T>(
  result: { data: T | null; error: unknown }, source: string,
): T | null {
  if (!result || result.error !== null || result.data === undefined) {
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

/**
 * The public reader accepts one building selector at a time. Combining an
 * unrelated entity UUID with an OSM source reference would otherwise splice
 * one building's events together with another parcel's demolition tombstone.
 */
export function requireUnambiguousChronicleSelector(
  entityId: string | null | undefined,
  sourceRef: string | null | undefined,
): void {
  // An explicitly supplied blank selector is not the same as omitting it:
  // otherwise an empty entityId silently becomes a settlement-wide scan.
  if ((entityId !== null && entityId !== undefined && !entityId.trim()) ||
      (sourceRef !== null && sourceRef !== undefined && !sourceRef.trim())) {
    throw new Error('Building chronicle Core read invalid: blank building selector')
  }
  if (entityId && sourceRef) {
    throw new Error('Building chronicle Core read ambiguous: building selectors')
  }
}
