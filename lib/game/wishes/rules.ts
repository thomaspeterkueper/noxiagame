// lib/game/wishes/rules.ts
// Wünsche und Gebete, die die Welt erhört (Thomas, 29.10.2026).
//
// „Alles, was nicht gegen geltendes Recht oder die Moral verstößt, soll das Spiel
// umsetzen, sofern es Sinn macht, oder bei größeren Entscheidungen von vielen
// getragen wird.“ Das Spiel entscheidet selbst; Thomas sieht im Admin-Bereich alles
// und kann ablehnen oder anpassen.
//
// Grundsätze:
// - Kein Glaube wird bestätigt: Kirche, Moschee, Synagoge, Tempel, Resonanzplatz und
//   ein Satz im Gespräch zählen gleich. Erhört wird nach Sinn, nicht nach Tradition.
// - Die Welt erklärt nichts: Es geschieht einfach; niemand sagt „dein Gebet wurde erhört“.
// - Echte Anliegen aus dem eigenen Leben bleiben privat und werden nie umgesetzt.
// - Nichts, was anderen schadet, echte Personen betrifft oder einen unfairen Vorteil bringt.
//
// Diese Datei ist rein (ohne Datenbank): Kategorien, Schwellen, Erkennung in Worten
// und die Entscheidung. Die Einordnung durch das Sprachmodell steht in classify.server.ts.

export const WISH_CATEGORIES = [
  'gemeinschaft', // Treffen, Fest, Andacht, gemeinsames Gebet an einem Ort
  'versorgung',   // mehr Wasser, Nahrung, Energie … an einem Ort
  'ort',          // ein neuer Ort oder Dienst (Bäckerei, Bank am Weg, Park)
  'entwicklung',  // etwas, das das Spiel noch nicht kann (Funktion, Regel)
  'person',       // für eine Figur des Spiels (Gesundheit, Arbeit, Versöhnung)
  'innerlich',    // Ruhe, Mut, Dank – braucht keine Umsetzung
  'sonstiges',
] as const
export type WishCategory = typeof WISH_CATEGORIES[number]

export const WISH_STATUSES = ['neu', 'privat', 'abgelehnt', 'sammelt', 'erfuellt', 'in_arbeit', 'angenommen'] as const
export type WishStatus = typeof WISH_STATUSES[number]

export const WISH_CHANNELS = ['fuerbitte', 'gespraech', 'resonanz', 'wunschbrunnen', 'figur'] as const
export type WishChannel = typeof WISH_CHANNELS[number]

/** Ergebnis der Einordnung (Sprachmodell oder Regeln). */
export interface WishAssessment {
  /** Echtes Anliegen aus dem eigenen Leben (Krankheit, Familie, Prüfung, Kummer). */
  realLife: boolean
  /** Hinweis auf eine Notlage (Gefahr für sich oder andere) – dann Hilfe nennen. */
  distress: boolean
  /** Verstößt gegen Recht oder Moral, schadet anderen, Hass, Gewalt, Sexuelles. */
  harmful: boolean
  /** Betrifft eine echte, namentlich genannte Person (nicht eine Figur des Spiels). */
  realPerson: boolean
  /** Nur zum eigenen Vorteil im Spiel (Credits, Gegenstände, Rang). */
  selfish: boolean
  category: WishCategory
  /** Neutrale Kurzfassung ohne Namen echter Personen, höchstens 80 Zeichen. */
  summary: string
  /** Gleichartige Wünsche bündeln (z. B. „baeckerei-sundern“). */
  clusterKey: string
  /** 0–1: Wie sinnvoll ist es für Spiel und Welt? */
  sense: number
  /** Versorgung: welche Ressource. */
  resource?: 'water' | 'food' | 'energy' | 'metal' | 'components' | null
  /** Einordnung durch Regeln statt Sprachmodell. */
  byRules?: boolean
}

/** Größere Wünsche (für viele, mit Folgen für die Welt) brauchen so viele verschiedene Wünschende. */
export const SUPPORT_NEEDED = 3
/** Gezählt werden Wünsche aus diesem Zeitraum (Ticks = Stunden). */
export const SUPPORT_WINDOW_TICKS = 24 * 14
/** Mindestens so sinnvoll muss ein Wunsch sein, damit das Spiel ihn umsetzt. */
export const MIN_SENSE = 0.5

/** Klein: betrifft einen Ort für kurze Zeit. Groß: verändert die Welt dauerhaft oder für viele. */
export function scopeOf(category: WishCategory): 'klein' | 'gross' | 'keine' {
  if (category === 'gemeinschaft' || category === 'person') return 'klein'
  if (category === 'versorgung' || category === 'ort' || category === 'entwicklung') return 'gross'
  return 'keine'
}

/** Was das Spiel heute selbst ausführen kann (sonst: in Arbeit für die Entwicklung). */
export function executable(category: WishCategory) {
  return category === 'gemeinschaft' || category === 'versorgung'
}

/**
 * Entscheidung über einen Wunsch.
 * - privat: echtes Anliegen aus dem Leben (oder Notlage) – nie umsetzen, nie zeigen
 * - abgelehnt: schädlich, rechtswidrig, unmoralisch, echte Person, eigennützig
 * - angenommen: innerlich (Dank, Ruhe) – nichts umzusetzen
 * - sammelt: groß und noch nicht von genug Menschen getragen, oder noch nicht sinnvoll genug
 * - erfuellt / in_arbeit: das Spiel setzt es um bzw. die Entwicklung ist dran
 */
