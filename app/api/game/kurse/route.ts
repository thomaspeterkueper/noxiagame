// app/api/game/kurse/route.ts
// Erstellt:     23.06.2026
// Aktualisiert: 23.06.2026
// Version:      1.2.0 — Kurse public lesbar, Auth nur für Abschluss
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
    const punkte   = parseInt(searchParams.get('punkte') ?? '0', 10)
    if (!kursDbId) return NextResponse.json({ error: 'kurs_db_id fehlt' }, { status: 400 })

    await supabase.from('kurs_fortschritt').upsert({
      profile_id:       user.id,
      kurs_id:          kursDbId,
      abgeschlossen_at: new Date().toISOString(),
      quiz_bestanden:   true,
      punkte_verdient:  punkte,
    }, { onConflict: 'profile_id,kurs_id' })

    // Wissenspunkte vergeben
    await supabase.rpc('award_knowledge', {
      p_profile_id: user.id,
      p_amount:     punkte,
      p_reason:     'kurs_abgeschlossen',
      p_task_id:    null,
    })

    return NextResponse.json({ ok: true, punkte })
  }

  // ── Einzelner Kurs mit Folien ─────────────────────────────────────────────
  if (id) {
    const { data: kurs } = await supabase
      .from('foundation_kurse')
      .select('*, foundation_folien(*)')
      .eq('kurs_id', id)
      .eq('published', true)
      .single()

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
    .select('id, kurs_id, titel, untertitel, niveau, thema, thema_farbe, dauer_min, punkte, sort_order')
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
