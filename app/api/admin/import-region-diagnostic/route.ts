import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

const IMPORT_SECRET_SHA256 = '6e7d71b3bd360c945d18f8a3c20d596739049d97736455dda6980c95856d4e8d'

function authorized(secret: string | null) {
  if (!secret) return false
  const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'))
  const expected = Buffer.from(IMPORT_SECRET_SHA256)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function jwtRole(token: string | undefined) {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return 'non-jwt'
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof parsed.role === 'string' ? parsed.role : null
  } catch {
    return 'unreadable'
  }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-noxia-admin-secret') ?? req.nextUrl.searchParams.get('secret')
  if (!authorized(secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  let supabaseHost: string | null = null
  let projectRef: string | null = null
  try {
    supabaseHost = rawUrl ? new URL(rawUrl).hostname : null
    projectRef = supabaseHost?.split('.')[0] ?? null
  } catch {}

  return NextResponse.json({
    ok: true,
    projectRef,
    supabaseHost,
    serviceKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceKeyRole: jwtRole(process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
}
