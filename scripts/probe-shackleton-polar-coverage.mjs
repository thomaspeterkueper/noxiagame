#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { fromArrayBuffer, fromUrl } from 'geotiff'

const CATALOGUE_URL = 'https://pgda.gsfc.nasa.gov/products/78'
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

async function openRemoteGeoTiff(sourceUrl) {
  try {
    return await fromUrl(sourceUrl)
  } catch (rangeError) {
    console.warn(`Range probe failed for ${sourceUrl}; falling back to full download: ${rangeError instanceof Error ? rangeError.message : String(rangeError)}`)
    const response = await fetch(sourceUrl, { redirect: 'follow' })
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
    return fromArrayBuffer(await response.arrayBuffer())
  }
}

async function discoverLdemCandidates() {
  const response = await fetch(CATALOGUE_URL, { redirect: 'follow' })
  if (!response.ok) throw new Error(`NASA catalogue download failed: ${response.status} ${response.statusText}`)
  const html = await response.text()
  const labels = new Map([
    ['Site01', 'Connecting ridge'],
    ['Site04', 'Shackleton rim'],
    ['Site07', 'Peak near Shackleton'],
    ['SL3', 'Connecting ridge extension'],
    ['LM1', 'Shackleton Rim B'],
  ])
  const wanted = new Set(labels.keys())
  const discovered = new Map()
  const hrefPattern = /href=["']([^"']+_final_adj_5mpp_surf\.tif)["']/gi
  for (const match of html.matchAll(hrefPattern)) {
    const sourceUrl = new URL(match[1], CATALOGUE_URL).href
    const fileName = sourceUrl.split('/').pop() ?? ''
    const site = fileName.replace(/_final_adj_5mpp_surf\.tif$/i, '')
    if (wanted.has(site)) discovered.set(site, [site, labels.get(site), sourceUrl])
  }
  const missing = [...wanted].filter(site => !discovered.has(site))
  if (missing.length) console.warn(`NASA catalogue did not expose expected LDEM links for: ${missing.join(', ')}`)
  return [...discovered.values()]
}

const candidates = await discoverLdemCandidates()
console.log(JSON.stringify({ discoveredCandidates: candidates }, null, 2))

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
      const tiff = await openRemoteGeoTiff(sourceUrl)
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
