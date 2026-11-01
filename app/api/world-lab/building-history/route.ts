// app/api/world-lab/building-history/route.ts
// Lebensgeschichte von Gebäuden auf der Erde (Issue #541). Nur lesend, nur mit Anmeldung.
// Parameter: entityId (Gebäude-ID) oder sourceRef (reales Gebäude), optional limit (höchstens 500).
// Ohne Parameter: die letzten Ereignisse und Grabsteine der Erde. Der Aufruf nimmt keine Nutzlast
// an; ein „committed“ oder eine Berechtigung kann der Client nicht mitschicken.

import { NextRequest, NextResponse } from 'next/server'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { isEntityId, loadBuildingChronicle } from '@/lib/worldlab/buildingChronicle.server'

export async function GET(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = req.nextUrl.searchParams
  const entityId = params.get('entityId')
  const sourceRef = params.get('sourceRef')?.trim() || null
  if (entityId && !isEntityId(entityId)) return NextResponse.json({ error: 'Ungültige Gebäude-ID' }, { status: 400 })
  if (sourceRef && sourceRef.length > 200) return NextResponse.json({ error: 'Ungültige Quelle' }, { status: 400 })
  const limit = Number(params.get('limit') ?? 200)
  try {
    const chronicle = await loadBuildingChronicle({ viewerProfileId: profileId, entityId, sourceRef, limit: Number.isFinite(limit) ? limit : 200 })
    return NextResponse.json(chronicle, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[building-history]', error)
    return NextResponse.json({ error: 'Chronik nicht verfügbar' }, { status: 500 })
  }
}
