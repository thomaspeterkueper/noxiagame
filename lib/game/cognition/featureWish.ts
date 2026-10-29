// lib/game/cognition/featureWish.ts
// Erstellt:     29.10.2026
// Aktualisiert: 29.10.2026 — Hinweise auf fehlende Funktionen aus Spielersätzen
// Version:      1.0.0
//
// Rein, ohne DB. Wunsch Thomas (29.10.2026): „wenn jemand sagt, ich kann dies oder
// das nicht machen, dann ist es ein Hinweis, dass vielleicht eine Funktion fehlt.“
// Erkannt wird nur der Hinweis. Ob daraus etwas wird, entscheidet die Prüfung in
// docs/reviews/spielerwuensche.md (Spielidee, Ethik, Spielraum) – nie dieser Code.

export type FeatureWishKind =
  | 'blocked'   // „ich kann hier nicht …“, „geht nicht“
  | 'missing'   // „gibt es hier kein …“
  | 'wish'      // „ich möchte …“, „ich will …“
  | 'seeking'   // „ich suche …“, „wo kann ich …“, „wo ist …“
  | 'how_to'    // „kann ich hier …?“, „wie kann man …“

export type FeatureWish = {
  kind: FeatureWishKind
  /** Worum es geht, klein geschrieben, ohne Füllwörter (höchstens 6 Wörter). */
  object: string
  /** Die Figur hat verneint („gibt es hier nicht“, „geht leider nicht“). */
  npcDenied: boolean
}

const FILLER = new Set([
  'hier', 'mal', 'denn', 'doch', 'eigentlich', 'bitte', 'gern', 'gerne', 'auch', 'noch', 'schon', 'einfach',
  'irgendwo', 'irgendwie', 'jetzt', 'gerade', 'so', 'ja', 'nur', 'etwas', 'was', 'ein', 'eine', 'einen', 'einem',
  'einer', 'eines', 'der', 'die', 'das', 'den', 'dem', 'des', 'kein', 'keine', 'keinen', 'nicht', 'nirgends',
  'leider', 'für', 'fur', 'auf', 'zum', 'zur', 'und', 'dass', 'mussen', 'müssen',
  'man', 'ich', 'du', 'wir', 'mir', 'mich', 'dir', 'dich', 'uns', 'es', 'da', 'dort', 'bei', 'euch', 'ihr',
])

// Begrüßung, Neuigkeiten und Höflichkeit sind kein Hinweis auf eine Funktion.
const SMALLTALK = /\b(neues|neuigkeiten|wie geht|getr[aä]umt|danke|tsch[uü]ss|hallo|moin)\b/i

function cleanObject(raw: string): string {
  const words = raw.toLowerCase()
    .replace(/[^a-zäöüß0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !FILLER.has(w))
  return words.slice(0, 6).join(' ')
}

const PATTERNS: Array<{ kind: FeatureWishKind; re: RegExp }> = [
  { kind: 'blocked', re: /\b(?:ich|man)\s+kann\s+(?:hier\s+|da\s+|dort\s+)?(?:nicht|nirgends|kein\w*)\s+(.+)/i },
  { kind: 'blocked', re: /\b(?:ich|man)\s+kann\s+(.+?)\s+nicht\b/i },
  { kind: 'blocked', re: /\b(.{3,60}?)\s+geht\s+(?:hier\s+)?(?:nicht|gar nicht|nie)\b/i },
  { kind: 'blocked', re: /\bwarum\s+kann\s+(?:ich|man)\s+(?:hier\s+)?(?:nicht|kein\w*)\s+(.+)/i },
  { kind: 'blocked', re: /\bwarum\s+kann\s+(?:ich|man)\s+(.+?)\s+nicht\b/i },
  { kind: 'missing', re: /\bgibt\s+es\s+(?:hier\s+|da\s+|bei\s+euch\s+)?(?:kein\w*|nirgends)\s+(.+)/i },
  { kind: 'missing', re: /\bes\s+gibt\s+(?:hier\s+)?(?:kein\w*)\s+(.+)/i },
  { kind: 'missing', re: /\bhier\s+(?:ist|sind|gibt es)\s+zu\s+wenig\s+(.+)/i },
  { kind: 'seeking', re: /\bich\s+suche\s+(.+)/i },
  { kind: 'seeking', re: /\bwo\s+(?:kann|könnte)\s+(?:ich|man)\s+(.+)/i },
  { kind: 'seeking', re: /\bwo\s+(?:ist|sind|finde ich|gibt es)\s+(.+)/i },
  { kind: 'how_to', re: /\bwie\s+kann\s+(?:ich|man)\s+(.+)/i },
  { kind: 'how_to', re: /^(?:und\s+)?(?:kann|darf)\s+(?:ich|man)\s+(.+)\?/i },
  { kind: 'how_to', re: /\bgibt\s+es\s+(?:hier\s+)?(?:eine?n?|irgendwo)\s+(.+)\?/i },
  { kind: 'wish', re: /\bich\s+(?:m(?:ö|o|oe)chte|will|w(?:ü|u|ue)rde\s+gerne?|h(?:ä|a|ae)tte\s+gerne?|wollte)\s+(.+)/i },
  { kind: 'wish', re: /\bwir\s+m(?:ü|u|ue)ssen\s+(.+)/i },
]

const NPC_DENIAL = /\b(gibt es (hier |bei uns )?(nicht|kein\w*)|haben wir (hier )?(nicht|kein\w*)|geht (hier |leider )?nicht|kann (ich )?(dir|hier) (leider )?(nicht|kein\w*)|wird (hier )?nicht|leider nicht|tut mir leid|nicht möglich|weiß ich (nicht|kein\w*)|keine ahnung)\b/i

/** Hinweis auf eine Funktion, die ein Spieler sucht oder vermisst – oder null. */
export function detectFeatureWish(playerText: string, npcReply?: string | null): FeatureWish | null {
  const text = (playerText ?? '').trim()
  if (text.length < 6 || text.length > 400) return null
  if (SMALLTALK.test(text) && !/\b(kann|suche|gibt es kein|geht nicht|möchte|will)\b/i.test(text)) return null
  for (const { kind, re } of PATTERNS) {
    const match = text.match(re)
    if (!match) continue
    const object = cleanObject(match[1] ?? '')
    if (object.length < 3) continue
    return { kind, object, npcDenied: Boolean(npcReply && NPC_DENIAL.test(npcReply)) }
  }
  return null
}
