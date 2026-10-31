/** Authenticated owner receipts (GET); direct submissions (POST) are isolated in post.ts. No world writes.
 * The staged feedback table must exist before this endpoint can serve receipts.
 */
export { POST } from './post'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifiedBearerUserId } from '@/lib/supabase/bearer'
import { parseFeedbackReceiptLimit } from '@/lib/game/evolution/feedbackReceiptQuery'
import { projectFeedbackReceiptList } from '@/lib/game/evolution/feedbackReceiptList'

const PRIVATE = { 'Cache-Control': 'private, no-store' }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PRIVATE })

export async function GET(req: NextRequest) {
  const ownerId = await verifiedBearerUserId(req)
  if (!ownerId) return reply({ error: 'unauthorized' }, 401)

  const limit = parseFeedbackReceiptLimit(req.nextUrl.searchParams.get('limit'))
  if (limit === null) return reply({ error: 'invalid_limit' }, 400)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return reply({ error: 'feedback_unavailable' }, 503)

  // This client uses the verified caller's JWT and the anon key, NOT service_role.
  // The table's SELECT RLS policy restricts rows to auth.uid() = owner_user_id.
  // owner_user_id is intentionally not SELECT-granted to the caller; do not
  // add a .eq('owner_user_id', ...) filter, which would require extra privileges.
  const token = req.headers.get('authorization')?.slice('Bearer '.length).trim()
  if (!token) return reply({ error: 'unauthorized' }, 401)
  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  try {
    const { data, error } = await db.from('player_feedback_submissions')
      .select('id,title,status,created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('feedback receipt read failed', { code: error.code })
      return reply({ error: 'feedback_unavailable' }, 503)
    }
    const receipts = projectFeedbackReceiptList(data ?? [], limit)
    if (receipts === null) return reply({ error: 'feedback_unavailable' }, 503)
    return reply({ receipts, scope: 'own_submissions', authority: 'review_only' })
  } catch {
    return reply({ error: 'feedback_unavailable' }, 503)
  }
}
