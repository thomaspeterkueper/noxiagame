// lib/supabase/client.ts
// Erstellt: 30.05.2026
// Aktualisiert: 24.08.2026
// Version:  1.1.0
//
// v1.1.0: BUGFIX Speicherleck. createClient() erzeugte bei JEDEM Aufruf einen
// neuen createBrowserClient()-Client. Jeder Client startet intern einen
// eigenen Auto-Refresh-Timer fürs Auth-Token sowie visibilitychange-/Storage-
// Event-Listener — keiner davon wurde je abgebaut. An Stellen mit häufigen
// Aufrufen (v.a. SchoolOverlay.tsx: 4× pro Aufgaben-Zyklus, KursRenderer.tsx:
// 2×) akkumulierten sich dadurch über eine Sitzung hinweg beliebig viele nie
// beendete Clients — Haupt-Thread/Speicher wuchsen bis zum Tab-Absturz
// ("This page couldn't load" ohne jeden JS- oder Netzwerkfehler, da der Leck
// unabhängig von Rendering/Server ist). Fix: echtes Singleton — ein Client
// pro Browser-Tab, wiederverwendet statt neu erzeugt.

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
