// lib/game/knowledge/sourceKey.ts
// Pseudonymer Schlüssel für die Quelle einer Aussage. Damit lassen sich
// unabhängige Quellen zählen, auch nachdem ein Konto gelöscht wurde und die
// Spieler-ID nicht mehr existiert (06.11.2026: Biografie der Figuren bleibt).
import { createHash } from 'node:crypto'

export function claimSourceKey(profileId: string): string {
  return createHash('sha256').update(String(profileId)).digest('hex')
}
