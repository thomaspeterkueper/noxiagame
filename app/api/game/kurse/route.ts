// app/api/game/kurse/route.ts
// Erstellt:     23.06.2026
// Aktualisiert: 19.09.2026 — idempotenter Kursabschluss
// Version:      1.4.0
//
// GET /api/game/kurse                    → alle publizierten Kurse + Fortschritt
// GET /api/game/kurse?id=kurs_01_...     → Kurs mit Folien
// GET /api/game/kurse?action=complete    → Kurs abschliessen

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  // Kurse sind public lesbar — Auth nur für Fortschritt + Abschluss nötig
  const user = await getUser(req)

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const id     = searchParams.get('id')
  const action = searchParams.get('action')

  // ── Kurs abschliessen (Auth required) ──────────────────────────────────────
  if (action === 'complete') {
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const kursDbId = searchParams.get('kurs_db_id')
    if (!kursDbId) return NextResponse.json({ error: 'kurs_db_id fehlt' }, { status: 400 })

    // Punkte werden serverseitig aus foundation_kurse gelesen und atomar nur
    // beim ersten bestandenen Abschluss vergeben. Ein Client kann die Höhe
    // nicht mehr beeinflussen und Wiederholungen können keine Punkte farmen.
    const { data: completion, error } = await supabase.rpc('complete_foundation_course', {
      p_profile_id: user.id,
      p_course_id: kursDbId,
    })

    if (error) {
      const status = error.message?.includes('course_not_found') ? 404 : 500
      return NextResponse.json({ error: 'course_completion_failed' }, { status })
    }

    return NextResponse.json({
      ok: true,
      punkte: Number(completion?.points_awarded ?? 0),
      coursePoints: Number(completion?.course_points ?? 0),
      alreadyCompleted: Boolean(completion?.already_completed),
      knowledgePoints: Number(completion?.knowledge_points ?? 0),
    })
  }

  // ── Einzelner Kurs mit Folien ─────────────────────────────────────────────
  // Lookup by either the legacy kurs_id slug or the canonical kg_path_id
  // (PATH:SSF:*/PATH:NOXIA:*) - additive, NOX-0008 follow-up. Callers that
  // already pass a kurs_id keep working unchanged; anything holding a
  // canonical id from the Knowledge Graph's records.learning_paths can now
  // use it directly instead of needing NOXIA's local slug.
  if (id) {
    const isCanonical = id.startsWith('PATH:')
    let query = supabase
      .from('foundation_kurse')
      .select('*, foundation_folien(*)')
      .eq('published', true)
    query = isCanonical ? query.eq('kg_path_id', id) : query.eq('kurs_id', id)
    const { data: kurs } = await query.single()

    if (!kurs) return NextResponse.json({ error: 'Kurs nicht gefunden' }, { status: 404 })

    // Fortschritt laden (nur wenn eingeloggt)
    let fortschritt = null
    if (user) {
      const { data: f } = await supabase
        .from('kurs_fortschritt')
        .select('*')
        .eq('profile_id', user.id)
        .eq('kurs_id', kurs.id)
        .maybeSingle()
      fortschritt = f
    }

    // Folien sortieren
    const folien = (kurs.foundation_folien ?? [])
      .sort((a: any, b: any) => a.position - b.position)

    return NextResponse.json({ kurs: { ...kurs, foundation_folien: folien }, fortschritt: fortschritt ?? null })
  }

  // ── Alle Kurse + Fortschritt + Voraussetzungen ────────────────────────────
  const { data: kurse } = await supabase
    .from('foundation_kurse')
    .select('id, kurs_id, kg_path_id, titel, untertitel, niveau, thema, thema_farbe, dauer_min, punkte, sort_order')
    .eq('published', true)
    .order('sort_order')

  if (!kurse) return NextResponse.json({ kurse: [] })

  // Fortschritt für alle Kurse
  let fortschritte: any[] = []
  if (user) {
    const { data: fs } = await supabase
      .from('kurs_fortschritt')
      .select('kurs_id, abgeschlossen_at, letzte_folie, quiz_bestanden')
      .eq('profile_id', user.id)
    fortschritte = fs ?? []
  }

  // Voraussetzungen
  const { data: voraussetzungen } = await supabase
    .from('kurs_voraussetzungen')
    .select('kurs_id, benoetigt_id')

  const fortschrittMap = Object.fromEntries(
    (fortschritte ?? []).map((f: any) => [f.kurs_id, f])
  )

  // Abgeschlossene Kurse (UUIDs)
  const abgeschlossen = new Set(
    (fortschritte ?? [])
      .filter((f: any) => f.quiz_bestanden)
      .map((f: any) => f.kurs_id)
  )

  // Freigeschaltet-Check
  const freigeschaltet = (kursId: string): boolean => {
    const kurs = kurse.find((k: any) => k.id === kursId)
    if (!kurs) return false
    const prereqs = (voraussetzungen ?? []).filter((v: any) => v.kurs_id === kursId)
    return prereqs.every((v: any) => abgeschlossen.has(v.benoetigt_id))
  }

  const result = kurse.map((k: any) => ({
    ...k,
    fortschritt:     fortschrittMap[k.id] ?? null,
    freigeschaltet:  freigeschaltet(k.id),
    abgeschlossen:   abgeschlossen.has(k.id),
  }))

  return NextResponse.json({ kurse: result })
}
