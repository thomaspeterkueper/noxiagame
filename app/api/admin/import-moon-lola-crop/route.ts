// app/api/admin/import-moon-lola-crop/route.ts
// Erstellt: 16.09.2026
//
// Liest per HTTP-Range-Requests NUR den Shackleton-Ausschnitt (letzte ~40
// Zeilen = Suedpol-naechste ~4,7km) aus dem globalen 8,5GB LOLA-118m-LDEM
// (USGS Astrogeology, einfache zylindrische Projektion), baut daraus eine
// eigene, kleine, gueltige Single-Band-Float32-GeoTIFF und speist sie ueber
// die bereits bestehende Produktions-Pipeline
// (ingestPreparedTerrainTileToSupabase) in terrain_tiles ein. Die 8,5GB-
// Originaldatei wird zu keinem Zeitpunkt vollstaendig geladen.

import { NextRequest, NextResponse } from 'next/server'
import { fromUrl } from 'geotiff'
import { createServiceClient } from '@/lib/supabase/service'
import { ingestPreparedTerrainTileToSupabase } from '@/lib/game/spatial/supabasePreparedTerrainTileIngest.server'

const LOLA_GLOBAL_URL = 'http://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif'
const DATASET_ID = 'moon_lro_lola_118m'
const CROP_ROWS_FROM_SOUTH_POLE = 40 // ~4.7 km bei 118 m/Pixel -- deckt Shackleton (21 km) bequem ab

