// app/api/game/learning/gates/route.ts
// Lernschwellen eines Gebäudes für den angemeldeten Spieler (NOXIA-INTERIOR-0001):
// welches Wissen das Haus verlangt oder wofür es hilft, ob der Spieler es schon
// hat (player_unlocks, academy_completions) und welches SSF-Lernmodul es öffnet.
// GET ?kind=bank

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchSsfKnowledgeModules } from '@/lib/ssfKnowledge'
import { gateStatuses, learningGatesFor } from '@/lib/game/interiors/learningGates'

export async function GET(req: NextRequest) {
  const kind = new URL(req.url).searchParams.get('kind') ?? ''
  if (learningGatesFor(kind).length === 0) return NextResponse.json({ kind, gates: [] })

  const supabase = createServiceClient()
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } }

  const [modules, progress] = await Promise.all([
    fetchSsfKnowledgeModules(),
    user
      ? Promise.all([
          supabase.from('player_unlocks').select('unlock_id').eq('profile_id', user.id),
          supabase.from('academy_completions').select('module_id').eq('profile_id', user.id),
        ]).then(([u, c]) => ({
          unlocks: (u.data ?? []).map((r: { unlock_id: string }) => r.unlock_id),
          completedModules: (c.data ?? []).map((r: { module_id: string }) => r.module_id),
        }))
      : Promise.resolve(null),
  ])

  const gates = gateStatuses(kind, progress, modules).map(s => ({
    id: s.gate.id, label: s.gate.label, unlock: s.gate.unlock, moduleTitle: s.gate.moduleTitle,
    need: s.gate.need, why: s.gate.why, open: s.open, moduleId: s.moduleId,
  }))
  return NextResponse.json({ kind, signedIn: Boolean(user), gates })
}
