import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { DAVARU_TEMPLE_DESTINATION, resolveSharedTempleEntrance } from '@/lib/game/temple/sharedTempleAccess'
import { TEMPLE_CANONICAL_ROLES, resolveTempleCanonicalPeople } from '@/lib/game/temple/canonicalTemplePeople'
import { DAVARU_TEMPLE_INTERIOR } from '@/lib/game/buildings/interiors/templates/davaruTemple'
import { createInteriorInstance } from '@/lib/game/buildings/interiors/instances'
import { findInteriorRoute } from '@/lib/game/buildings/interiors/navigation'

const SESSION_MINUTES = 45
const template = DAVARU_TEMPLE_INTERIOR
const virtualTopology = createInteriorInstance(template, {
  id: 'virtual-route:shared-davaru-temple', buildingInstanceId: 'virtual-topology-only',
})
async function actor(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  const db = createServiceClient()
  const { data: { user }, error } = await db.auth.getUser(token)
  return error ? null : user
}
function safeRow(row: any) {
  return { destinationKey: DAVARU_TEMPLE_DESTINATION, channel: row.channel, roomId: row.room_id, expiresAt: row.expires_at }
}
export async function GET(request: NextRequest) {
  const user = await actor(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = createServiceClient()
  const { data, error } = await db.from('davaru_temple_remote_sessions')
    .select('channel, room_id, expires_at').eq('profile_id', user.id).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) return NextResponse.json({ error: 'session_unavailable' }, { status: 503 })
  // Aggregate only; never expose other visitors' account identities or locations.
  const { data: visitors, error: visitorsError } = await db.from('davaru_temple_remote_sessions')
    .select('room_id').gt('expires_at', new Date().toISOString()).limit(1000)
  if (visitorsError) return NextResponse.json({ error: 'visitor_presence_unavailable' }, { status: 503 })
  const activeVisitors = Object.fromEntries(template.rooms.map(room => [
    room.id, (visitors ?? []).filter(visitor => visitor.room_id === room.id).length,
  ]))
  const [{ data: links, error: linksError }, { data: tickRow, error: tickError }] = await Promise.all([
    db.from('person_canonical_characters')
      .select('person_id,character_key,universe_key,integration_mode,valid_from_tick,valid_until_tick')
      .eq('universe_key', 'noxia')
      .in('character_key', TEMPLE_CANONICAL_ROLES.map(role => role.characterKey)),
    db.from('tick_log').select('tick_number').order('tick_number', { ascending: false }).limit(1).maybeSingle(),
  ])
  const tickValue = Number(tickRow?.tick_number)
  const currentTick = !tickError && tickRow?.tick_number != null && Number.isSafeInteger(tickValue) ? tickValue : null
  const registeredCharacters = linksError || currentTick === null ? [] : resolveTempleCanonicalPeople(links ?? [], currentTick)
  return NextResponse.json({ session: data ? safeRow(data) : null, activeVisitors, registeredCharacters })
}
export async function POST(request: NextRequest) {
  const user = await actor(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const action = body.action
  const db = createServiceClient()
  if (action === 'leave') {
    const { error } = await db.from('davaru_temple_remote_sessions').delete().eq('profile_id', user.id)
    return error ? NextResponse.json({ error: 'session_unavailable' }, { status: 503 }) : NextResponse.json({ session: null })
  }
  if (action === 'enter') {
    const decision = resolveSharedTempleEntrance({
      channel: 'endia', destinationKey: DAVARU_TEMPLE_DESTINATION, mode: 'remote',
      authenticated: true, accessGranted: true, // server-side public virtual-entry policy; never user supplied
    })
    if (!decision.allowed) return NextResponse.json({ error: 'access_denied' }, { status: 403 })
    const now = Date.now()
    const { data, error } = await db.from('davaru_temple_remote_sessions').upsert({
      profile_id: user.id, destination_key: DAVARU_TEMPLE_DESTINATION,
      channel: 'endia', room_id: 'entrance', started_at: new Date(now).toISOString(),
      expires_at: new Date(now + SESSION_MINUTES * 60000).toISOString(),
      updated_at: new Date(now).toISOString(),
    }, { onConflict: 'profile_id' }).select('channel,room_id,expires_at').single()
    return error ? NextResponse.json({ error: 'session_unavailable' }, { status: 503 }) : NextResponse.json({ session: safeRow(data) })
  }
  if (action === 'move') {
    const target = typeof body.roomId === 'string' ? body.roomId : ''
    if (!template.rooms.some(room => room.id === target)) return NextResponse.json({ error: 'invalid_room' }, { status: 400 })
    const { data: current, error: readError } = await db.from('davaru_temple_remote_sessions')
      .select('room_id,channel,expires_at').eq('profile_id', user.id).gt('expires_at', new Date().toISOString()).maybeSingle()
    if (readError) return NextResponse.json({ error: 'session_unavailable' }, { status: 503 })
    if (!current) return NextResponse.json({ error: 'session_expired' }, { status: 403 })
    const route = findInteriorRoute(template, virtualTopology, current.room_id, target)
    if (!route || route.steps.length > 1) return NextResponse.json({ error: 'not_adjacent' }, { status: 409 })
    const { data, error } = await db.from('davaru_temple_remote_sessions').update({
      room_id: target, updated_at: new Date().toISOString(),
    }).eq('profile_id', user.id).eq('room_id', current.room_id).gt('expires_at', new Date().toISOString())
      .select('channel,room_id,expires_at').maybeSingle()
    if (error) return NextResponse.json({ error: 'session_unavailable' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'session_changed' }, { status: 409 })
    return NextResponse.json({ session: safeRow(data) })
  }
  return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
