import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  buildAuthoritativeEarthSurfaceMissionDraft,
  EarthSurfaceMissionDraftError,
  parseEarthSurfaceMissionIntent,
} from '@/lib/game/earthSurfaceMissionDraftServer'

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice('Bearer '.length))
  return user
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

  try {
    const intent = parseEarthSurfaceMissionIntent(body)
    const draft = await buildAuthoritativeEarthSurfaceMissionDraft(user.id, intent)
    return NextResponse.json(draft, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (error) {
    if (error instanceof EarthSurfaceMissionDraftError) {
      return NextResponse.json({
        ok: false,
        ready: false,
        code: error.code,
        error: error.message,
        ...error.details,
      }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error('earth surface mission draft failed:', message)
    return NextResponse.json({ error: 'Earth-Surface-Mission-Draft konnte nicht erstellt werden.' }, { status: 500 })
  }
}
