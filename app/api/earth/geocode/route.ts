import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_GEOCODER_URL = 'https://nominatim.openstreetmap.org/search'
const GEOCODER_URL = process.env.NOXIA_GEOCODER_URL ?? DEFAULT_GEOCODER_URL
const USER_AGENT = 'NOXIA-Game/0.6 (+https://noxiagame.vercel.app)'

type SearchResult = {
  id: string
  label: string
  lat: number
  lon: number
  kind: string
  source: 'coordinates' | 'nominatim'
}

function parseNumber(raw: string) {
  const value = Number(raw.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function coordinateResult(query: string): SearchResult | null {
  const trimmed = query.trim()
  const commaSeparated = trimmed.match(/^([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)$/)
  const whitespaceSeparated = trimmed.match(/^([+-]?\d{1,2}(?:[.,]\d+)?)\s+([+-]?\d{1,3}(?:[.,]\d+)?)$/)
  const semicolonSeparated = trimmed.match(/^([+-]?\d{1,2}(?:[.,]\d+)?)\s*[;/]\s*([+-]?\d{1,3}(?:[.,]\d+)?)$/)
  const match = commaSeparated ?? whitespaceSeparated ?? semicolonSeparated
  if (!match) return null

  const lat = parseNumber(match[1])
  const lon = parseNumber(match[2])
  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null

  return {
    id: `coord:${lat.toFixed(6)},${lon.toFixed(6)}`,
    label: `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`,
    lat,
    lon,
    kind: 'Koordinate',
    source: 'coordinates',
  }
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 160)
  if (query.length < 2) {
    return NextResponse.json({ ok: false, error: 'Bitte mindestens zwei Zeichen oder eine Koordinate eingeben.' }, { status: 400 })
  }

  const direct = coordinateResult(query)
  if (direct) {
    return NextResponse.json({ ok: true, query, results: [direct] }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  }

  const url = new URL(GEOCODER_URL)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '5')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('dedupe', '1')

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'de,en;q=0.8',
        'User-Agent': USER_AGENT,
        Referer: 'https://noxiagame.vercel.app/',
      },
      next: { revalidate: 86400 },
    })
    if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`)

    const rows = await response.json() as Array<Record<string, unknown>>
    const results = rows.flatMap((row, index): SearchResult[] => {
      const lat = Number(row.lat)
      const lon = Number(row.lon)
      const label = String(row.display_name ?? '').trim()
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !label) return []
      return [{
        id: String(row.place_id ?? `${lat},${lon},${index}`),
        label,
        lat,
        lon,
        kind: String(row.type ?? row.category ?? 'Ort'),
        source: 'nominatim',
      }]
    })

    return NextResponse.json({
      ok: true,
      query,
      results,
      attribution: 'Ortssuche: OpenStreetMap / Nominatim · © OpenStreetMap-Mitwirkende',
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Ortssuche derzeit nicht erreichbar.',
    }, { status: 503 })
  }
}
