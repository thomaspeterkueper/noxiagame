import { NextRequest, NextResponse } from 'next/server'
import {
  buildPassengerJourneyDraft,
  type PassengerTravelMode,
} from '@/lib/game/passengerJourney'
import { resolveEarthLandmarkPassengerTarget } from '@/lib/world/spatial/earthPassengerJourney'

export const revalidate = 0

const MODES = new Set<PassengerTravelMode>(['road', 'rail', 'air', 'mixed'])

type DraftRequest = {
  actorId?: string | null
  target?: {
    worldObject?: {
      kind?: string
      id?: string
    }
  }
  mobilityMode?: PassengerTravelMode
}

export async function POST(req: NextRequest) {
  let body: DraftRequest
  try {
    body = await req.json() as DraftRequest
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 })
  }

  const kind = body.target?.worldObject?.kind
  const landmarkId = body.target?.worldObject?.id?.trim()
  const mobilityMode = body.mobilityMode
  const actorId = typeof body.actorId === 'string' && body.actorId.trim() ? body.actorId.trim() : null

  if (kind !== 'earth-landmark' || !landmarkId || !mobilityMode || !MODES.has(mobilityMode)) {
    return NextResponse.json({ ok: false, error: 'invalid-passenger-journey-intent' }, { status: 400 })
  }

  const resolution = resolveEarthLandmarkPassengerTarget(landmarkId)
  if (!resolution) {
    return NextResponse.json({ ok: false, error: 'unknown-earth-landmark' }, { status: 404 })
  }

  const draft = buildPassengerJourneyDraft({
    intent: {
      actorId,
      target: resolution.worldObject,
      mobilityMode,
    },
    arrivalNode: resolution.arrivalNode,
    legs: null,
  })

  return NextResponse.json({
    ok: true,
    draft,
    authority: {
      journey: 'NOXIA Core',
      arrival: 'Earth world domain',
      routing: 'world-owned; unresolved until canonical arrival node exists',
    },
  }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
