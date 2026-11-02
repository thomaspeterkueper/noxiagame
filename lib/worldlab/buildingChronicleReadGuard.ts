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
  // TypeScript signatures do not validate JSON arriving at runtime. Non-string
  // selectors must fail before the query is constructed, not throw a TypeError.
  if ([entityId, sourceRef].some(value =>
    value !== null && value !== undefined &&
    (typeof value !== 'string' || !value.trim())
  )) {
    throw new Error('Building chronicle Core read invalid: blank or malformed building selector')
  }
  if (entityId && sourceRef) {
    throw new Error('Building chronicle Core read ambiguous: building selectors')
  }
}

/**
 * Bound read-only chronicle queries to a finite, deterministic row count.
 * Invalid runtime payloads must fail before reaching the service client.
 * This is a page-size guard, NOT a guarantee that the entire history was read.
 */
export function resolveChronicleReadLimit(value: unknown): number {
  if (value === undefined || value === null) return 200
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Building chronicle Core read invalid: limit')
  }
  return Math.min(Math.max(Math.floor(value), 1), 500)
}
