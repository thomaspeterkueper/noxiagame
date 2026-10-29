// app/api/game/knowledge/route.ts
// Erstellt:     20.06.2026
// Aktualisiert: 31.08.2026 — SSF-Unlock-Sync idempotent + NOXIA-Prerequisites
// Aktualisiert: 28.10.2026 — Freischaltungen auch aus NOXIAs Lernverzeichnis,
//                              wenn die SSF für ein Modul keine meldet (Kredit)
// Aktualisiert: 29.10.2026 — Abschluss nur mit bestandener Prüfung (Server bewertet die
//                              Antworten gegen die SSF), Prämie in Credits einmal je Modul
// Version:      2.8.0

import { unlocksForModule } from '@/lib/knowledge/learningCatalog'
import { fetchSsfKnowledgeModule } from '@/lib/ssfKnowledge'
import { examPremiumForModule, examRetryBlocked, parseExamAnswers, scoreExam, type ExamScore } from '@/lib/knowledge/academyExam'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveGrantableUnlocks, getMissingUnlockPrerequisites, UNLOCK_REGISTRY } from '@/lib/knowledge/unlockRegistry'

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

  // ── Modul abschließen / Unlocks synchronisieren ───────────────────────────
  // academy_completions bleibt idempotent; SSF-Unlocks werden auch bei bereits
  // abgeschlossenen Modulen erneut synchronisiert, damit Upstream-Fixes heilen.
  if (action === 'complete_module') {
    const moduleId = searchParams.get('module_id')
    if (!moduleId) return NextResponse.json({ error: 'module_id fehlt' }, { status: 400 })

    const { data: existing } = await supabase
      .from('academy_completions')
      .select('profile_id')
      .eq('profile_id', user.id)
      .eq('module_id', moduleId)
      .maybeSingle()

    const alreadyCompleted = Boolean(existing)

    // Prüfung (29.10.2026): Ohne bestandene Prüfung kein Abschluss, keine Freischaltung,
    // keine Prämie. Frühere Abschlüsse bleiben gültig; für sie werden die Freischaltungen
    // weiter abgeglichen, und wer die Prüfung nachholt, bekommt die Prämie.
    const answers = parseExamAnswers(searchParams.get('answers'))
    let exam: ExamScore | null = null
    let review: { right: boolean; explanation: string; correctOption: number | null }[] = []
    if (answers) {
      const { data: failed } = await supabase
        .from('academy_exam_attempts')
        .select('created_at')
        .eq('profile_id', user.id)
        .eq('module_id', moduleId)
        .eq('passed', false)
        .gte('created_at', new Date(Date.now() - 60 * 60_000).toISOString())
      const retry = examRetryBlocked((failed ?? []).map((r: any) => Date.parse(r.created_at)), Date.now())
      if (retry.blocked) {
        return NextResponse.json({ ok: false, error: 'exam_retry_wait', retry_in_min: retry.retryInMin,
          message: `Drei Fehlversuche – lies das Modul noch einmal. Neuer Versuch in ${retry.retryInMin} Min.` }, { status: 429 })
      }
      const mod = await fetchSsfKnowledgeModule(moduleId)
      if (!mod) return NextResponse.json({ ok: false, error: 'exam_unavailable', message: 'Die Prüfung ist gerade nicht erreichbar. Bitte später noch einmal.' }, { status: 503 })
      if (mod.assessment.length === 0) {
        return NextResponse.json({ ok: false, error: 'no_exam', message: 'Für dieses Modul gibt es noch keine Prüfung. Abschluss und Prämie folgen, sobald die SSF eine liefert.' }, { status: 409 })
      }
      exam = scoreExam(mod.assessment.map(q => q.correctOption), answers)
      // Rückmeldung je Frage. Die richtige Option zeigt der Server erst nach dem Bestehen.
      const passedNow = exam.passed
      review = mod.assessment.map((q, i) => ({
        right: answers[i] === q.correctOption,
        explanation: q.explanation || (answers[i] === q.correctOption ? 'Richtig.' : 'Noch nicht – lies den Abschnitt dazu noch einmal.'),
        correctOption: passedNow ? q.correctOption : null,
      }))
      await supabase.from('academy_exam_attempts').insert({
        profile_id: user.id, module_id: moduleId, correct: exam.correct, total: exam.total, passed: exam.passed,
      })
      if (!exam.passed) {
        return NextResponse.json({ ok: false, error: 'exam_failed', exam, review,
          message: `${exam.correct} von ${exam.total} richtig – nötig sind ${exam.needed}. Kein Abschluss, keine Prämie.` }, { status: 200 })
      }
    } else if (!alreadyCompleted) {
      return NextResponse.json({ ok: false, error: 'exam_required', message: 'Erst die Prüfung bestehen – dann gibt es Abschluss, Freischaltung und Prämie.' }, { status: 400 })
    }

    if (!alreadyCompleted) {
      await supabase.from('academy_completions').insert({
        profile_id:   user.id,
        module_id:    moduleId,
        completed_at: new Date().toISOString(),
      })
    }

    let creditsAwarded = 0
    if (exam?.passed) {
      const { data: paid, error: payErr } = await supabase.rpc('pay_academy_exam_premium', {
        p_profile_id: user.id, p_module_id: moduleId, p_amount: examPremiumForModule(moduleId),
      })
      if (payErr) console.error('[knowledge] exam premium failed:', payErr)
      creditsAwarded = Number(paid ?? 0)
    }

    const blockedUnlocks: { id: string; missingUnlocks: string[] }[] = []

    // SSF ist Content-/Mapping-Authority; NOXIA erzwingt seine eigene
    // Unlock-Hierarchie vor dem Persistieren in player_unlocks.
    // Rückfall (28.10.2026): NOXIAs Lernverzeichnis ordnet bekannte Module ihrer
    // Freischaltung zu, auch wenn die SSF für das Modul keine meldet oder nicht
    // erreichbar ist.
    const candidateIds = new Set<string>(unlocksForModule(moduleId))
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
        for (const u of ssfData.unlocks ?? []) if (u?.id) candidateIds.add(u.id)
      }
    } catch (unlockErr) {
      console.error('[knowledge] SSF unlock check failed (non-fatal):', unlockErr)
    }

    if (candidateIds.size > 0) {
      const { data: existingUnlocks } = await supabase
        .from('player_unlocks')
        .select('unlock_id')
        .eq('profile_id', user.id)

      const existingIds = new Set((existingUnlocks ?? []).map((u: any) => u.unlock_id as string))
      const resolved = resolveGrantableUnlocks([...candidateIds], existingIds)
      blockedUnlocks.push(...resolved.blocked)

      const toInsert = resolved.grantable.map(id => ({
        profile_id:    user.id,
        unlock_id:     id,
        granted_at:    new Date().toISOString(),
        source_module: moduleId,
      }))

      if (toInsert.length > 0) {
        await supabase.from('player_unlocks').insert(toInsert)
      }
    }

    // Wissenspunkte nur beim ersten Abschluss vergeben (L0=50, L1=100, L2=200)
    const level = moduleId.includes('-L0-') ? 50
                : moduleId.includes('-L1-') ? 100
                : moduleId.includes('-L2-') ? 200
                : 50

    let pointsAwarded = 0
    let newTotal: number | null = null

    if (!alreadyCompleted) {
      const { data } = await supabase.rpc('award_knowledge', {
        p_profile_id: user.id,
        p_amount:     level,
        p_reason:     `module_complete:${moduleId}`,
        p_task_id:    null,
      })
      pointsAwarded = level
      newTotal = data ?? 0
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('knowledge_points')
        .eq('id', user.id)
        .single()
      newTotal = profile?.knowledge_points ?? 0
    }

    const { data: grantedUnlocks } = await supabase
      .from('player_unlocks')
      .select('unlock_id, source_module')
      .eq('profile_id', user.id)
      .eq('source_module', moduleId)

    return NextResponse.json({
      ok: true,
      already_completed: alreadyCompleted,
      module_id:        moduleId,
      points_awarded:   pointsAwarded,
      credits_awarded:  creditsAwarded,
      exam,
      review,
      knowledge_points: newTotal ?? 0,
      unlocks_granted:  (grantedUnlocks ?? []).map((u: any) => u.unlock_id),
      unlocks_blocked:  blockedUnlocks,
    })
  }

  // ── Wissenskarte: erreichte Unlocks + direkt angrenzende, gesperrte Knoten ──
  // Bewusst keine vollständige Baum-Ansicht: ein gesperrter Knoten taucht nur
  // auf, wenn er entweder sofort erreichbar ist (alle Voraussetzungen erfüllt,
  // es fehlt nur noch die Handlung/Erfahrung selbst) oder genau eine
  // Voraussetzung fehlt ("eine Stufe weiter"). Alles Entferntere wird
  // ausgeblendet, damit die Karte nicht wie ein kompletter Tech-Baum wirkt,
  // den man erst durchschauen muss, bevor man sie nutzen kann.
  if (action === 'unlocks') {
    const { data: rows } = await supabase
      .from('player_unlocks')
      .select('unlock_id, granted_at, source_module')
      .eq('profile_id', user.id)

    const unlockedIds = new Set((rows ?? []).map((r: any) => r.unlock_id as string))

    const unlocked = (rows ?? []).map((r: any) => {
      const def = UNLOCK_REGISTRY[r.unlock_id]
      return {
        id: r.unlock_id,
        label: def?.label ?? r.unlock_id,
        tier: def?.tier ?? null,
        grants: def?.grants ?? [],
        grantedAt: r.granted_at,
        sourceModule: r.source_module,
      }
    })

    const frontier = Object.values(UNLOCK_REGISTRY)
      .filter(def => !unlockedIds.has(def.id))
      .map(def => ({
        id: def.id,
        label: def.label,
        scope: def.scope,
        tier: def.tier,
        grants: def.grants,
        missingUnlocks: getMissingUnlockPrerequisites(def.id, unlockedIds).map(id => ({
          id,
          label: UNLOCK_REGISTRY[id]?.label ?? id,
        })),
      }))
      .filter(entry => entry.missingUnlocks.length <= 1)

    return NextResponse.json({ unlocked, frontier })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 })
}
