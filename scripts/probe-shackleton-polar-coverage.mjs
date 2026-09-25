#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { fromUrl } from 'geotiff'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!rawUrl || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

function normalizeSupabaseUrl(value) {
  const trimmed = value.trim()
  const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  if (!parsed.hostname.endsWith('.supabase.co')) throw new Error(`Unexpected Supabase host: ${parsed.hostname}`)
  return parsed.origin
}

function southPolarStereographic(latDeg, lonDeg, radiusM = 1_737_400, centerLonDeg = 0) {
  const lat = latDeg * Math.PI / 180
  const lon = (lonDeg - centerLonDeg) * Math.PI / 180
  const rho = 2 * radiusM * Math.tan(Math.PI / 4 + lat / 2)
  return {
    xM: rho * Math.sin(lon),
    yM: rho * Math.cos(lon),
  }
}

const candidates = [
  ['Site04', 'Shackleton rim', 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif'],
  ['LM1', 'Shackleton Rim B', 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/LM1/LM1_final_adj_5mpp_surf.tif'],
  ['Site07', 'Peak near Shackleton', 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site07/Site07_final_adj_5mpp_surf.tif'],
  ['Site01', 'Connecting ridge', 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif'],
  ['SL3', 'Connecting ridge extension', 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/SL3/SL3_final_adj_5mpp_surf.tif'],
]

const supabase = createClient(normalizeSupabaseUrl(rawUrl), key)
const { data: frames, error: frameError } = await supabase
  .from('world_frames')
  .select('location_id,body,origin_lat_deg,origin_lon_deg,origin_status,terrain_dataset_id')
  .eq('body', 'moon')
  .eq('origin_status', 'verified')

if (frameError) throw new Error(`world_frames lookup failed: ${frameError.message}`)
if (!frames?.length) throw new Error('No verified Moon world frame found')

for (const frame of frames) {
  const p = southPolarStereographic(Number(frame.origin_lat_deg), Number(frame.origin_lon_deg))
  console.log(JSON.stringify({
    frame: {
      locationId: frame.location_id,
      latDeg: frame.origin_lat_deg,
      lonDeg: frame.origin_lon_deg,
      terrainDatasetId: frame.terrain_dataset_id,
    },
    projectedOriginM: p,
  }, null, 2))

  const results = []
  for (const [site, label, sourceUrl] of candidates) {
    try {
      const tiff = await fromUrl(sourceUrl)
      const image = await tiff.getImage()
      const bbox = image.getBoundingBox()
      const containsOrigin = p.xM >= bbox[0] && p.xM <= bbox[2] && p.yM >= bbox[1] && p.yM <= bbox[3]
      const marginM = containsOrigin
        ? Math.min(p.xM - bbox[0], bbox[2] - p.xM, p.yM - bbox[1], bbox[3] - p.yM)
        : -Math.hypot(
            p.xM < bbox[0] ? bbox[0] - p.xM : p.xM > bbox[2] ? p.xM - bbox[2] : 0,
            p.yM < bbox[1] ? bbox[1] - p.yM : p.yM > bbox[3] ? p.yM - bbox[3] : 0,
          )
      results.push({
        site,
        label,
        sourceUrl,
        width: image.getWidth(),
        height: image.getHeight(),
        bbox,
        containsOrigin,
        marginM: Math.round(marginM),
      })
    } catch (error) {
      results.push({ site, label, sourceUrl, error: error instanceof Error ? error.message : String(error) })
    }
  }

  results.sort((a, b) => Number(Boolean(b.containsOrigin)) - Number(Boolean(a.containsOrigin)) || (b.marginM ?? -Infinity) - (a.marginM ?? -Infinity))
  console.log(JSON.stringify({ coverage: results }, null, 2))

  const safe = results.filter(result => result.containsOrigin && Number(result.marginM) >= 500)
  if (!safe.length) {
    console.error('No probed 5 m LOLA site contains the Moon world-frame origin with a >=500 m safety margin.')
    process.exitCode = 2
  } else {
    console.log(`Preferred coverage candidate: ${safe[0].site} (${safe[0].label}), margin ${safe[0].marginM} m`)
  }
}
