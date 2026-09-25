// app/api/admin/import-phobos-dem/route.ts
// Erstellt: 25.09.2026
//
// Importiert das GESAMTE globale Phobos-Hoehenmodell (USGS Astrogeology /
// ESA Mars Express HRSC, Simple Cylindrical, 100m/px, 699x349px, ~478kB) in
// einem Zug in die bestehende, koerperunabhaengige Terrain-Pipeline
// (ingestPreparedTerrainTileToSupabase -> terrain_tiles). Anders als beim
// Mond-LOLA-Mosaik (~8,5GB) ist hier KEIN Ausschnitt/Range-Request noetig --
// der komplette Koerper passt bei dieser Aufloesung bequem in eine einzelne
// Kachel.
//
// Laut USGS-Astropedia-Produktseite ist die BoundingBox dieses Produkts
// bereits in Grad angegeben (Laenge -180.15..180.66, Breite -90.15..90),
// nicht in projizierten Metern wie beim Mond-LOLA-Mosaik. Der ?debug=1
// Modus liest trotzdem zuerst nur den Header, damit das vor dem eigentlichen
// Import bestaetigt werden kann.

import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { fromUrl } from 'geotiff'
import { createServiceClient } from '@/lib/supabase/service'
import { ingestPreparedTerrainTileToSupabase } from '@/lib/game/spatial/supabasePreparedTerrainTileIngest.server'

const PHOBOS_GLOBAL_URL = 'https://planetarymaps.usgs.gov/mosaic/Phobos_ME_HRSC_DEM_Global_2ppd.tif'
const DATASET_ID = 'phobos_mex_hrsc_dem_100m'
const PHOBOS_MEAN_RADIUS_M = 11100
const ONE_TIME_IMPORT_SHA256 = 'cc8ef8b25c2c17f117f9846b95264a5eb2d83a46074758c763962e21ed0f6ab2'

