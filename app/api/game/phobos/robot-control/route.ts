import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const YARD_X_M = 48
const YARD_Y_M = -26

type RobotAction = 'pause' | 'resume' | 'recall' | 'request-maintenance'

async function userFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  const s = createServiceClient()
  const { data: { user } } = await s.auth.getUser(token)
  return user ?? null
}

async function phobosLocation(s: ReturnType<typeof createServiceClient>) {
  const { data, error } = await s.from('locations').select('id').eq('slug', 'phobos').maybeSingle()
  if (error || !data?.id) throw new Error(error?.message ?? 'Phobos location missing')
  return data.id as string
}

async function requirePresence(s: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await s.from('profiles').select('current_location').eq('id', userId).maybeSingle()
  return data?.current_location === 'phobos'
}

async function roverYardInventory(s: ReturnType<typeof createServiceClient>, locationId: string) {
  const { data, error } = await s.from('logistics_inventories').select('id').eq('location_id', locationId).contains('metadata', { role: 'surface_rover' }).eq('active', true).limit(1).maybeSingle()
  if (error || !data?.id) throw new Error(error?.message ?? 'Phobos rover yard missing')
  return data.id as string
}

async function activeJob(s: ReturnType<typeof createServiceClient>, userId: string, locationId: string) {
  const { data, error } = await s.from('pilot_extraction_jobs').select('*').eq('profile_id', userId).eq('location_id', locationId).eq('status', 'running').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}

function fleetIds(job: any): string[] {
  const ids = Array.isArray(job?.result?.fleet_vehicle_ids) ? job.result.fleet_vehicle_ids : [job?.robot_vehicle_id]
  return ids.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const s = createServiceClient()
  if (!await requirePresence(s, user.id)) return NextResponse.json({ error: 'Robotersteuerung ist nur vor Ort auf Phobos verfügbar.' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const action = body.action as RobotAction
  const robotId = typeof body.robotId === 'string' ? body.robotId : ''
  if (!['pause', 'resume', 'recall', 'request-maintenance'].includes(action)) return NextResponse.json({ error: 'Unbekannter Steuerbefehl.' }, { status: 400 })

  try {
    const locationId = await phobosLocation(s)
    if (action === 'request-maintenance') {
      if (!robotId) return NextResponse.json({ error: 'robotId erforderlich' }, { status: 400 })
      const { data: robot, error } = await s.from('vehicle_instances').select('*').eq('id', robotId).eq('owner_profile_id', user.id).eq('location_id', locationId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!robot || robot.modifications?.surfaceHub !== 'stickney-alpha') return NextResponse.json({ error: 'Stickney-Roboter nicht gefunden.' }, { status: 404 })
      const now = new Date().toISOString()
      const { error: updateError } = await s.from('vehicle_instances').update({ emergent_state: { ...(robot.emergent_state ?? {}), maintenanceRequestedAt: now, maintenanceRequestedBy: user.id }, updated_at: now }).eq('id', robot.id)
      if (updateError) throw new Error(updateError.message)
      return NextResponse.json({ ok: true, action, robotId: robot.id, maintenanceRequestedAt: now })
    }

    const job = await activeJob(s, user.id, locationId)
    if (!job) return NextResponse.json({ error: 'Kein laufender robotischer Pilotabbau.' }, { status: 409 })
    const now = new Date()
    const result = job.result ?? {}

    if (action === 'pause') {
      if (result.control_state === 'paused') return NextResponse.json({ ok: true, action, idempotent: true, jobId: job.id })
      const completesAt = job.completes_at ? new Date(job.completes_at).getTime() : now.getTime()
      const remainingSeconds = Math.max(1, Math.ceil((completesAt - now.getTime()) / 1000))
      const nextResult = { ...result, control_state: 'paused', paused_at: now.toISOString(), remaining_seconds: remainingSeconds }
      const { error } = await s.from('pilot_extraction_jobs').update({ completes_at: '9999-12-31T23:59:59.000Z', result: nextResult, updated_at: now.toISOString() }).eq('id', job.id)
      if (error) throw new Error(error.message)
      for (const id of fleetIds(job)) {
        const { data: robot } = await s.from('vehicle_instances').select('emergent_state').eq('id', id).eq('owner_profile_id', user.id).maybeSingle()
        if (robot) await s.from('vehicle_instances').update({ emergent_state: { ...(robot.emergent_state ?? {}), controlState: 'paused', pausedAt: now.toISOString() }, updated_at: now.toISOString() }).eq('id', id)
      }
      return NextResponse.json({ ok: true, action, jobId: job.id, remainingSeconds })
    }

    if (action === 'resume') {
      if (result.control_state !== 'paused') return NextResponse.json({ ok: true, action, idempotent: true, jobId: job.id })
      const remainingSeconds = Math.max(1, Number(result.remaining_seconds ?? 1))
      const completesAt = new Date(now.getTime() + remainingSeconds * 1000).toISOString()
      const nextResult = { ...result, control_state: 'running', resumed_at: now.toISOString(), remaining_seconds: remainingSeconds }
      const { error } = await s.from('pilot_extraction_jobs').update({ completes_at: completesAt, result: nextResult, updated_at: now.toISOString() }).eq('id', job.id)
      if (error) throw new Error(error.message)
      for (const id of fleetIds(job)) {
        const { data: robot } = await s.from('vehicle_instances').select('emergent_state').eq('id', id).eq('owner_profile_id', user.id).maybeSingle()
        if (robot) await s.from('vehicle_instances').update({ emergent_state: { ...(robot.emergent_state ?? {}), controlState: 'running', resumedAt: now.toISOString() }, updated_at: now.toISOString() }).eq('id', id)
      }
      return NextResponse.json({ ok: true, action, jobId: job.id, completesAt })
    }

    const yardId = await roverYardInventory(s, locationId)
    const nextResult = { ...result, control_state: 'recalled', recalled_at: now.toISOString(), recalled_by: user.id, no_scientific_result: true }
    const { error: jobError } = await s.from('pilot_extraction_jobs').update({ status: 'failed', completed_at: now.toISOString(), result: nextResult, updated_at: now.toISOString() }).eq('id', job.id)
    if (jobError) throw new Error(jobError.message)
    for (const id of fleetIds(job)) {
      const { data: robot } = await s.from('vehicle_instances').select('emergent_state,modifications').eq('id', id).eq('owner_profile_id', user.id).maybeSingle()
      if (!robot) continue
      await s.from('vehicle_instances').update({ status: 'ready', current_node_inventory_id: yardId, emergent_state: { ...(robot.emergent_state ?? {}), controlState: 'recalled', phase: 'yard-returned', xM: YARD_X_M, yM: YARD_Y_M, recalledAt: now.toISOString() }, updated_at: now.toISOString() }).eq('id', id)
    }
    return NextResponse.json({ ok: true, action, jobId: job.id, recalled: true })
  } catch (error) {
    console.error('phobos robot control failed:', error)
    return NextResponse.json({ error: 'Roboterbefehl konnte nicht ausgeführt werden.' }, { status: 503 })
  }
}