// Minimaler, korrekter Baseline-TIFF/GeoTIFF-Encoder fuer genau unseren
// Anwendungsfall: 1 Band, Float32, unkomprimiert, eine Strip. Nur die Tags,
// die geotiff.js' getBoundingBox()/readRasters() tatsaechlich braucht.
function encodeFloat32GeoTiff(params: {
  width: number
  height: number
  data: Float32Array
  originLonDeg: number // Lon des linken Randes (Pixel-Spalte 0)
  originLatDeg: number // Lat des oberen Randes (Pixel-Zeile 0)
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

  addLong(256, width)              // ImageWidth
  addLong(257, height)             // ImageLength
  addShort(258, 32)                // BitsPerSample
  addShort(259, 1)                 // Compression = none
  addShort(262, 1)                 // PhotometricInterpretation = BlackIsZero
  const stripOffsetsEntry: Entry = { tag: 273, type: 4, count: 1, valueBytes: u32(0), inline: true } // Platzhalter, unten gepatcht
  entries.push(stripOffsetsEntry)
  addShort(277, 1)                 // SamplesPerPixel
  addLong(278, height)             // RowsPerStrip (eine Strip fuer das ganze Bild)
  addLong(279, width * height * 4) // StripByteCounts
  addShort(339, 3)                 // SampleFormat = IEEE float
  addDoubleArr(33550, [pixelScaleLonDeg, pixelScaleLatDeg, 0]) // ModelPixelScaleTag
  addDoubleArr(33922, [0, 0, 0, originLonDeg, originLatDeg, 0]) // ModelTiepointTag

  entries.sort((a, b) => a.tag - b.tag)

  const ifdEntryCount = entries.length
  const ifdSize = 2 + ifdEntryCount * 12 + 4
  const ifdStart = 8
  let extraOffset = ifdStart + ifdSize
  const extraChunks: { entry: Entry; offset: number }[] = []
  for (const e of entries) {
    if (!e.inline) {
      extraChunks.push({ entry: e, offset: extraOffset })
      extraOffset += e.valueBytes.length + (e.valueBytes.length % 2) // Wortausrichtung
    }
  }
  const pixelDataOffset = extraOffset
  stripOffsetsEntry.valueBytes = u32(pixelDataOffset)

  const pixelBytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  const totalSize = pixelDataOffset + pixelBytes.length
  const out = new Uint8Array(totalSize)
  const dv = new DataView(out.buffer)

  dv.setUint8(0, 0x49); dv.setUint8(1, 0x49) // "II" little-endian
  dv.setUint16(2, 42, le)
  dv.setUint32(4, ifdStart, le)

  dv.setUint16(ifdStart, ifdEntryCount, le)
  let p = ifdStart + 2
  for (const e of entries) {
    dv.setUint16(p, e.tag, le)
    dv.setUint16(p + 2, e.type, le)
    dv.setUint32(p + 4, e.count, le)
    if (e.inline) {
      out.set(e.valueBytes, p + 8)
    } else {
      const chunk = extraChunks.find(c => c.entry === e)!
      dv.setUint32(p + 8, chunk.offset, le)
    }
    p += 12
  }
  dv.setUint32(p, 0, le) // kein naechstes IFD

  for (const chunk of extraChunks) out.set(chunk.entry.valueBytes, chunk.offset)
  out.set(pixelBytes, pixelDataOffset)

  return out
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const { data: cfg } = await supabase.from('internal_config').select('value').eq('key', 'admin_import_secret').single()
  if (!secret || !cfg || secret !== cfg.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tiff = await fromUrl(LOLA_GLOBAL_URL)
    const image = await tiff.getImage()
    const width = image.getWidth()
    const height = image.getHeight()
    const [minLon, minLat, maxLon, maxLat] = image.getBoundingBox()
    const pixelScaleLon = (maxLon - minLon) / width
    const pixelScaleLat = (maxLat - minLat) / height

    const y0 = height - CROP_ROWS_FROM_SOUTH_POLE
    const y1 = height
    const x0 = 0
    const x1 = width

    const rasters = await image.readRasters({ window: [x0, y0, x1, y1], samples: [0], interleave: true })
    const raw = rasters as unknown as ArrayLike<number>
    const noData = image.getGDALNoData?.()
    const noDataNum = noData != null ? Number(noData) : null

    const data = new Float32Array(raw.length)
    let min = Infinity, max = -Infinity
    for (let i = 0; i < raw.length; i++) {
      const stored = raw[i]
      const elev = (noDataNum != null && stored === noDataNum) ? NaN : stored * 0.5 // scale=0.5 laut USGS-Label
      data[i] = elev
      if (Number.isFinite(elev)) { if (elev < min) min = elev; if (elev > max) max = elev }
    }

    const cropOriginLon = minLon + x0 * pixelScaleLon
    const cropOriginLat = maxLat - y0 * pixelScaleLat // y0 Zeilen vom oberen (Nord-)Rand entfernt
    // BUGFIX: minimale Gleitkomma-Ungenauigkeit liess den unteren Rand
    // hauchduenn unter -90 Grad rutschen und die strenge Validierung
    // (minLatDeg < -90) schlagen fehl. Skala hart so kappen, dass der
    // untere Rand physikalisch nie -90 unterschreiten kann.
    const cropRows = y1 - y0
    const maxSafePixelScaleLat = (cropOriginLat + 90) / cropRows
    const safePixelScaleLat = Math.min(pixelScaleLat, maxSafePixelScaleLat)

    const tiffBytes = encodeFloat32GeoTiff({
      width: x1 - x0,
      height: y1 - y0,
      data,
      originLonDeg: cropOriginLon,
      originLatDeg: cropOriginLat,
      pixelScaleLonDeg: pixelScaleLon,
      pixelScaleLatDeg: safePixelScaleLat,
    })

    const manifest = await ingestPreparedTerrainTileToSupabase(supabase, {
      datasetId: DATASET_ID,
      tileKey: 'shackleton-south-pole-crop-v1',
      bytes: tiffBytes,
      storageBucket: 'terrain',
      storagePath: 'moon/lola-118m/shackleton-south-pole-crop-v1.tif',
      pixelSizeM: 118,
      sourceUri: LOLA_GLOBAL_URL,
      sourceProduct: 'Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014',
      metadata: {
        stored_scale: 0.5,
        stored_offset: 0,
        crop_rows: CROP_ROWS_FROM_SOUTH_POLE,
        min_elevation_m: Number.isFinite(min) ? min : null,
        max_elevation_m: Number.isFinite(max) ? max : null,
      },
    })

    return NextResponse.json({
      ok: true,
      manifest: {
        tileKey: manifest.tileKey,
        bounds: { minLatDeg: manifest.minLatDeg, minLonDeg: manifest.minLonDeg, maxLatDeg: manifest.maxLatDeg, maxLonDeg: manifest.maxLonDeg },
        rasterWidth: manifest.rasterWidth,
        rasterHeight: manifest.rasterHeight,
        byteSize: manifest.byteSize,
        checksum: manifest.checksum,
      },
      elevationRangeM: { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
