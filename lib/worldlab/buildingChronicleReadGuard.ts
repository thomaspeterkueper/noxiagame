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


/**
 * Fetch one extra row to detect a truncated history before projection.
 * A capped response is not an authoritative complete chronicle. Until
 * cursor-based pagination is integrated, reject it instead of rendering
 * an incomplete history as if it were complete.
 */
export function requireCompleteChroniclePage<T>(
  result: { data: T[] | null; error: unknown },
  source: string,
  limit: number,
): T[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('Building chronicle Core read invalid: page limit')
  }
  const rows = requireChronicleRows(result, source)
  if (rows.length > limit) {
    throw new Error(`Building chronicle Core read incomplete: ${source} exceeds page limit`)
  }
  return rows
}

/** Supabase timestamptz receipts must carry a complete, parseable ISO instant. */
function isChronicleInstant(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
}

/**
 * A malformed persisted receipt must not vanish silently in buildChronicle.
 * The eventstore query already filters event types, but the returned payload
 * still needs a minimal runtime shape check before historical projection.
 */
export function requireChronicleEventRows<T>(
  result: { data: T[] | null; error: unknown },
  source: string,
  limit: number,
): T[] {
  const rows = requireCompleteChroniclePage(result, source, limit)
  const allowed = new Set(['entity.created', 'entity.updated', 'entity.deleted'])
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Building chronicle Core read invalid: ${source} event receipt`)
    }
    const receipt = row as Record<string, unknown>
    if (
      !['id', 'subject_id'].every(
        key => typeof receipt[key] === 'string' && Boolean((receipt[key] as string).trim()),
      ) ||
      !isChronicleInstant(receipt.occurred_at) ||
      typeof receipt.event_type !== 'string' ||
      !allowed.has(receipt.event_type)
    ) {
      throw new Error(`Building chronicle Core read invalid: ${source} event receipt`)
    }
  }
  return rows
}

/**
 * Tombstones are authoritative demolition evidence. Malformed rows must
 * fail closed instead of creating phantom or undated demolition entries.
 */
export function requireChronicleTombstoneRows<T>(
  result: { data: T[] | null; error: unknown },
  source: string,
  limit: number,
): T[] {
  const rows = requireCompleteChroniclePage(result, source, limit)
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Building chronicle Core read invalid: ${source} tombstone`)
    }
    const stone = row as Record<string, unknown>
    if (
      typeof stone.source_ref !== 'string' || !stone.source_ref.trim() ||
      !isChronicleInstant(stone.cleared_at) ||
      !(stone.profile_id === null || (typeof stone.profile_id === 'string' && Boolean(stone.profile_id.trim()))) ||
      !(stone.display_name === undefined || stone.display_name === null || typeof stone.display_name === 'string')
    ) {
      throw new Error(`Building chronicle Core read invalid: ${source} tombstone`)
    }
  }
  return rows
}
