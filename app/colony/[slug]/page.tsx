// app/colony/[slug]/page.tsx
// Server Component — kein DashboardClient-Kontext, vollständig autark
//
// FIX 09.06.2026:
//   Öffentliche Kolonie-Daten über den Service-Client lesen (wie die API-Route
//   /api/game/colony), NICHT über den anon-/Cookie-Client. Der anon-Pfad
//   unterlag RLS und lieferte error → notFound() → 404, obwohl die Daten da
//   sind. Die Session kommt weiter vom Cookie-Client (nur für currentUserId/
//   Token), jetzt in try/catch — die öffentliche Ansicht rendert auch ohne Login.
//
// Frühere Fixes:
//   - server.ts exportiert createClient (async), nicht createServerClient.
//   - Next.js 16: params ist ein Promise und muss awaited werden.

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ColonyView from './ColonyView'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  return {
    title: `${slug.charAt(0).toUpperCase() + slug.slice(1)} — Noxia`,
  }
}

export default async function ColonyPage({ params }: Props) {
  const { slug } = await params

  // Öffentliche Kolonie-Daten über den Service-Client (umgeht RLS, wie die API).
  const service = createServiceClient()
  const { data: location, error } = await service
    .from('locations')
    .select('id, name, slug, population, population_max, governor_profile_id')
    .eq('slug', slug)
    .single()

  if (error || !location) notFound()

  // Session separat über den Cookie-Client — nur für currentUserId/Token.
  // Gekapselt: scheitert das (kein Login, kein Cookie), bleibt die Ansicht
  // öffentlich nutzbar statt zu 404en.
  let currentUserId: string | null = null
  let accessToken:  string | null = null
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    currentUserId = session?.user?.id ?? null
    accessToken   = session?.access_token ?? null
  } catch {
    // nicht eingeloggt — Colony View ist öffentlich
  }

  return (
    <ColonyView
      slug={slug}
      initialLocation={location}
      currentUserId={currentUserId}
      accessToken={accessToken}
    />
  )
}
