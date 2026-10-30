// lib/game/cognition/conversationActions.ts
// Aktualisiert: 30.10.2026 — Aktionsmarker und Zustimmung aus dem NPC-Gespräch (#566)
// Version:      1.0.0
//
// Modelltext ist untrusted. Marker aus der Modellantwort sind nur ein Wunsch der Figur;
// ausgeführt wird eine Weltaktion erst bei erkennbarer, nicht verneinter Zustimmung des Spielers.
// Berechtigungen (Geld, Eigentum) hängen niemals an diesem Pfad.

export const LEAD_WALK_MARKER = '[[ACTION:LEAD_WALK]]'
export const VISIT_PLACE_ACTION_RE = /\[\[ACTION:VISIT_PLACE:(p\d{1,2})\]\]/g
// Jede [[ACTION:…]]-Form wird aus dem sichtbaren Text entfernt, auch unbekannte oder
// mit Unicode-Klammern/Leerraum getarnte Marker.
const ANY_ACTION_MARKER_RE = /[\[［]\s*[\[［]\s*ACTION\b[^\]］]*[\]］]\s*[\]］]/gi

const CONSENT_RE = /\b(ja|gern|gerne|okay|ok|los|folge|folgen|bleibe|bleiben|komm|komme|gehen wir|machen wir)\b/i
const NEGATION_RE = /\b(nein|nicht|nie|niemals|kein|keine|keinen|ungern|lieber nicht|auf keinen fall)\b/i

export function playerConsentsToFollow(player: string): boolean {
  const text = player.normalize('NFKC').toLocaleLowerCase('de-DE')
  return CONSENT_RE.test(text) && !NEGATION_RE.test(text)
}

export function parseActionMarkers(rawReply: string): { leadWalk: boolean; visitPlaceKey: string | null } {
  const visit = [...rawReply.matchAll(VISIT_PLACE_ACTION_RE)][0]?.[1] ?? null
  return { leadWalk: rawReply.includes(LEAD_WALK_MARKER), visitPlaceKey: visit }
}

export function stripActionMarkers(rawReply: string): string {
  return rawReply.replace(ANY_ACTION_MARKER_RE, '')
}
