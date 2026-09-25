#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { fromArrayBuffer } from 'geotiff'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!rawUrl || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

const url = new URL(rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`)
const supabase = createClient(url.origin, key)

const { data: location, error: locationError } = await supabase.from('locations').select('id').eq('slug', 'moon').single()
if (locationError || !location) throw new Error(`Moon location lookup failed: ${locationError?.message ?? 'missing'}`)

const { data: frame, error: frameError } = await supabase.from('world_frames').select('*').eq('location_id', location.id).single()
if (frameError || !frame) throw new Error(`Moon world frame lookup failed: ${frameError?.message ?? 'missing'}`)
if (frame.terrain_dataset_id !== 'moon_lro_lola_south_pole_5m') throw new Error(`Unexpected active dataset ${frame.terrain_dataset_id}`)

const { data: tile, error: tileError } = await supabase
  .from('terrain_tiles')
  .select('*')
  .eq('dataset_id', frame.terrain_dataset_id)
  .eq('tile_key', 'shackleton-site04-5m-v1')
  .eq('status', 'ready')
  .single()
if (tileError || !tile) throw new Error(`Site04 tile lookup failed: ${tileError?.message ?? 'missing'}`)

const { data: blob, error: storageError } = await supabase.storage.from(tile.storage_bucket).download(tile.storage_path)
if (storageError || !blob) throw new Error(`Terrain object download failed: ${storageError?.message ?? 'missing'}`)
const buffer = await blob.arrayBuffer()
const tiff = await fromArrayBuffer(buffer)
const image = await tiff.getImage()
const bbox = image.getBoundingBox()
const width = image.getWidth()
const height = image.getHeight()

function project(latDeg, lonDeg, radiusM = 1_737_400) {
  const lat = latDeg * Math.PI / 180
  const lon = lonDeg * Math.PI / 180
  const rho = 2 * radiusM * Math.tan(Math.PI / 4 + lat / 2)
  return { xM: rho * Math.sin(lon), yM: rho * Math.cos(lon) }
}

function pixelFor(xM, yM) {
  const [minX, minY, maxX, maxY] = bbox
  const px = Math.max(0, Math.min(width - 1, Math.floor((xM - minX) / (maxX - minX) * width)))
  const py = Math.max(0, Math.min(height - 1, Math.floor((maxY - yM) / (maxY - minY) * height)))
  return { px, py }
}

async function readAt(xM, yM) {
  const [minX, minY, maxX, maxY] = bbox
  if (xM < minX || xM >= maxX || yM < minY || yM >= maxY) return null
  const { px, py } = pixelFor(xM, yM)
  const raster = await image.readRasters({ window: [px, py, px + 1, py + 1], samples: [0], interleave: true })
  const value = Number(raster[0])
  const noData = image.getGDALNoData()
  if (!Number.isFinite(value) || (noData != null && value === Number(noData))) return null
  return value
}

const origin = project(Number(frame.origin_lat_deg), Number(frame.origin_lon_deg))
const marginM = Math.min(origin.xM - bbox[0], bbox[2] - origin.xM, origin.yM - bbox[1], bbox[3] - origin.yM)
if (marginM < 1000) throw new Error(`Active Moon origin is too close to/outside Site04 coverage: margin=${marginM.toFixed(2)} m`)

const centerElevationM = await readAt(origin.xM, origin.yM)
if (centerElevationM == null) throw new Error('Site04 returned NoData at active Moon world-frame origin')

const sampled = []
for (let dy = -300; dy <= 300; dy += 60) {
  for (let dx = -300; dx <= 300; dx += 60) {
    sampled.push(await readAt(origin.xM + dx, origin.yM + dy))
  }
}
const finite = sampled.filter(value => value != null)
if (finite.length !== sampled.length) throw new Error(`Local 600 m validation grid contains ${sampled.length - finite.length} NoData/out-of-coverage samples`)

console.log(JSON.stringify({
  datasetId: frame.terrain_dataset_id,
  tileKey: tile.tile_key,
  rasterSize: [width, height],
  rasterBboxM: bbox,
  worldFrameOrigin: { latDeg: frame.origin_lat_deg, lonDeg: frame.origin_lon_deg },
  projectedOriginM: origin,
  coverageMarginM: marginM,
  centerElevationM,
  local600mGrid: {
    samples: finite.length,
    minElevationM: Math.min(...finite),
    maxElevationM: Math.max(...finite),
  },
}, null, 2))
