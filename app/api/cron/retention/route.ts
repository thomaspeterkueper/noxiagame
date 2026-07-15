// app/api/cron/retention/route.ts
// Erstellt:     15.07.2026
// Aktualisiert: 15.07.2026 — Initiale Version
// Version:      1.0.0
//
// EXT-ECO-NOXIA-20260712-001 — Retention-Löschjob
// Läuft täglich um 03:00 UTC.
//
// Regel 1: Inaktive Konten > 6 Monate → löschen
//   Quelle: auth.users.last_sign_in_at
//   Kaskade: ON DELETE CASCADE löscht profiles, ships, player_builds etc.
//
// Regel 2: Unbestätigte E-Mails > 1 Monat → löschen
//   Quelle: auth.users.email_confirmed_at IS NULL AND created_at < now() - 1 month
//
// TROCKENMODUS: Erster Lauf loggt nur — löscht nicht.
// Aktivierung: DRY_RUN=false in Vercel Environment Variables setzen.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CRON_SECRET_HEADER } from '@/lib/game/config'

const DRY_RUN = process.env.RETENTION_DRY_RUN !== 'false'

export async function GET(req: NextRequest) {
  if (req.headers.get(CRON_SECRET_HEADER) !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()
  const oneMonthAgo  = new Date(now.getTime() - 1 * 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── Regel 1: Inaktive Konten > 6 Monate ──────────────────────────────────
  const { data: inactiveUsers, error: inactiveErr } = await supabase.auth.admin.listUsers()

  if (inactiveErr) {
    console.error('[retention] listUsers error:', inactiveErr)
    return NextResponse.json({ error: 'listUsers failed', detail: inactiveErr.message }, { status: 500 })
  }

  const users = inactiveUsers?.users ?? []

  const toDeleteInactive = users.filter(u =>
    u.last_sign_in_at && u.last_sign_in_at < sixMonthsAgo
  )

  const toDeleteUnconfirmed = users.filter(u =>
    !u.email_confirmed_at && u.created_at < oneMonthAgo
  )

  console.log(`[retention] dry_run=${DRY_RUN} inactive=${toDeleteInactive.length} unconfirmed=${toDeleteUnconfirmed.length}`)

  if (DRY_RUN) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      would_delete_inactive:    toDeleteInactive.length,
      would_delete_unconfirmed: toDeleteUnconfirmed.length,
      inactive_ids:    toDeleteInactive.map(u => u.id).slice(0, 10),
      unconfirmed_ids: toDeleteUnconfirmed.map(u => u.id).slice(0, 10),
    })
  }

  // ── Löschen (nur wenn DRY_RUN=false) ─────────────────────────────────────
  let deletedInactive = 0
  let deletedUnconfirmed = 0
  const errors: string[] = []

  for (const u of toDeleteInactive) {
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) {
      errors.push(`inactive:${u.id}: ${error.message}`)
    } else {
      deletedInactive++
    }
  }

  for (const u of toDeleteUnconfirmed) {
    // Nicht nochmal löschen wenn bereits als inaktiv gelöscht
    if (toDeleteInactive.find(i => i.id === u.id)) continue
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) {
      errors.push(`unconfirmed:${u.id}: ${error.message}`)
    } else {
      deletedUnconfirmed++
    }
  }

  console.log(`[retention] deleted inactive=${deletedInactive} unconfirmed=${deletedUnconfirmed} errors=${errors.length}`)

  return NextResponse.json({
    ok: true,
    dry_run: false,
    deleted_inactive:    deletedInactive,
    deleted_unconfirmed: deletedUnconfirmed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
