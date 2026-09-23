#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { fromArrayBuffer } from 'geotiff'

const DATASET_ID = 'moon_lro_lola_south_pole_5m'
const TILE_KEY = 'shackleton-site04-5m-v1'
const SOURCE_URL = 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif'
const BUCKET = 'terrain'
const STORAGE_PATH = 'moon/lro-lola/south-pole/site04/site04-final-adj-5mpp-surf.tif'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!rawUrl || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

function normalizeSupabaseUrl(value) {
  const trimmed = value.trim()
  const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  if (!parsed.hostname.endsWith('.supabase.co')) {
    throw new Error(`Unexpected Supabase host: ${parsed.hostname}`)
  }
  return parsed.origin
}

const url = normalizeSupabaseUrl(rawUrl)
const supabase = createClient(url, key)
console.log(`Supabase project host: ${new URL(url).hostname}`)

console.log(`Downloading ${SOURCE_URL}`)
const response = await fetch(SOURCE_URL, { redirect: 'follow' })
if (!response.ok) throw new Error(`NASA download failed: ${response.status} ${response.statusText}`)
const arrayBuffer = await response.arrayBuffer()
const bytes = new Uint8Array(arrayBuffer)
const checksum = createHash('sha256').update(bytes).digest('hex')

const tiff = await fromArrayBuffer(arrayBuffer.slice(0))
const image = await tiff.getImage()
const width = image.getWidth()
const height = image.getHeight()
const bbox = image.getBoundingBox()
const noDataRaw = image.getGDALNoData?.()
const noData = noDataRaw == null ? null : Number(noDataRaw)

console.log(`Site04 raster ${width}x${height}; projected bbox ${bbox.join(', ')}`)

await supabase.storage.from(BUCKET).remove([STORAGE_PATH]).catch(() => {})
const { error: uploadError } = await supabase.storage.from(BUCKET).upload(STORAGE_PATH, bytes, {
  contentType: 'image/tiff',
  upsert: true,
})
if (uploadError) throw new Error(`terrain upload failed: ${uploadError.message}`)

const metadata = {
  byte_size: bytes.byteLength,
  source_uri: SOURCE_URL,
  source_product_page: 'https://pgda.gsfc.nasa.gov/products/78',
  source_product: 'Site04_final_adj_5mpp_surf.tif',
  site: 'Site04',
  site_label: 'Shackleton rim',
  projection: 'south polar stereographic',
  projection_center_lon_deg: 0,
  projection_radius_m: 1737400,
  projection_x_sign: 1,
  projection_y_sign: 1,
  projected_bbox_m: bbox,
  stored_scale: 1,
  stored_offset: 0,
  ingest_contract: 'prepared-geotiff-v1',
  provenance: 'observed',
}

const { error: tileError } = await supabase.from('terrain_tiles').upsert({
  dataset_id: DATASET_ID,
  tile_key: TILE_KEY,
  min_lat: -90,
  min_lon: -180,
  max_lat: -88,
  max_lon: 180,
  raster_width: width,
  raster_height: height,
  pixel_size_m: 5,
  storage_bucket: BUCKET,
  storage_path: STORAGE_PATH,
  raster_format: 'geotiff',
  nodata_value: Number.isFinite(noData) ? noData : null,
  min_elevation_m: null,
  max_elevation_m: null,
  checksum,
  status: 'ready',
  metadata,
}, { onConflict: 'dataset_id,tile_key' })
if (tileError) throw new Error(`terrain_tiles upsert failed: ${tileError.message}`)

const { error: datasetError } = await supabase
  .from('terrain_datasets')
  .update({
    status: 'ready',
    source_uri: SOURCE_URL,
    dataset_name: 'LOLA Shackleton Rim Site04 5m',
    metadata,
  })
  .eq('id', DATASET_ID)
if (datasetError) throw new Error(`terrain dataset activation failed: ${datasetError.message}`)

console.log(JSON.stringify({ ok: true, datasetId: DATASET_ID, tileKey: TILE_KEY, width, height, checksum, bbox, storagePath: STORAGE_PATH }, null, 2))
