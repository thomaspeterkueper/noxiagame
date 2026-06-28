import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice('Bearer '.length)
  const { data } = await serviceClient.auth.getUser(token)
  return data.user ?? null
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await serviceClient
    .from('player_learning_progress')
    .select('*')
    .eq('profile_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ progress: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const moduleId = String(body.moduleId ?? '')
  const progressPercent = Math.max(0, Math.min(100, Number(body.progressPercent ?? 100)))
  const completed = Boolean(body.completed ?? progressPercent >= 100)
  const knowledgeAwarded = Math.max(0, Number(body.knowledgeAwarded ?? 25))

  if (!moduleId) return NextResponse.json({ error: 'moduleId fehlt' }, { status: 400 })

  const row = {
    profile_id: user.id,
    module_id: moduleId,
    progress_percent: progressPercent,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
    knowledge_awarded: completed ? knowledgeAwarded : 0,
    unlock_awarded: false,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await serviceClient
    .from('player_learning_progress')
    .upsert(row, { onConflict: 'profile_id,module_id' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (completed && knowledgeAwarded > 0) {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('knowledge_points')
      .eq('id', user.id)
      .single()

    if (profile) {
      await serviceClient
        .from('profiles')
        .update({ knowledge_points: Number(profile.knowledge_points ?? 0) + knowledgeAwarded })
        .eq('id', user.id)
    }
  }

  return NextResponse.json({ ok: true, progress: data })
}
