// lib/supabase/auth.ts
// Erstellt:     15.06.2026
// Aktualisiert: 15.06.2026
//
// Browser-Auth-Helfer rund um die Supabase-Session. EINE Quelle statt
// kopierter getToken-Definitionen in den Dashboard-Komponenten.
//
// Bearer-Pattern: Die Game-API-Routen erwarten ein Bearer-Token im
// Authorization-Header (Workaround für den Next-16-Turbopack-Bug, der den
// Auth-Header des direkten Supabase-Browser-Clients verschluckt). Diese
// Helfer holen das Token aus der aktuellen Session und nutzen dafür die
// bestehende createClient()-Factory — kein erneutes Instanziieren mit Env-Vars.

import { createClient } from './client'

// Bearer-Token der aktuellen Browser-Session (null, wenn nicht eingeloggt).
export async function getToken(): Promise<string | null> {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? null
}

// Token + User-ID aus EINEM getSession-Aufruf — für Aufrufer, die beides
// brauchen (z.B. fetchBuilds: Token für den Header, userId für den
// Eigentums-Check im Grid). userId ist '' wenn nicht eingeloggt.
export async function getSessionInfo(): Promise<{ token: string | null; userId: string }> {
  const { data: { session } } = await createClient().auth.getSession()
  return {
    token:  session?.access_token ?? null,
    userId: session?.user?.id ?? '',
  }
}
