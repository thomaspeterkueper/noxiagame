import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { LOGISTICS_RESOURCES, type LogisticsResource } from '@/lib/game/core/logistics'
import {
  MARKET_OFFER_STATUSES,
  buyMarketOffer,
  cancelMarketOffer,
  createMarketOffer,
  ensureStorageAccount,
  listMarketOffers,
  listMarketSettlements,
  listStorageAccounts,
  type MarketOfferStatus,
} from '@/lib/game/core/marketplace'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
}

function uuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(number) && number > 0 && number <= 2_147_483_647 ? number : null
}

function resource(value: unknown): LogisticsResource | null {
  return typeof value === 'string' && (LOGISTICS_RESOURCES as readonly string[]).includes(value)
    ? value as LogisticsResource
    : null
}

function offerStatus(value: unknown): MarketOfferStatus | null {
  return typeof value === 'string' && (MARKET_OFFER_STATUSES as readonly string[]).includes(value)
    ? value as MarketOfferStatus
    : null
}

function coreNotRolledOut(message: string) {
  return message.includes('PGRST202')
    || message.includes('PGRST205')
    || message.includes('Could not find the function')
    || message.includes('Could not find the table')
    || message.includes('schema cache')
}

function marketError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (coreNotRolledOut(message)) return NextResponse.json({ error: 'Der Marketplace-Core ist auf der Datenbank noch nicht ausgerollt.', code: 'MARKET_CORE_NOT_DEPLOYED' }, { status: 503 })
  if (message.includes('NOXIA_MARKET_OFFER_NOT_FOUND')) return NextResponse.json({ error: 'Marktangebot nicht gefunden.', code: 'MARKET_OFFER_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_STORAGE_HOST_NOT_FOUND')) return NextResponse.json({ error: 'Physischer Depotknoten nicht gefunden.', code: 'STORAGE_HOST_NOT_FOUND' }, { status: 404 })
  if (message.includes('NOXIA_INVENTORY_NOT_FOUND')) return NextResponse.json({ error: 'Inventar nicht gefunden.', code: 'INVENTORY_NOT_FOUND' }, { status: 404 })
  if (message.includes('FORBIDDEN')) return NextResponse.json({ error: 'Dieser Marktvorgang ist nicht erlaubt.', code: 'FORBIDDEN' }, { status: 403 })
  if (message.includes('NOXIA_STORAGE_HOST_NOT_ELIGIBLE')) return NextResponse.json({ error: 'Dieser Logistikknoten kann keine privaten Verwahrkonten aufnehmen.', code: 'STORAGE_HOST_NOT_ELIGIBLE' }, { status: 409 })
  if (message.includes('NOXIA_MARKET_CREDITS_INSUFFICIENT')) return NextResponse.json({ error: 'Nicht genügend Credits für diesen Kauf.', code: 'CREDITS_INSUFFICIENT' }, { status: 409 })
  if (message.includes('NOXIA_INVENTORY_AVAILABLE_INSUFFICIENT') || message.includes('NOXIA_MARKET_RESERVED_STOCK_MISSING')) return NextResponse.json({ error: 'Nicht genügend frei verfügbare Ware im Verwahrinventar.', code: 'STOCK_INSUFFICIENT' }, { status: 409 })
  if (message.includes('NOXIA_MARKET_OFFER_AMOUNT_INSUFFICIENT')) return NextResponse.json({ error: 'Das Marktangebot enthält nicht mehr die angeforderte Menge.', code: 'OFFER_AMOUNT_INSUFFICIENT' }, { status: 409 })
  if (message.includes('NOXIA_MARKET_SELF_PURCHASE_FORBIDDEN')) return NextResponse.json({ error: 'Eigene Marktangebote können nicht gekauft werden.', code: 'SELF_PURCHASE_FORBIDDEN' }, { status: 409 })
  if (message.includes('NOXIA_MARKET_RESERVATION_INVALID')) return NextResponse.json({ error: 'Die physische Reservierung des Marktangebots ist inkonsistent.', code: 'MARKET_RESERVATION_INVALID' }, { status: 409 })
  if (message.includes('STATE_INVALID')) return NextResponse.json({ error: 'Das Marktangebot befindet sich nicht im erforderlichen Zustand.', code: 'STATE_INVALID' }, { status: 409 })
  if (message.includes('COMMAND_CONFLICT')) return NextResponse.json({ error: 'Die Command-ID wurde bereits mit anderen Parametern verwendet.', code: 'COMMAND_CONFLICT' }, { status: 409 })
  if (message.includes('INVALID_ARGUMENT') || message.includes('PRICE_OUT_OF_RANGE')) return NextResponse.json({ error: 'Ungültige Marktparameter.', code: 'INVALID_ARGUMENT' }, { status: 400 })

  console.error('market command failed:', message)
  return NextResponse.json({ error: 'Marktvorgang fehlgeschlagen.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const hostInventoryIdParam = searchParams.get('hostInventoryId')
  const resourceParam = searchParams.get('resource')
  const statusParam = searchParams.get('status')
  const mine = searchParams.get('mine') === '1' || searchParams.get('mine') === 'true'
  const includeHistory = searchParams.get('history') === '1' || searchParams.get('history') === 'true'
  const requestedLimit = positiveInteger(searchParams.get('limit') ?? 100) ?? 100

  const hostInventoryId = hostInventoryIdParam ? uuid(hostInventoryIdParam) : null
  if (hostInventoryIdParam && !hostInventoryId) return NextResponse.json({ error: 'Ungültige hostInventoryId.' }, { status: 400 })

  const requestedResource = resourceParam ? resource(resourceParam) : null
  if (resourceParam && !requestedResource) return NextResponse.json({ error: 'Ungültige Ressource.' }, { status: 400 })

  const requestedStatus = statusParam ? offerStatus(statusParam) : 'open'
  if (statusParam && !requestedStatus) return NextResponse.json({ error: 'Ungültiger Angebotsstatus.' }, { status: 400 })

  try {
    const [offers, accounts, settlements] = await Promise.all([
      listMarketOffers({
        hostInventoryId,
        sellerProfileId: mine ? user.id : null,
        resource: requestedResource,
        status: requestedStatus,
        limit: requestedLimit,
      }),
      listStorageAccounts(user.id, hostInventoryId),
      includeHistory ? listMarketSettlements(user.id, requestedLimit) : Promise.resolve([]),
    ])

    return NextResponse.json({ ok: true, offers, accounts, settlements })
  } catch (error) {
    return marketError(error)
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : ''

  try {
    if (action === 'ensure-account') {
      const hostInventoryId = uuid(body.hostInventoryId)
      if (!hostInventoryId) return NextResponse.json({ error: 'Ungültige hostInventoryId.' }, { status: 400 })

      const account = await ensureStorageAccount(user.id, hostInventoryId)
      return NextResponse.json({ ok: true, account })
    }

    if (action === 'create-offer') {
      const sellerInventoryId = uuid(body.sellerInventoryId)
      const marketResource = resource(body.resource)
      const amount = positiveInteger(body.amount)
      const unitPrice = positiveInteger(body.unitPrice)
      const commandId = body.commandId == null ? randomUUID() : uuid(body.commandId)

      if (!sellerInventoryId || !marketResource || !amount || !unitPrice || !commandId) {
        return NextResponse.json({ error: 'Ungültige Marktangebotsparameter.' }, { status: 400 })
      }

      const offer = await createMarketOffer({
        commandId,
        sellerProfileId: user.id,
        sellerInventoryId,
        resource: marketResource,
        amount,
        unitPrice,
      })
      return NextResponse.json({ ok: true, commandId, offer })
    }

    if (action === 'cancel-offer') {
      const offerId = uuid(body.offerId)
      if (!offerId) return NextResponse.json({ error: 'Ungültige offerId.' }, { status: 400 })

      const offer = await cancelMarketOffer(user.id, offerId)
      return NextResponse.json({ ok: true, offer })
    }

    if (action === 'buy-offer') {
      const offerId = uuid(body.offerId)
      const amount = positiveInteger(body.amount)
      const commandId = body.commandId == null ? randomUUID() : uuid(body.commandId)

      if (!offerId || !amount || !commandId) {
        return NextResponse.json({ error: 'Ungültige Kaufparameter.' }, { status: 400 })
      }

      const settlement = await buyMarketOffer({
        commandId,
        buyerProfileId: user.id,
        offerId,
        amount,
      })
      return NextResponse.json({ ok: true, commandId, settlement })
    }

    return NextResponse.json({ error: 'Ungültige Markt-Aktion.' }, { status: 400 })
  } catch (error) {
    return marketError(error)
  }
}
