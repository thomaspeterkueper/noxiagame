import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function verifiedBearerUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.auth.getClaims(token)
    if (error) return null
    const sub = data?.claims?.sub
    return typeof sub === 'string' && sub.length > 0 ? sub : null
  } catch {
    return null
  }
}
