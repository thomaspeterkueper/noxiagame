// app/api/game/knowledge/route.ts
// Erstellt: 20.06.2026
//
// GET /api/game/knowledge              → knowledge_points des Spielers
// GET /api/game/knowledge?action=award&points=15&reason=school_task&location=moon
//                                      → Punkte gutschreiben

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getUserFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // ── Punkte lesen ─────────────────────────────────────────────────
  if (!action) {
    const { data } = await supabase
      .from('profiles')
      .select('knowledge_points')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ knowledge_points: data?.knowledge_points ?? 0 })
  }

  // ── Punkte vergeben ───────────────────────────────────────────────
  if (action === 'award') {
    const points   = parseInt(searchParams.get('points') ?? '0', 10)
    const reason   = searchParams.get('reason') ?? 'school_task'
    const location = searchParams.get('location') ?? null

    if (points <= 0 || points > 100) {
      return NextResponse.json({ error: 'Ungültige Punktzahl' }, { status: 400 })
    }

    // Rate-Limit: max 10 Aufgaben pro Stunde pro Spieler
    const { count } = await supabase
      .from('knowledge_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', user.id)
      .eq('reason', 'school_task')
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString())

    if ((count ?? 0) >= 10) {
      return NextResponse.json({
        error: 'Stundenlimit erreicht — komm später wieder.',
        knowledge_points: null,
      }, { status: 429 })
    }

    const { data } = await supabase.rpc('award_knowledge', {
      p_profile_id: user.id,
      p_amount:     points,
      p_reason:     reason,
      p_task_id:    location,
    })

    return NextResponse.json({ knowledge_points: data ?? 0, awarded: points })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
