// app/api/game/build/options/route.ts
// Erstellt: 25.06.2026
// Version: 0.1.0
//
// Liefert die gültigen Bauoptionen für einen Standort.
// Ziel: Der Client soll nicht mehr blind lokale BUILDINGS anzeigen, sondern
// nur noch Bautypen, die serverseitig aktiv und am aktuellen Ort erlaubt sind.
//
// Nächster Schritt: Tile-Suitability/Feldbeschreibung einbeziehen
// (z.B. Kohle, Eis, Sumpf, Fundament-Eignung, Ertragsmultiplikator).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type BuildingRow = {
  key: string
  name: string
  cost_credits: number | null
  population_bonus: number | null
  production: unknown
  consumption: unknown
  allowed_locations: string[] | null
  build_time_ticks: number | null
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const { data: { user } } = await serviceClient.auth.getUser(token)
  return user
}

function isAllowedAtLocation(row: BuildingRow, locationSlug: string): boolean {
  const allowed = row.allowed_locations
  if (!allowed || allowed.length === 0) return true
  return allowed.includes(locationSlug)
}

function normalizeProduction(production: unknown) {
  if (!Array.isArray(production)) return []
  return production
    .filter((p): p is { resource?: unknown; amount?: unknown } => typeof p === 'object' && p !== null)
    .map(p => ({
      resource: typeof p.resource === 'string' ? p.resource : 'unknown',
      amount: typeof p.amount === 'number' ? p.amount : 0,
    }))
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const locationSlug = searchParams.get('location')
  const tileType = searchParams.get('tileType') ?? null
  const tileRow = Number.parseInt(searchParams.get('tileRow') ?? '-1', 10)
  const tileCol = Number.parseInt(searchParams.get('tileCol') ?? '-1', 10)

  if (!locationSlug) {
    return NextResponse.json({ error: 'Fehlender Standort' }, { status: 400 })
  }

  const { data: location } = await serviceClient
    .from('locations')
    .select('id, slug, name, location_type')
    .eq('slug', locationSlug)
    .single()

  if (!location) {
    return NextResponse.json({ error: 'Standort nicht gefunden' }, { status: 404 })
  }

  const { data, error } = await serviceClient
    .from('building_definitions')
    .select('key, name, cost_credits, population_bonus, production, consumption, allowed_locations, build_time_ticks')
    .eq('is_active', true)
    .order('cost_credits', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Bauoptionen konnten nicht geladen werden.' }, { status: 500 })
  }

  const rows = (data ?? []) as BuildingRow[]
  const buildable = rows
    .filter(row => isAllowedAtLocation(row, location.slug))
    .map(row => ({
      key: row.key,
      name: row.name,
      cost: row.cost_credits ?? 0,
      buildTimeTicks: row.build_time_ticks ?? 1,
      populationBonus: row.population_bonus ?? 0,
      production: normalizeProduction(row.production),
      allowedLocations: row.allowed_locations ?? null,
    }))

  return NextResponse.json({
    location: {
      slug: location.slug,
      name: location.name,
      type: location.location_type,
    },
    tile: {
      row: Number.isNaN(tileRow) ? null : tileRow,
      col: Number.isNaN(tileCol) ? null : tileCol,
      type: tileType,
    },
    buildable,
  })
}
