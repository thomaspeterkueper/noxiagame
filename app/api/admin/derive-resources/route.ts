import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 120

const IMPORT_SECRET_SHA256 = '6e7d71b3bd360c945d18f8a3c20d596739049d97736455dda6980c95856d4e8d'
const SAMPLE_M = 100
const MIN_ABUNDANCE = 0.05

type GeoPoint = { lat: number; lon: number }
type Bounds = { south: number; west: number; north: number; east: number }

type AffinityRow = { lithology_class: string; resource_type: string; base_weight: number }
type MineralRow = { lat: number; lon: number; commodities: string[] | null }

function matchesSecret(secret: string) {
  const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'))
  const expected = Buffer.from(IMPORT_SECRET_SHA256)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function seededUnit(...parts: (string | number)[]) {
  const s = parts.join(':')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000
}

function haversineKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lon - a.lon) * Math.PI / 180
  const la1 = a.lat * Math.PI / 180
  const la2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function tierFor(abundance: number) {
  if (abundance >= 3) return 'exceptional'
  if (abundance >= 1) return 'rich'
  if (abundance >= 0.3) return 'viable'
  return 'trace'
}

const RESOURCE_TOKENS: Record<string, string[]> = {
  copper_ore: ['CU', 'COPPER'],
  iron_ore: ['FE', 'IRON'],
  rare_earth: ['REE', 'RARE_EARTH', 'RARE EARTH'],
  silica_quartz: ['SI', 'SILICA', 'QUARTZ'],
  uranium: ['U', 'URANIUM'],
  sand_gravel: ['SAND', 'GRAVEL'],
  limestone: ['LIMESTONE', 'CA'],
  salt: ['SALT', 'HALITE'],
  groundwater: ['WATER', 'GROUNDWATER'],
}

function mrdsMatches(resourceType: string, commodities: string[] | null) {
  const tokens = RESOURCE_TOKENS[resourceType] ?? []
  if (!tokens.length || !commodities?.length) return false
  const haystack = commodities.join(' ').toUpperCase()
  return tokens.some(token => new RegExp(`(^|[^A-Z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z0-9]|$)`).test(haystack))
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const value = err as Record<string, unknown>
    return [value.message, value.details, value.hint, value.code].filter(v => typeof v === 'string' && v).join(' · ') || String(err)
  }
  return String(err)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = req.headers.get('x-noxia-admin-secret') ?? searchParams.get('secret')
  if (!secret || !matchesSecret(secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug erforderlich' }, { status: 400 })

  const supabase = createServiceClient()

  try {
    const { data: region, error: regionError } = await supabase
      .from('celestial_regions')
      .select('id,slug,center_lat,center_lon,bounds')
      .eq('slug', slug)
      .single()
    if (regionError || !region) throw regionError ?? new Error(`Region '${slug}' nicht gefunden`)

    const bounds = region.bounds as Bounds
    const centre = { lat: Number(region.center_lat), lon: Number(region.center_lon) }
    if (![bounds?.south, bounds?.west, bounds?.north, bounds?.east, centre.lat, centre.lon].every(Number.isFinite)) {
      throw new Error('Region hat ungueltige Geodaten')
    }

    const { data: affinityRows, error: affinityError } = await supabase
      .from('geology_resource_affinity')
      .select('lithology_class,resource_type,base_weight')
    if (affinityError) throw affinityError
    if (!affinityRows?.length) throw new Error('geology_resource_affinity ist leer')

    const affinity = new Map<string, AffinityRow[]>()
    for (const row of affinityRows as AffinityRow[]) {
      const list = affinity.get(row.lithology_class) ?? []
      list.push(row)
      affinity.set(row.lithology_class, list)
    }

    const { data: cells, error: cellsError } = await supabase
      .from('geology_lithology_grid')
      .select('lat,lon,lithology_class')
      .gte('lat', bounds.south - 0.5).lte('lat', bounds.north + 0.5)
      .gte('lon', bounds.west - 0.5).lte('lon', bounds.east + 0.5)
    if (cellsError) throw cellsError
    if (!cells?.length) throw new Error('Keine GLiM-Zelle fuer Region gefunden')

    let dominantClass = 'nd'
    let bestDist = Infinity
    for (const c of cells) {
      const d = haversineKm(centre, { lat: Number(c.lat), lon: Number(c.lon) })
      if (d < bestDist) {
        bestDist = d
        dominantClass = String(c.lithology_class)
      }
    }

    const localAffinity = affinity.get(dominantClass) ?? []
    if (!localAffinity.length) throw new Error(`Keine Ressourcen-Affinitaet fuer GLiM-Klasse '${dominantClass}'`) 

    const { data: mrdsRows, error: mrdsError } = await supabase
      .from('region_mineral_occurrences')
      .select('lat,lon,commodities')
      .eq('region_id', region.id)
    if (mrdsError) throw mrdsError

    const latStep = SAMPLE_M / 111_320
    const rows: Array<Record<string, unknown>> = []
    for (let lat = bounds.south; lat <= bounds.north + 1e-12; lat += latStep) {
      const cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180))
      const lonStep = SAMPLE_M / (111_320 * cosLat)
      for (let lon = bounds.west; lon <= bounds.east + 1e-12; lon += lonStep) {
        for (const { resource_type, base_weight } of localAffinity) {
          const localVariation = 0.3 + seededUnit(slug, lat.toFixed(5), lon.toFixed(5), resource_type, 'var')
          const u = Math.max(1e-6, seededUnit(slug, lat.toFixed(5), lon.toFixed(5), resource_type, 'rarity'))
          const rarityFactor = -Math.log(u)

          let mrdsBoost = 1
          for (const m of (mrdsRows ?? []) as MineralRow[]) {
            if (!mrdsMatches(resource_type, m.commodities)) continue
            const dKm = haversineKm({ lat, lon }, { lat: Number(m.lat), lon: Number(m.lon) })
            mrdsBoost += 3 * Math.exp(-dKm / 1.5)
          }

          const abundance = Number(base_weight) * localVariation * rarityFactor * mrdsBoost
          if (abundance < MIN_ABUNDANCE) continue
          rows.push({
            region_id: region.id,
            resource_type,
            lat,
            lon,
            abundance,
            properties: {
              tier: tierFor(abundance),
              lithology_class: dominantClass,
              mrds_boosted: mrdsBoost > 1.05,
              sample_m: SAMPLE_M,
              model: 'glim-heavy-tail-v1',
            },
          })
        }
      }
    }

    const { error: deleteError } = await supabase.from('region_resources').delete().eq('region_id', region.id)
    if (deleteError) throw deleteError
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('region_resources').insert(rows.slice(i, i + 500))
      if (error) throw error
    }

    const byType: Record<string, number> = {}
    const byTier: Record<string, number> = {}
    let boosted = 0
    for (const row of rows) {
      const resourceType = String(row.resource_type)
      const properties = row.properties as { tier: string; mrds_boosted: boolean }
      byType[resourceType] = (byType[resourceType] ?? 0) + 1
      byTier[properties.tier] = (byTier[properties.tier] ?? 0) + 1
      if (properties.mrds_boosted) boosted++
    }

    return NextResponse.json({
      ok: true,
      slug,
      regionId: region.id,
      dominantLithology: dominantClass,
      sampleM: SAMPLE_M,
      total: rows.length,
      byType,
      byTier,
      mrdsOccurrences: mrdsRows?.length ?? 0,
      mrdsBoostedCells: boosted,
    })
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
