/**
 * Earth cadastral records are an INITIAL geographic snapshot, not an authority
 * over subsequent NOXIA land ownership, geometry, use or development.
 *
 * PostgREST's ignoreDuplicates translates to ON CONFLICT (id) DO NOTHING.
 * A later provider refresh may add new parcel IDs but must never overwrite
 * an existing earth_parcels row (including its simulation-owned fields).
 */
export const PARCEL_INITIAL_IMPORT_UPSERT = Object.freeze({
  onConflict: 'id',
  ignoreDuplicates: true,
} as const)
