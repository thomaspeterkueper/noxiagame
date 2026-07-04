// service.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; Service-Role-Client
// Version:      0.1.0
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}