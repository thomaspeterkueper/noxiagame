// app/api/game/found-location/route.ts
// Erstellt:     20.07.2026
// Aktualisiert: 20.07.2026 — Kolonie/Station gründen
// Version:      1.0.0
//
// POST — Neue Kolonie oder Station gründen
// GET  — Verfügbare Himmelskörper + Gründungsvoraussetzungen

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { FOUNDING_COSTS, ORBIT_CLASSES, type OrbitClass } from '@/lib/game/celestialBodies'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// ── GET — Himmelskörper + bestehende Locations ────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: bodies } = await supabase
    .from('celestial_bodies')
    .select('*')
    .neq('body_type', 'star')  // Sonne nicht kolonisierbar
    .order('orbit_radius_au')

  const { data: existingLocations } = await supabase
    .from('locations')
    .select('id, name, slug, celestial_body_id, location_type, surface_lat, surface_lon, orbit_altitude_km, orbit_class, owner_id, grid_radius')

  // Spieler-Credits prüfen
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    celestialBodies: bodies ?? [],
    existingLocations: existingLocations ?? [],
    playerCredits: profile?.credits ?? 0,
    foundingCosts: FOUNDING_COSTS,
    orbitClasses: ORBIT_CLASSES,
  })
}

// ── POST — Gründen ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json() as {
    name:              string
    celestialBodyId:   string
    locationType:      'colony' | 'station' | 'outpost' | 'relay'
    // Oberfläche
    surfaceLat?:       number
    surfaceLon?:       number
    // Orbit
    orbitClass?:       OrbitClass
    orbitInclination?: number
  }

  const { name, celestialBodyId, locationType, surfaceLat, surfaceLon, orbitClass } = body

  // ── Validierung ───────────────────────────────────────────────────────────
  if (!name?.trim() || name.trim().length < 3) {
    return NextResponse.json({ error: 'Name zu kurz (min. 3 Zeichen)' }, { status: 400 })
  }
  if (!celestialBodyId) {
    return NextResponse.json({ error: 'Kein Himmelskörper gewählt' }, { status: 400 })
  }

  // Station braucht Orbit-Klasse, Colony braucht Koordinaten
  if (locationType === 'station' || locationType === 'relay') {
    if (!orbitClass || !ORBIT_CLASSES[orbitClass]) {
      return NextResponse.json({ error: 'Ungültige Orbit-Klasse' }, { status: 400 })
    }
  } else {
    if (surfaceLat == null || surfaceLon == null) {
      return NextResponse.json({ error: 'Koordinaten fehlen' }, { status: 400 })
    }
    if (surfaceLat < -90 || surfaceLat > 90 || surfaceLon < -180 || surfaceLon > 180) {
      return NextResponse.json({ error: 'Ungültige Koordinaten' }, { status: 400 })
    }
  }

  // ── Himmelskörper prüfen ──────────────────────────────────────────────────
  const { data: celestialBody } = await supabase
    .from('celestial_bodies')
    .select('*')
    .eq('id', celestialBodyId)
    .single()
  if (!celestialBody) {
    return NextResponse.json({ error: 'Himmelskörper nicht gefunden' }, { status: 404 })
  }

  // ── Kollisions-Check — zu nahe an bestehender Location? ──────────────────
  if (surfaceLat != null && surfaceLon != null) {
    const { data: nearby } = await supabase
      .from('locations')
      .select('name, surface_lat, surface_lon')
      .eq('celestial_body_id', celestialBodyId)
      .not('surface_lat', 'is', null)

    for (const loc of nearby ?? []) {
      if (loc.surface_lat == null || loc.surface_lon == null) continue
      const dLat = Math.abs(surfaceLat - loc.surface_lat)
      const dLon = Math.abs(surfaceLon - loc.surface_lon)
      if (dLat < 5 && dLon < 5) {  // 5° Mindestabstand
        return NextResponse.json({
          error: `Zu nahe an bestehender Siedlung "${loc.name}" (min. 5° Abstand)`,
        }, { status: 409 })
      }
    }
  }

  // ── Credits prüfen ────────────────────────────────────────────────────────
  const cost = (FOUNDING_COSTS[locationType] ?? 25000)
    * (orbitClass ? ORBIT_CLASSES[orbitClass].cost_mult : 1.0)

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single()
  if (!profile || profile.credits < cost) {
    return NextResponse.json({
      error: `Zu wenig Credits (benötigt: ${Math.round(cost).toLocaleString()} Cr)`,
      required: Math.round(cost),
    }, { status: 400 })
  }

  // ── Slug generieren ───────────────────────────────────────────────────────
  const slug = name.trim().toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36)

  // ── Location anlegen ──────────────────────────────────────────────────────
  const orbitAltitude = orbitClass ? ORBIT_CLASSES[orbitClass].altitude : null

  const { data: location, error } = await supabase
    .from('locations')
    .insert({
      name:              name.trim(),
      slug,
      location_type:     locationType,
      celestial_body_id: celestialBodyId,
      surface_lat:       surfaceLat ?? null,
      surface_lon:       surfaceLon ?? null,
      orbit_altitude_km: orbitAltitude,
      orbit_class:       orbitClass ?? null,
      orbit_inclination: body.orbitInclination ?? 0,
      grid_radius:       locationType === 'station' ? 8 : 16,
      owner_id:          user.id,
      is_public:         true,
      population:        locationType === 'colony' ? 10 : 0,
      population_max:    locationType === 'colony' ? 100 : 0,
      is_supplied:       false,
    })
    .select()
    .single()

  if (error || !location) {
    return NextResponse.json({ error: error?.message ?? 'Fehler beim Anlegen' }, { status: 500 })
  }

  // ── Credits abziehen ──────────────────────────────────────────────────────
  await supabase.from('profiles')
    .update({ credits: profile.credits - Math.round(cost) })
    .eq('id', user.id)

  // ── Mindest-Infrastruktur anlegen (Landing Pad) ───────────────────────────
  // Wird bei nächstem Grid-Load automatisch angezeigt
  await supabase.from('tile_entities').insert({
    profile_id:   null,
    actor_id:     null,
    owner_class:  'STATE',
    entity_type:  'building',
    entity_id:    locationType === 'station' ? 'docking_bay' : 'landing_pad',
    location_id:  location.id,
    tile_level:   0,
    tile_row:     12,
    tile_col:     16,
    built_at:     new Date().toISOString(),
  })

  return NextResponse.json({
    ok:       true,
    location,
    cost:     Math.round(cost),
    slug,
  })
}
