// app/api/game/knowledge/route.ts
// Erstellt:     20.06.2026
// Aktualisiert: 19.07.2026 — sync_from_ssf: neue SSF /api/noxia/completion API
// Version:      2.4.0

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getUserFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// Stufen-Definition (spiegelt Migration 020)
const LEVELS = [
  { level: 1, title: 'Lehrling',        min: 0,     max: 99,    color: '#7c8590' },
  { level: 2, title: 'Händler',         min: 100,   max: 499,   color: '#c9a961' },
  { level: 3, title: 'Navigator',       min: 500,   max: 1999,  color: '#2f86c9' },
  { level: 4, title: 'Ingenieur',       min: 2000,  max: 4999,  color: '#6fcf97' },
  { level: 5, title: 'Wissenschaftler', min: 5000,  max: 9999,  color: '#b48ce8' },
  { level: 6, title: 'Pionier',         min: 10000, max: null,  color: '#e8702a' },
]

function getLevel(points: number) {
  return LEVELS.find(l => points >= l.min && (l.max === null || points <= l.max)) ?? LEVELS[0]
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // ── Punkte + Level + Daily-Status laden ───────────────────────────────────
  if (!action) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('knowledge_points')
      .eq('id', user.id)
      .single()

    const points = profile?.knowledge_points ?? 0
    const level  = getLevel(points)
    const next   = LEVELS.find(l => l.level === level.level + 1) ?? null

    // Tagesaufgabe Status
    const today = new Date().toISOString().split('T')[0]
    const { data: daily } = await supabase
      .from('daily_tasks')
      .select('completed, points_earned')
      .eq('profile_id', user.id)
      .eq('task_date', today)
      .maybeSingle()

    return NextResponse.json({
      knowledge_points: points,
      level: {
        ...level,
        pointsToNext: next ? next.min - points : null,
        progress: next
          ? Math.round(((points - level.min) / (next.min - level.min)) * 100)
          : 100,
      },
      daily: {
        completed:    daily?.completed ?? false,
        pointsEarned: daily?.points_earned ?? null,
        available:    !daily?.completed,
      },
    })
  }

  // ── Punkte vergeben ───────────────────────────────────────────────────────
  if (action === 'award') {
    const points   = parseInt(searchParams.get('points') ?? '0', 10)
    const reason   = searchParams.get('reason') ?? 'school_task'
    const isDaily  = searchParams.get('daily') === 'true'

    if (points <= 0 || points > 200) {
      return NextResponse.json({ error: 'Ungültige Punktzahl' }, { status: 400 })
    }

    // Rate-Limit: max 10 normale Aufgaben/Stunde
    if (!isDaily) {
      const { count } = await supabase
        .from('knowledge_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', user.id)
        .eq('reason', 'school_task')
        .gte('created_at', new Date(Date.now() - 3600_000).toISOString())

      if ((count ?? 0) >= 10) {
        return NextResponse.json({
          error: 'Stundenlimit erreicht — komm später wieder.',
        }, { status: 429 })
      }
    }

    // Tagesaufgabe: prüfen ob heute schon erledigt
    if (isDaily) {
      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('daily_tasks')
        .select('completed')
        .eq('profile_id', user.id)
        .eq('task_date', today)
        .maybeSingle()

      if (existing?.completed) {
        return NextResponse.json({ error: 'Tagesaufgabe bereits erledigt.' }, { status: 400 })
      }

      // Tagesaufgabe als erledigt markieren
      await supabase.from('daily_tasks').upsert({
        profile_id:    user.id,
        task_date:     today,
        completed:     true,
        points_earned: points,
      }, { onConflict: 'profile_id,task_date' })
    }

    const { data: newTotal } = await supabase.rpc('award_knowledge', {
      p_profile_id: user.id,
      p_amount:     points,
      p_reason:     reason,
      p_task_id:    null,
    })

    const level = getLevel(newTotal ?? 0)

    return NextResponse.json({
      knowledge_points: newTotal ?? 0,
      awarded: points,
      level,
    })
  }

  // ── Modul abschließen ────────────────────────────────────────────────────
  // Schreibt academy_completions + vergibt knowledge_points
  if (action === 'complete_module') {
    const moduleId = searchParams.get('module_id')
    if (!moduleId) return NextResponse.json({ error: 'module_id fehlt' }, { status: 400 })

    // Doppelt-Abschluss verhindern
    const { data: existing } = await supabase
      .from('academy_completions')
      .select('profile_id')
      .eq('profile_id', user.id)
      .eq('module_id', moduleId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, already_completed: true, module_id: moduleId })
    }

    // Modul als abgeschlossen markieren
    await supabase.from('academy_completions').insert({
      profile_id:   user.id,
      module_id:    moduleId,
      completed_at: new Date().toISOString(),
    })

    // ── Schritt 3: SSF fragen welche Unlocks dieses Modul gewährt ──────────
    // Non-blocking: Fehler hier sollen den Modul-Abschluss nicht blockieren
    try {
      const ssfBase = (process.env.SSF_BASE_URL ?? 'https://solarsciencefoundation.vercel.app').replace(/\/$/, '')
      const ssfRes = await fetch(`${ssfBase}/api/noxia/unlocks/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.NOXIA_API_KEY ? { 'X-NOXIA-API-KEY': process.env.NOXIA_API_KEY } : {}),
        },
        body: JSON.stringify({ completedModules: [moduleId] }),
      })
      if (ssfRes.ok) {
        const ssfData = await ssfRes.json() as { unlocks?: { id: string }[] }
        const newUnlocks = ssfData.unlocks ?? []
        if (newUnlocks.length > 0) {
          // Bereits vorhandene Unlocks für diesen User laden
          const { data: existingUnlocks } = await supabase
            .from('player_unlocks')
            .select('unlock_id')
            .eq('profile_id', user.id)
          const existingIds = new Set((existingUnlocks ?? []).map((u: any) => u.unlock_id))
          // Nur neue Unlocks eintragen
          const toInsert = newUnlocks
            .filter((u: { id: string }) => !existingIds.has(u.id))
            .map((u: { id: string }) => ({
              profile_id:    user.id,
              unlock_id:     u.id,
              granted_at:    new Date().toISOString(),
              source_module: moduleId,
            }))
          if (toInsert.length > 0) {
            await supabase.from('player_unlocks').insert(toInsert)
          }
        }
      }
    } catch (unlockErr) {
      console.error('[knowledge] SSF unlock check failed (non-fatal):', unlockErr)
    }

    // Wissenspunkte vergeben (L0=50, L1=100, L2=200)
    const level = moduleId.includes('-L0-') ? 50
                : moduleId.includes('-L1-') ? 100
                : moduleId.includes('-L2-') ? 200
                : 50

    const { data: newTotal } = await supabase.rpc('award_knowledge', {
      p_profile_id: user.id,
      p_amount:     level,
      p_reason:     `module_complete:${moduleId}`,
      p_task_id:    null,
    })

    // Unlocks für Response laden
    const { data: grantedUnlocks } = await supabase
      .from('player_unlocks')
      .select('unlock_id, source_module')
      .eq('profile_id', user.id)
      .eq('source_module', moduleId)

    return NextResponse.json({
      ok: true,
      module_id:        moduleId,
      points_awarded:   level,
      knowledge_points: newTotal ?? 0,
      unlocks_granted:  (grantedUnlocks ?? []).map((u: any) => u.unlock_id),
    })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
