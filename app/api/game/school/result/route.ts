// app/api/game/school/result/route.ts
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Ergebnis einer Akademie-Aufgabe speichern und die Stufe anpassen (R-17)
// Version:      1.0.0
//
// POST { correct: boolean, topic?: string } → { level, changed }
// Die Stufe ist die gespeicherte (profiles.knowledge_level), nicht die vom Client
// gemeldete. Regel: lib/knowledge/academyLevel.ts. Diagnostisch, keine Freischaltungen.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { ACADEMY_WINDOW, nextAcademyLevel } from '@/lib/knowledge/academyLevel'

export async function POST(req: NextRequest) {
  const profileId = await verifiedBearerUserId(req)
  if (!profileId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (typeof body?.correct !== 'boolean') return NextResponse.json({ error: 'correct fehlt.' }, { status: 400 })
  const topic = String(body?.topic ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || null

  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('knowledge_level').eq('id', profileId).maybeSingle()
  const level = Math.min(6, Math.max(1, Number(profile?.knowledge_level ?? 1) || 1))

  const { error: insertError } = await supabase.from('academy_task_results').insert({ profile_id: profileId, level, correct: body.correct, topic })
  if (insertError) return NextResponse.json({ error: 'Ergebnis konnte nicht gespeichert werden.' }, { status: 500 })

  const { data: recent } = await supabase.from('academy_task_results').select('correct')
    .eq('profile_id', profileId).eq('level', level).order('created_at', { ascending: false }).limit(ACADEMY_WINDOW)
  const next = nextAcademyLevel(level, (recent ?? []).map((row: { correct: boolean }) => row.correct))
  if (next !== level) await supabase.from('profiles').update({ knowledge_level: next }).eq('id', profileId)

  return NextResponse.json({ ok: true, level: next, previousLevel: level, changed: next !== level })
}
