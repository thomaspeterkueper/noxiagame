import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PARCEL_INITIAL_IMPORT_UPSERT } from './parcelImportPolicy'

describe('Earth parcel import is an initial snapshot, not world truth', () => {
  it('uses conflict-ignore rather than updating an existing parcel', () => {
    expect(PARCEL_INITIAL_IMPORT_UPSERT).toEqual({
      onConflict: 'id',
      ignoreDuplicates: true,
    })
    expect(Object.isFrozen(PARCEL_INITIAL_IMPORT_UPSERT)).toBe(true)
  })

  it('applies the guarded policy to the live cadastral import route', () => {
    const source = readFileSync(
      new URL('../../app/api/world-lab/parcels/route.ts', import.meta.url),
      'utf8',
    )
    expect(source).toContain("from '@/lib/worldlab/parcelImportPolicy'")
    expect(source).toMatch(/\.from\('earth_parcels'\)\.upsert\(rows\.slice\(i, i \+ 300\), PARCEL_INITIAL_IMPORT_UPSERT\)/)
    // A regression to default upsert semantics would overwrite simulated history.
    expect(source).not.toMatch(/\.from\('earth_parcels'\)\.upsert\(rows\.slice\(i, i \+ 300\), \{ onConflict: 'id' \}\)/)
  })
})
