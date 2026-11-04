import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'

export const dynamic = 'force-dynamic'

type Player = {
  id: string
  username: string
  created_at: string | null
  last_seen_at: string | null
  last_session_at: string | null
  sessions: number
  actions: number
  is_admin: boolean
}

export async function GET(req: NextRequest) {
  const id = await verifiedBearerUserId(req)
  if (!id) return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 401 })
  const db = createServiceClient()
  const { data: admin, error: adminError } = await db.from('admin_profiles')
    .select('profile_id').eq('profile_id', id).maybeSingle()
  if (adminError || !admin) return NextResponse.json({ error: 'Keine Adminberechtigung' }, { status: 403 })

  // Service credentials stay exclusively on the server. A complete account count
  // requires Auth users; a profile-only count would miss unfinished registrations.
  const authUsers: Array<{ id: string; created_at: string; last_sign_in_at?: string | null; email_confirmed_at?: string | null }> = []
  let complete = true
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return NextResponse.json({ error: 'Konten konnten nicht geladen werden' }, { status: 503 })
    const batch = data.users ?? []
    authUsers.push(...batch)
    if (batch.length < 1000) break
    if (page === 20) complete = false
  }

  const [profilesResult, sessionsResult, adminResult] = await Promise.all([
    db.from('profiles').select('id,username,created_at,last_seen_at').limit(1000),
    db.from('player_sessions').select('player_profile_id,last_at,actions').order('last_at', { ascending: false }).limit(5000),
    db.from('admin_profiles').select('profile_id'),
  ])
  if (profilesResult.error || sessionsResult.error || adminResult.error) {
    return NextResponse.json({ error: 'Spieleraktivität konnte nicht geladen werden' }, { status: 503 })
  }

  const admins = new Set((adminResult.data ?? []).map(p => p.profile_id))
  const activity = new Map<string, { last: string | null; sessions: number; actions: number }>()
  for (const session of sessionsResult.data ?? []) {
    const pid = session.player_profile_id as string
    const current = activity.get(pid) ?? { last: null, sessions: 0, actions: 0 }
    current.sessions++
    current.actions += Math.max(0, Number(session.actions ?? 0))
    if (session.last_at && (!current.last || session.last_at > current.last)) current.last = session.last_at
    activity.set(pid, current)
  }

  const authById = new Map(authUsers.map(u => [u.id, u]))
  const players: Player[] = (profilesResult.data ?? []).map(p => ({
    id: p.id, username: p.username || 'Unbenannt',
    created_at: authById.get(p.id)?.created_at ?? p.created_at ?? null,
    last_seen_at: p.last_seen_at ?? null,
    last_session_at: activity.get(p.id)?.last ?? null,
    sessions: activity.get(p.id)?.sessions ?? 0,
    actions: activity.get(p.id)?.actions ?? 0,
    is_admin: admins.has(p.id),
  }))
  const now = Date.now()
  const recent = (p: Player, minutes: number) => Boolean(p.last_session_at && now - Date.parse(p.last_session_at) >= 0 && now - Date.parse(p.last_session_at) < minutes * 60000)
  const counted = players.filter(p => !p.is_admin)
  const online = (p: Player) => Boolean(p.last_seen_at && now - Date.parse(p.last_seen_at) >= 0 && now - Date.parse(p.last_seen_at) < 120000)
  const signups = (days: number) => authUsers.filter(u => now - Date.parse(u.created_at) >= 0 && now - Date.parse(u.created_at) < days * 86400000).length
  players.sort((a, b) => (b.last_session_at ?? '').localeCompare(a.last_session_at ?? ''))

  return NextResponse.json({
    observed_at: new Date(now).toISOString(),
    definition: 'Online (2 Min.) = sichtbares Spiel-Dashboard mit aktuellem Heartbeat; Sitzungsaktivität wird separat gezählt. Keine garantierte Socket-Verbindung.',
    complete: complete && (profilesResult.data?.length ?? 0) < 1000 && (sessionsResult.data?.length ?? 0) < 5000,
    metrics: {
      registered_accounts: authUsers.length,
      player_profiles: profilesResult.data?.length ?? 0,
      registrations_24h: signups(1),
      registrations_7d: signups(7),
      registrations_30d: signups(30),
      online_2m: counted.filter(online).length,
      active_5m: counted.filter(p => recent(p, 5)).length,
      active_24h: counted.filter(p => recent(p, 1440)).length,
      active_7d: counted.filter(p => recent(p, 10080)).length,
      admins: admins.size,
      session_records: sessionsResult.data?.length ?? 0,
    },
    players,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