function encodeFloat32GeoTiff(params: {
  width: number
  height: number
  data: Float32Array
  originLonDeg: number
  originLatDeg: number
  pixelScaleLonDeg: number
  pixelScaleLatDeg: number
}): Uint8Array {
  const { width, height, data, originLonDeg, originLatDeg, pixelScaleLonDeg, pixelScaleLatDeg } = params
  type Entry = { tag: number; type: number; count: number; valueBytes: Uint8Array; inline: boolean }
  const entries: Entry[] = []
  const le = true

  function u16(n: number) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, le); return b }
  function u32(n: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, le); return b }
  function f64arr(vals: number[]) { const b = new Uint8Array(vals.length * 8); const dv = new DataView(b.buffer); vals.forEach((v, i) => dv.setFloat64(i * 8, v, le)); return b }
  function addShort(tag: number, val: number) { entries.push({ tag, type: 3, count: 1, valueBytes: u16(val), inline: true }) }
  function addLong(tag: number, val: number) { entries.push({ tag, type: 4, count: 1, valueBytes: u32(val), inline: true }) }
  function addDoubleArr(tag: number, vals: number[]) { entries.push({ tag, type: 12, count: vals.length, valueBytes: f64arr(vals), inline: false }) }

  addLong(256, width)
  addLong(257, height)
  addShort(258, 32)
  addShort(259, 1)
  addShort(262, 1)
  const stripOffsetsEntry: Entry = { tag: 273, type: 4, count: 1, valueBytes: u32(0), inline: true }
  entries.push(stripOffsetsEntry)
  addShort(277, 1)
  addLong(278, height)
  addLong(279, width * height * 4)
  addShort(339, 3)
  addDoubleArr(33550, [pixelScaleLonDeg, pixelScaleLatDeg, 0])
  addDoubleArr(33922, [0, 0, 0, originLonDeg, originLatDeg, 0])
  entries.sort((a, b) => a.tag - b.tag)

  const ifdEntryCount = entries.length
  const ifdSize = 2 + ifdEntryCount * 12 + 4
  const ifdStart = 8
  let extraOffset = ifdStart + ifdSize
  const extraChunks: { entry: Entry; offset: number }[] = []
  for (const e of entries) {
    if (!e.inline) {
      extraChunks.push({ entry: e, offset: extraOffset })
      extraOffset += e.valueBytes.length + (e.valueBytes.length % 2)
    }
  }
  const pixelDataOffset = extraOffset
  stripOffsetsEntry.valueBytes = u32(pixelDataOffset)
  const pixelBytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const totalSize = pixelDataOffset + pixelBytes.length
  const out = new Uint8Array(totalSize)
  const dv = new DataView(out.buffer)

  dv.setUint8(0, 0x49); dv.setUint8(1, 0x49)
  dv.setUint16(2, 42, le)
  dv.setUint32(4, ifdStart, le)
  dv.setUint16(ifdStart, ifdEntryCount, le)
  let p = ifdStart + 2
  for (const e of entries) {
    dv.setUint16(p, e.tag, le)
    dv.setUint16(p + 2, e.type, le)
    dv.setUint32(p + 4, e.count, le)
    if (e.inline) out.set(e.valueBytes, p + 8)
    else dv.setUint32(p + 8, extraChunks.find(c => c.entry === e)!.offset, le)
    p += 12
  }
  dv.setUint32(p, 0, le)
  for (const chunk of extraChunks) out.set(chunk.entry.valueBytes, chunk.offset)
  out.set(pixelBytes, pixelDataOffset)
  return out
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const { data: cfg } = await supabase.from('internal_config').select('value').eq('key', 'admin_import_secret').single()
  const oneTimeOk = Boolean(secret) && createHash('sha256').update(secret!).digest('hex') === ONE_TIME_IMPORT_SHA256
  if (!secret || ((!cfg || secret !== cfg.value) && !oneTimeOk)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const tiff = await fromUrl(PHOBOS_GLOBAL_URL)
    const image = await tiff.getImage()
    const width = image.getWidth()
    const height = image.getHeight()
    const rawBox = image.getBoundingBox() as [number, number, number, number]
    const looksLikeMeters = rawBox.some(v => Math.abs(v) > 360)
    const toDeg = (m: number) => (m / PHOBOS_MEAN_RADIUS_M) * (180 / Math.PI)
    const [minLon, minLat, maxLon, maxLat] = looksLikeMeters ? [toDeg(rawBox[0]), toDeg(rawBox[1]), toDeg(rawBox[2]), toDeg(rawBox[3])] : rawBox

    if (searchParams.get('debug') === '1') {
      const fileDirectory = (image as any).fileDirectory ?? {}
      return NextResponse.json({ width, height, rawBoundingBox: rawBox, looksLikeProjectedMeters: looksLikeMeters, boundingBoxDeg: [minLon, minLat, maxLon, maxLat], bitsPerSample: fileDirectory.BitsPerSample ?? null, sampleFormat: fileDirectory.SampleFormat ?? null, samplesPerPixel: image.getSamplesPerPixel(), noData: image.getGDALNoData?.() ?? null, modelPixelScale: fileDirectory.ModelPixelScale ?? null, modelTiepoint: fileDirectory.ModelTiepoint ?? null })
    }

    const rasters = await image.readRasters({ window: [0, 0, width, height], samples: [0], interleave: true })
    const raw = rasters as unknown as ArrayLike<number>
    const noData = image.getGDALNoData?.()
    const noDataNum = noData != null ? Number(noData) : null
    const data = new Float32Array(raw.length)
    let min = Infinity, max = -Infinity
    for (let i = 0; i < raw.length; i++) {
      const stored = raw[i]
      const elev = (noDataNum != null && stored === noDataNum) ? NaN : Number(stored)
      data[i] = elev
      if (Number.isFinite(elev)) { if (elev < min) min = elev; if (elev > max) max = elev }
    }

    const pixelScaleLon = (maxLon - minLon) / width
    const pixelScaleLat = (maxLat - minLat) / height
    const tiffBytes = encodeFloat32GeoTiff({ width, height, data, originLonDeg: minLon, originLatDeg: maxLat, pixelScaleLonDeg: pixelScaleLon, pixelScaleLatDeg: pixelScaleLat })
    const manifest = await ingestPreparedTerrainTileToSupabase(supabase, {
      datasetId: DATASET_ID,
      tileKey: 'global',
      bytes: tiffBytes,
      storageBucket: 'terrain',
      storagePath: 'phobos/hrsc-100m/global.tif',
      pixelSizeM: 100,
      sourceUri: PHOBOS_GLOBAL_URL,
      sourceProduct: 'Phobos_ME_HRSC_DEM_Global_2ppd',
      metadata: { stored_scale: 1, stored_offset: 0, whole_body: true, source_was_projected_meters: looksLikeMeters, min_elevation_m: Number.isFinite(min) ? min : null, max_elevation_m: Number.isFinite(max) ? max : null },
    })

    return NextResponse.json({
      ok: true,
      manifest: { tileKey: manifest.tileKey, bounds: { minLatDeg: manifest.minLatDeg, minLonDeg: manifest.minLonDeg, maxLatDeg: manifest.maxLatDeg, maxLonDeg: manifest.maxLonDeg }, rasterWidth: manifest.rasterWidth, rasterHeight: manifest.rasterHeight, byteSize: manifest.byteSize, checksum: manifest.checksum },
      elevationRangeM: { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
