import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getAccessibleInventorySnapshot,
  LOGISTICS_RESOURCES,
  type LogisticsResource,
} from '@/lib/game/core/logistics'
import { resolveAuthoritativeLogisticsCargoMass } from '@/lib/game/core/logisticsCargoMassAuthority'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

function resource(value: unknown): LogisticsResource | null {
  return typeof value === 'string' && (LOGISTICS_RESOURCES as readonly string[]).includes(value)
    ? value as LogisticsResource
    : null
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function inventoryItems(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return []
  const items = (snapshot as Record<string, unknown>).items
  return Array.isArray(items)
    ? items.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
    : []
}

/**
 * Shared physical cargo-readiness gate for every surface world.
 *
 * This endpoint deliberately knows nothing about Earth, Moon or Mars. It only
 * verifies accessible source stock and resolves an authoritative physical mass.
 * World-specific routing and vehicle Engineering stay outside this boundary.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const sourceInventoryId = typeof body.sourceInventoryId === 'string' && UUID_RE.test(body.sourceInventoryId)
    ? body.sourceInventoryId
    : null
  const cargoResource = resource(body.resource)
  const amount = positiveInteger(body.amount)
  if (!sourceInventoryId || !cargoResource || !amount) {
    return NextResponse.json({ error: 'Ungültige Cargo-Mass-Parameter.' }, { status: 400 })
  }

  try {
    const snapshot = await getAccessibleInventorySnapshot(user.id, sourceInventoryId)
    const item = inventoryItems(snapshot).find(candidate => candidate.resource === cargoResource)
    if (!item) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'CARGO_STOCK_UNAVAILABLE',
        error: 'Die gewählte Ware ist am Quellinventar nicht vorhanden.',
      }, { status: 409 })
    }

    const availableRaw = item.available ?? item.amount
    const available = typeof availableRaw === 'number' ? availableRaw : Number(availableRaw)
    if (!Number.isFinite(available) || available < amount) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'CARGO_STOCK_INSUFFICIENT',
        error: 'Die gewählte Menge ist am Quellinventar nicht frei verfügbar.',
        available: Number.isFinite(available) ? available : null,
      }, { status: 409 })
    }

    const unit = typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : null
    const { resolution, source } = resolveAuthoritativeLogisticsCargoMass({
      commodityId: cargoResource,
      amount,
      unit,
    })

    if (resolution.status !== 'resolved') {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: 'CARGO_MASS_UNRESOLVED',
        error: 'Für die gewählte Ware und Menge liegt noch keine autoritative physikalische Frachtmasse vor.',
        commodityId: cargoResource,
        amount,
        unit,
        reason: resolution.reason,
        engineeringRequest: 'EXT-NOXIA-ENG-20260913-CARGO-MASS-BASIS',
      }, { status: 409 })
    }

    return NextResponse.json({
      ok: true,
      ready: true,
      commodityId: cargoResource,
      amount,
      unit,
      massKg: resolution.massKg,
      cargo: resolution.cargo,
      resolution: resolution.resolution,
      source,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NOXIA_INVENTORY_NOT_FOUND')) {
      return NextResponse.json({ error: 'Quellinventar nicht gefunden.', code: 'INVENTORY_NOT_FOUND' }, { status: 404 })
    }
    if (message.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Kein Zugriff auf das Quellinventar.', code: 'FORBIDDEN' }, { status: 403 })
    }
    console.error('surface cargo mass readiness failed:', message)
    return NextResponse.json({ error: 'Cargo-Mass-Freigabe konnte nicht geprüft werden.' }, { status: 500 })
  }
}
