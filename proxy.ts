// proxy.ts
// Erstellt:     04.07.2026
// Aktualisiert: 29.10.2026 — Admin-Bereich (/admin) vorläufig mit Benutzer und Passwort (HTTP Basic) geschützt
// Vorher:       11.09.2026 — Vercel-Cron-Bearer-Auth auf bestehenden Cron-Header abbilden
// Version:      2.3.0
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

// Admin-Bereich (/admin): vorläufig ein gemeinsamer Zugang „Superadmin“ (Thomas,
// 29.10.2026: „erstmal nur auf die Schnelle, später richtiger User-Login“).
// Im Code steht nur der SHA-256-Wert von „Benutzer:Passwort“, nicht das Passwort.
// Wechseln: ADMIN_BASIC_AUTH_SHA256 in Vercel setzen (überschreibt diesen Wert).
// Die Daten selbst (/api/admin/…) prüfen zusätzlich das Spielerkonto (admin_profiles).
const ADMIN_BASIC_SHA256 = '160c6c39d70c34ad16ac2dfb55b5e50c0146eec38b09030c73c88130eb059296'

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Gleich lange Hex-Werte ohne frühen Abbruch vergleichen. */
function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function adminBasicOk(request: NextRequest) {
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Basic ')) return false
  let decoded = ''
  try { decoded = atob(header.slice(6).trim()) } catch { return false }
  const expected = (process.env.ADMIN_BASIC_AUTH_SHA256 || ADMIN_BASIC_SHA256).toLowerCase()
  return sameHex(await sha256Hex(decoded), expected)
}

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

  // Admin-Seiten: erst Benutzer und Passwort, sonst nichts.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!await adminBasicOk(request)) {
      return new NextResponse('Zugang nur für Admins.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="NOXIA Admin", charset="UTF-8"', 'Cache-Control': 'no-store' } })
    }
  }

  // API routes authenticate themselves where needed. Calling Auth here as well
  // would add one /auth/v1/user request to every API request for no routing
  // benefit. Cron header normalization above still applies.
  if (
    pathname.startsWith('/api/')
    || pathname.startsWith('/audio/')
    || pathname.startsWith('/assets/')
    || pathname === '/robots.txt'
  ) {
    return nextResponse()
  }

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
