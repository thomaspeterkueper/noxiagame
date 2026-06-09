// app/colony/[slug]/page.tsx
// Server Component — kein DashboardClient-Kontext, vollständig autark
//
// FIX 08.06.2026:
//   - server.ts exportiert createClient (async), nicht createServerClient.
//   - Next.js 16: params ist ein Promise und muss awaited werden.

import { createClient } from '@/lib/supabase/server'
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

  // Session serverseitig holen
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Öffentliche Kolonie-Daten direkt aus Supabase (kein API-Call nötig)
  const { data: location, error } = await supabase
    .from('locations')
    .select('id, name, slug, population, population_max, governor_profile_id')
    .eq('slug', slug)
    .single()

  if (error || !location) notFound()

  return (
    <ColonyView
      slug={slug}
      initialLocation={location}
      currentUserId={session?.user?.id ?? null}
      accessToken={session?.access_token ?? null}
    />
  )
}
