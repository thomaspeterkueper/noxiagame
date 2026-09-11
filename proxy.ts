// proxy.ts
// Erstellt:     04.07.2026
// Aktualisiert: 11.09.2026 — Vercel-Cron-Bearer-Auth auf bestehenden Cron-Header abbilden
// Version:      2.2.0
//
// Schützt /dashboard und alle Unterseiten.
// Nicht-eingeloggte Benutzer → /auth/login
// Eingeloggte auf /auth/* → /dashboard
//
// Vercel Cron sendet CRON_SECRET offiziell als
// `Authorization: Bearer <secret>`. Die bestehenden NOXIA-Cron-Routen prüfen
// historisch `x-cron-secret`. Der Proxy normalisiert ausschließlich gültige
// Vercel-Cron-Requests auf diesen bestehenden internen Header.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const requestHeaders = new Headers(request.headers)
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (
    pathname.startsWith('/api/cron/')
    && cronSecret
    && authorization === `Bearer ${cronSecret}`
  ) {
    requestHeaders.set('x-cron-secret', cronSecret)
  }

  const nextResponse = () => NextResponse.next({
    request: { headers: requestHeaders },
  })

  let supabaseResponse = nextResponse()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = nextResponse()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Nicht eingeloggt → Login (außer Auth-Seiten, API, statische Assets)
  if (!user
    && !pathname.startsWith('/auth')
    && !pathname.startsWith('/api')
    && pathname !== '/'
    && !pathname.startsWith('/_next')
    && !pathname.startsWith('/images')
  ) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Eingeloggt auf Login/Register → Dashboard
  if (user && (pathname === '/auth/login' || pathname === '/auth/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
}
