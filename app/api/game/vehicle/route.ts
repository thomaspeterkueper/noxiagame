// app/api/game/vehicle/route.ts
// Aktualisiert: 06.11.2026 — Fahrzeuge auf der Erde: Kauf, Reparatur, Laden, Fahrt (Migration 20261026220000)
// Version:      1.0.0
//
// GET                                             → eigenes Fahrzeug, Modelle, Credits
// POST { action: 'buy', modelCode, requestId }    → Kauf im Autohaus (versteuerte Überweisung)
// POST { action: 'repair' | 'charge', requestId } → Werkstatt bzw. Ladestation
// POST { action: 'drive', from, to }              → Fahrt: Akku 1 % je 10 km, Verschleiß 1 % je 100 km;
//                                                   die Strecke rechnet der Server (Luftlinie × 1,3 Straßenfaktor).
// Preise und Zustand liegen in der Datenbank (vehicle_service, vehicle_drive);
// die Route prüft nur Eingaben und übersetzt Fehlercodes.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import type { GeoPoint } from '@/lib/game/earthTrips'
import { VEHICLE_MODELS, driveDistanceM, type Vehicle } from '@/lib/game/earthVehicles'

const noStore = { 'Cache-Control': 'no-store' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ERRORS: Record<string, { status: number; error: string }> = {
  NOXIA_CREDITS_INSUFFICIENT: { status: 402, error: 'Dafür reichen deine Credits nicht.' },
  NOXIA_VEHICLE_ALREADY_OWNED: { status: 409, error: 'Du hast schon ein Fahrzeug.' },
  NOXIA_VEHICLE_MODEL_UNKNOWN: { status: 400, error: 'Dieses Modell gibt es nicht.' },
  NOXIA_VEHICLE_NONE: { status: 404, error: 'Du hast kein Fahrzeug.' },
  NOXIA_VEHICLE_BROKEN: { status: 409, error: 'Das Fahrzeug ist zu kaputt zum Fahren – erst in die Werkstatt.' },
  NOXIA_VEHICLE_CHARGE_LOW: { status: 409, error: 'Der Akku reicht für diese Strecke nicht – erst laden.' },
  NOXIA_VEHICLE_SERVICE_UNKNOWN: { status: 400, error: 'Diese Leistung gibt es nicht.' },
  NOXIA_VEHICLE_REQUEST_CONFLICT: { status: 409, error: 'Dieser Auftrag gehört zu einem anderen Konto.' },
  NOXIA_EARTH_LOCATION_MISSING: { status: 500, error: 'Der Standort Erde fehlt in der Datenbank.' },
}

function mapError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? '')
  const code = Object.keys(ERRORS).find(key => message.includes(key))
  return code ? NextResponse.json({ error: ERRORS[code].error, code }, { status: ERRORS[code].status, headers: noStore }) : null
}

function point(value: unknown): GeoPoint | null {
  const p = value as { lat?: unknown; lon?: unknown } | null
  const lat = Number(p?.lat), lon = Number(p?.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { lat, lon } : null
}

function toVehicle(row: Record<string, unknown> | null): Vehicle | null {
  if (!row || !row.id) return null
  return {
    id: String(row.id), modelCode: String(row.model_code), modelLabel: String(row.model_label),
    conditionPct: Number(row.condition_pct), chargePct: Number(row.charge_pct), odometerM: Number(row.odometer_m ?? 0),
    at: row.latitude_deg != null && row.longitude_deg != null ? { lat: Number(row.latitude_deg), lon: Number(row.longitude_deg) } : null,
  }
}

async function state(supabase: ReturnType<typeof createServiceClient>, profileId: string) {
  const [{ data: vehicle }, { data: profile }] = await Promise.all([
    supabase.from('player_vehicles').select('*').eq('profile_id', profileId).eq('active', true).maybeSingle(),
    supabase.from('profiles').select('credits').eq('id', profileId).maybeSingle(),
  ])
  return { vehicle: toVehicle(vehicle as Record<string, unknown> | null), credits: Number(profile?.credits ?? 0), models: VEHICLE_MODELS }
}

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  const supabase = createServiceClient()
  return NextResponse.json({ ok: true, ...(await state(supabase, profileId)) }, { headers: noStore })
}

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action ?? '')
  const supabase = createServiceClient()

  try {
    if (action === 'drive') {
      const from = point(body.from), to = point(body.to)
      if (!from || !to) return NextResponse.json({ error: 'Start oder Ziel fehlt.' }, { status: 400, headers: noStore })
      const distanceM = driveDistanceM(from, to)
      const { data, error } = await supabase.rpc('vehicle_drive', { p_profile_id: profileId, p_distance_m: distanceM, p_lat: to.lat, p_lon: to.lon })
      if (error) throw error
      return NextResponse.json({ ok: true, distanceM, vehicle: toVehicle(data?.vehicle ?? null), chargeCost: Number(data?.charge_cost ?? 0), to }, { headers: noStore })
    }

    if (action === 'buy' || action === 'repair' || action === 'charge') {
      const requestId = String(body.requestId ?? '')
      if (!UUID_RE.test(requestId)) return NextResponse.json({ error: 'requestId fehlt.' }, { status: 400, headers: noStore })
      const modelCode = action === 'buy' ? String(body.modelCode ?? '') : null
      if (action === 'buy' && !VEHICLE_MODELS.some(model => model.code === modelCode)) return NextResponse.json({ error: ERRORS.NOXIA_VEHICLE_MODEL_UNKNOWN.error }, { status: 400, headers: noStore })
      const { data: tickRow } = await supabase.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle()
      const { data, error } = await supabase.rpc('vehicle_service', { p_profile_id: profileId, p_request_id: requestId, p_service_kind: action, p_model_code: modelCode, p_tick: Number(tickRow?.tick_number ?? 0) })
      if (error) throw error
      return NextResponse.json({ ok: true, duplicate: Boolean(data?.duplicate), label: data?.label ?? null, priceCredits: Number(data?.price_credits ?? 0), credits: Number(data?.credits ?? 0), vehicle: toVehicle(data?.vehicle ?? null) }, { headers: noStore })
    }

    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400, headers: noStore })
  } catch (error) {
    const mapped = mapError(error)
    if (mapped) return mapped
    console.error('[vehicle]', error)
    return NextResponse.json({ error: 'Das hat gerade nicht geklappt.' }, { status: 500, headers: noStore })
  }
}