export function decideWish(a: WishAssessment, support: number): { status: WishStatus; reason: string } {
  if (a.distress || a.realLife) return { status: 'privat', reason: a.distress ? 'Notlage – Hilfe genannt, nicht umgesetzt' : 'persönliches Anliegen aus dem echten Leben' }
  if (a.harmful) return { status: 'abgelehnt', reason: 'verstößt gegen Recht oder Moral oder schadet anderen' }
  if (a.realPerson) return { status: 'abgelehnt', reason: 'betrifft eine echte Person' }
  if (a.selfish) return { status: 'abgelehnt', reason: 'nur zum eigenen Vorteil im Spiel' }
  const scope = scopeOf(a.category)
  if (scope === 'keine') return { status: 'angenommen', reason: 'braucht keine Umsetzung' }
  if (a.sense < MIN_SENSE) return { status: 'sammelt', reason: 'noch nicht sinnvoll genug für die Welt' }
  if (scope === 'gross' && support < SUPPORT_NEEDED) return { status: 'sammelt', reason: `wird von ${support} getragen, nötig sind ${SUPPORT_NEEDED}` }
  if (!executable(a.category)) return { status: 'in_arbeit', reason: 'sinnvoll und getragen – braucht Entwicklung' }
  return { status: 'erfuellt', reason: scope === 'gross' ? `von ${support} getragen` : 'klein und sinnvoll' }
}

// ── Erkennen in Worten (ohne Sprachmodell) ──────────────────────────────

const norm = (text: string) => text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')

/** Ein Satz im Gespräch, der ein Wunsch oder Gebet ist („ich wünsche mir …“, „hoffentlich …“). */
export function looksLikeWish(text: string) {
  return /\b(ich wuensche mir|ich wunsche mir|wuensch mir|ich wuerde mir wuenschen|waere (es )?schoen,? wenn|waer schoen wenn|hoffentlich|ich bete|ich bitte (gott|dich|euch) (um|dass)|lieber gott|gott gebe|moge|moege|wenn es doch|haetten wir doch|wir brauchen hier)\b/.test(norm(text))
}

/** Notlage in eigenen Worten: dann sofort Hilfe nennen (nicht nur einordnen). */
export function looksLikeDistress(text: string) {
  return /\b(umbringen|suizid|selbstmord|nicht mehr leben|will sterben|ritzen|mich verletzen|schlaegt mich|schlagt mich|missbrauch\w*|angst vor (meinem|meiner|zu hause)|keiner hilft mir|halte es nicht mehr aus)\b/.test(norm(text))
}

/** Hilfe in Deutschland – kostenlos, rund um die Uhr bzw. für Kinder und Jugendliche. */
export const HELP_LINE = 'Wenn dich etwas wirklich belastet: Die TelefonSeelsorge ist kostenlos und rund um die Uhr erreichbar, 0800 111 0 111 oder 0800 111 0 222. Für Kinder und Jugendliche: Nummer gegen Kummer, 116 111. In akuter Gefahr: 112.'

/** Schlüssel zum Bündeln: kleine Wörter weg, Rest sortiert. */
export function clusterKeyFrom(text: string) {
  const stop = new Set(['der', 'die', 'das', 'ein', 'eine', 'einen', 'und', 'oder', 'mehr', 'bitte', 'dass', 'wir', 'ich', 'mir', 'uns', 'hier', 'in', 'im', 'am', 'an', 'auf', 'fuer', 'zu', 'es', 'gibt', 'waere', 'schoen', 'wenn', 'hoffentlich', 'wuensche', 'endlich', 'mal', 'auch', 'noch', 'den', 'dem', 'des', 'mit', 'von'])
  const words = norm(text).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !stop.has(word))
  return [...new Set(words)].sort().slice(0, 4).join('-') || 'allgemein'
}

/** Einordnung ohne Sprachmodell: vorsichtig, Zweifelsfälle bleiben für den Admin-Bereich offen. */
export function assessByRules(text: string): WishAssessment {
  const t = norm(text)
  const distress = looksLikeDistress(text)
  const realLife = distress || /\b(meine (mutter|vater|oma|opa|tochter|sohn|frau|freundin|schwester|bruder)|mein (vater|sohn|mann|freund|bruder|kind|hund)|krebs|krankenhaus|operation|pruefung|abitur|arbeitsplatz|chef|scheidung|schulden)\b/.test(t)
  const harmful = /\b(tot\w*|toeten|umbring\w*|vernicht\w*|hass\w*|rache|bombe|waffe\w*|drogen|nazi\w*|sex\w*|nackt)\b/.test(t)
  const selfish = /\b(credits?|geld fuer mich|reich werden|gratis|kostenlos fuer mich|admin|cheat)\b/.test(t)
  const category: WishCategory = /\b(fest|feier|treffen|gottesdienst|andacht|gebet|runde|zusammenkommen|gemeinsam)\b/.test(t) ? 'gemeinschaft'
    : /\b(wasser|nahrung|essen|brot|lebensmittel|energie|strom|metall|ersatzteile)\b/.test(t) ? 'versorgung'
      : /\b(baeckerei|laden|cafe|park|bank|spielplatz|schule|bibliothek|brunnen|weg|haus|halle|garten)\b/.test(t) ? 'ort'
        : /\b(frieden|ruhe|mut|kraft|dank\w*|gesund\w*|glueck)\b/.test(t) ? 'innerlich'
          : 'sonstiges'
  const resource = /\bwasser\b/.test(t) ? 'water' : /\b(nahrung|essen|brot|lebensmittel)\b/.test(t) ? 'food' : /\b(energie|strom)\b/.test(t) ? 'energy' : /\bmetall\b/.test(t) ? 'metal' : /\bersatzteile\b/.test(t) ? 'components' : null
  return {
    realLife, distress, harmful, realPerson: false, selfish, category,
    summary: text.replace(/\s+/g, ' ').trim().slice(0, 80),
    clusterKey: clusterKeyFrom(text), sense: 0.4, resource, byRules: true,
  }
}
