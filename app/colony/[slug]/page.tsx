// app/colony/[slug]/page.tsx
// Server Component — kein DashboardClient-Kontext, vollständig autark

import { createServerClient } from '@/lib/supabase/server'
import ColonyView from './ColonyView'
import { notFound } from 'next/navigation'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props) {
  return {
    title: `${params.slug.charAt(0).toUpperCase() + params.slug.slice(1)} — Noxia`,
  }
}

export default async function ColonyPage({ params }: Props) {
  const { slug } = params

  // Session serverseitig holen
  const supabase = createServerClient()
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
