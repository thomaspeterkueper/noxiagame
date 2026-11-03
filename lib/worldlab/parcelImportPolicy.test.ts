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
  it('rejects missing or nonnumeric POST coordinates before opening the import', () => {
    const source = readFileSync(
      new URL('../../app/api/world-lab/parcels/route.ts', import.meta.url),
      'utf8',
    )
    expect(source).toContain("typeof body.lat !== 'number' || typeof body.lon !== 'number'")
    expect(source).toContain("const point = { lat: body.lat, lon: body.lon }")
    expect(source).toContain('!Number.isFinite(point.lat) || !Number.isFinite(point.lon)')
    expect(source.indexOf("typeof body.lat !== 'number'")).toBeLessThan(source.indexOf('createServiceClient()'))
  })

  it('fails closed when parcel-cell cache reads or success writes fail', () => {
    const source = readFileSync(
      new URL('../../app/api/world-lab/parcels/route.ts', import.meta.url),
      'utf8',
    )
    // Cached failures must not be presented as HTTP success to callers.
    expect(source).toContain('{ status: known.error ? 503 : 200 }')
    expect(source).toContain('if (cacheReadError)')
    expect(source).toContain("status: 503")
    expect(source).toContain('if (cacheWriteError) throw cacheWriteError')
    expect(source.indexOf('if (cacheWriteError) throw cacheWriteError')).toBeLessThan(source.indexOf('return NextResponse.json({ ok: true, cached: false'))
    expect(source).toContain('if (cacheFailureWriteError) console.error(')
    expect(source).toContain("error: 'Katasterimport fehlgeschlagen.' }, { status: 503 }")
    expect(source).toContain('catch (cacheFailureWriteError)')
  })

})
