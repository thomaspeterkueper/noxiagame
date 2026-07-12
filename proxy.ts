// proxy.ts
// Erstellt:     04.07.2026
// Aktualisiert: 12.07.2026 — Umbenannt von middleware.ts (Next.js 16 Deprecation)
// Version:      1.1.0
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Nicht eingeloggt → auf Login umleiten (außer Auth-Seiten und API)
  if (!user && !pathname.startsWith('/auth') && !pathname.startsWith('/api') && pathname !== '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Eingeloggt + auf Login/Register → zum Dashboard
  if (user && (pathname === '/auth/login' || pathname === '/auth/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
}
