import type { EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/auth/login'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))
  const supabase = await createClient()

  let error: Error | null = null

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code)
    error = result.error
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    error = result.error
  } else {
    error = new Error('Bestätigungsdaten fehlen.')
  }

  if (!error) {
    // Email confirmation establishes a Supabase session; onboarding requires
    // a fresh explicit login before entering the game.
    await supabase.auth.signOut()
    const target = next.startsWith('/auth/login') ? next : '/auth/login'
    const loginUrl = new URL(target, request.url)
    loginUrl.searchParams.set('confirmed', '1')
    return NextResponse.redirect(loginUrl)
  }

  const errorUrl = new URL('/auth/login', request.url)
  errorUrl.searchParams.set('error', 'confirmation_failed')
  return NextResponse.redirect(errorUrl)
}
