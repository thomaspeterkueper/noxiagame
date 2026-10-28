// lib/game/cognition/conversationRepeat.ts
// Erstellt:     27.10.2026
// Aktualisiert: 28.10.2026 — Grenztests zählen unabhängig vom Wortlaut: ab dem dritten bricht die Figur ab (Wunsch Thomas)
// Version:      1.1.0
//
// Erkannt wird zweierlei: fast gleicher Wortlaut und dasselbe Thema in anderen
// Worten. Bestellungen, Grüße und Dank zählen nicht.
//
// Rein, ohne DB-Zugriff. Fragt ein Spieler eine Figur immer wieder fast
// dasselbe, wird die Figur erst knapper und bricht dann ab – mit einem Satz
// wie „Ich habe keine Zeit, sie hier mit dir zu vertrödeln.“ Danach weist sie
// den Spieler für eine Weile kurz ab, ohne das Sprachmodell zu fragen.

/** Ab so vielen ähnlichen früheren Fragen wird die Figur knapp. */
export const REPEAT_HINT_AT = 2
/** Ab so vielen ähnlichen früheren Fragen bricht die Figur ab. */
export const REPEAT_BREAKOFF_AT = 3
/** Ähnlichkeit, ab der zwei Fragen als „dasselbe“ gelten. */
export const SIMILARITY_THRESHOLD = 0.6
/** Wie lange die Figur nach einem Abbruch abweist (Echtzeit). */
export const BREAKOFF_COOLDOWN_MS = 10 * 60_000
/** Beim wievielten Grenztest (Beleidigung, sexuelles Anliegen) die Figur abbricht. */
export const BOUNDARY_BREAKOFF_AT = 3
/** Wie weit frühere Fragen aus dem Gedächtnis zählen (Echtzeit). */
export const REPEAT_WINDOW_MS = 30 * 60_000

const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer',
  'und', 'oder', 'aber', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mir', 'mich', 'dir', 'dich',
  'ist', 'bist', 'sind', 'bin', 'hast', 'hat', 'habe', 'haben', 'kann', 'kannst', 'gibt', 'gib',
  'mal', 'noch', 'denn', 'doch', 'auch', 'so', 'hier', 'da', 'zu', 'im', 'in', 'an', 'am', 'auf', 'mit', 'von', 'fur', 'fuer', 'was', 'wie',
  'moechte', 'mochte', 'moechtest', 'mochtest', 'will', 'willst', 'bitte', 'mach', 'machen', 'machst', 'sag', 'sage', 'mal', 'nicht', 'kein', 'keine',
  'wo', 'wer', 'wann', 'warum', 'dass', 'das', 'ob', 'nur', 'jetzt', 'ganz', 'sehr', 'aber', 'meine', 'mein', 'dein', 'deine', 'uns', 'euch',
])

/**
 * Wörter für Bestellen, Grüßen und Danken: Wer dreimal Kaffee bestellt oder
 * sich bedankt, fragt nicht im Kreis.
 */
const ROUTINE_STEMS = new Set([
  'kaff', 'wass', 'bier', 'tee', 'kuch', 'mahl', 'esse', 'getr', 'snac', 'rati', 'bezah', 'zahl', 'kost', 'cred', 'nehm', 'neue',
  'hall', 'moin', 'hell', 'hola', 'serv', 'tsch', 'dank', 'gern', 'okay', 'klar', 'gut',
])

/** Klein, ohne Umlaute und Satzzeichen, Leerzeichen vereinheitlicht. */
export function normalizeUtterance(text: string): string {
  return String(text ?? '')
    .toLocaleLowerCase('de-DE')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contentTokens(norm: string): string[] {
  return norm.split(' ').filter(token => token.length > 1 && !STOPWORDS.has(token))
}

/** Grober Wortstamm: die ersten vier Buchstaben (tanz, tanzt, tanzen → tanz). */
function stem(token: string): string {
  return token.length > 4 ? token.slice(0, 4) : token
}

/** Inhaltsstämme ohne Füllwörter und ohne Bestell- und Grußwörter. */
function topicStems(norm: string): Set<string> {
  return new Set(contentTokens(norm).filter(token => token.length >= 3).map(stem).filter(item => !ROUTINE_STEMS.has(item)))
}

function trigrams(norm: string): Set<string> {
  const padded = `  ${norm} `
  const grams = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3))
  return grams
}

function overlap<T>(a: Set<T>, b: Set<T>): number {
  let shared = 0
  for (const item of a) if (b.has(item)) shared++
  return shared
}

/**
 * 0..1: größter Wert aus Trigramm-Dice (fast gleicher Wortlaut) und
 * Überlappung der Themenstämme (dasselbe Anliegen in anderen Worten:
 * „Ich möchte Tanz sehen“ ~ „tanzt du für mich“). Ohne gemeinsames Thema
 * zählt nur der Wortlaut.
 */
export function utteranceSimilarity(a: string, b: string): number {
  const na = normalizeUtterance(a)
  const nb = normalizeUtterance(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ga = trigrams(na)
  const gb = trigrams(nb)
  const dice = (2 * overlap(ga, gb)) / (ga.size + gb.size)
  const sa = topicStems(na)
  const sb = topicStems(nb)
  const smaller = Math.min(sa.size, sb.size)
  const topic = smaller ? overlap(sa, sb) / smaller : 0
  // Ein Thema, das beide Sätze tragen, gilt als dasselbe Anliegen.
  return Math.max(sa.size && sb.size ? dice : 0, topic >= 0.5 ? Math.max(0.6, topic) : topic * 0.8)
}

/**
 * Kurze Antworten wie „ja“, „ok“, „danke“ wiederholen sich im Gespräch
 * natürlich und zählen nicht als wiederholte Frage.
 */
export function isRepeatCandidate(text: string): boolean {
  const norm = normalizeUtterance(text)
  if (norm.length < 8) return false
  return topicStems(norm).size >= 1
}

export type RepeatLevel = 'none' | 'hint' | 'breakoff'

export interface RepeatAssessment {
  level: RepeatLevel
  similarCount: number
  normalized: string
}

/** Zählt, wie oft der Spieler zuvor schon fast dasselbe gefragt hat. */
export function assessRepeat(player: string, previousPlayerTurns: ReadonlyArray<string>): RepeatAssessment {
  const normalized = normalizeUtterance(player)
  if (!isRepeatCandidate(player)) return { level: 'none', similarCount: 0, normalized }
  const similarCount = previousPlayerTurns
    .filter(isRepeatCandidate)
    .filter(prev => utteranceSimilarity(player, prev) >= SIMILARITY_THRESHOLD)
    .length
  const level: RepeatLevel = similarCount >= REPEAT_BREAKOFF_AT
    ? 'breakoff'
    : similarCount >= REPEAT_HINT_AT ? 'hint' : 'none'
  return { level, similarCount, normalized }
}

/** Anweisung an das Sprachmodell, wenn der Spieler sich zum dritten Mal wiederholt. */
export const REPEAT_HINT_INSTRUCTION =
  'Der Spieler fragt dich gerade zum wiederholten Mal fast dasselbe. Wiederhole deine frühere Antwort nicht ausführlich: Sag knapp, dass du das schon beantwortet hast, lass leichte Ungeduld spüren und frag, ob er noch etwas anderes will.'

const BREAKOFF_LINES = [
  'Ich habe keine Zeit, sie hier mit dir zu vertrödeln.',
  'Das hab ich dir jetzt oft genug gesagt. Ich hab zu tun.',
  'Wir drehen uns im Kreis. Ich muss weiter.',
  'Frag jemand anderen – ich hab dazu alles gesagt.',
]

const DISMISS_LINES = [
  'Ich sagte doch, ich habe jetzt keine Zeit.',
  'Später vielleicht. Jetzt nicht.',
  'Nicht schon wieder. Ich bin beschäftigt.',
]

function pick(lines: ReadonlyArray<string>, seed: string): string {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
  return lines[Math.abs(hash) % lines.length]
}

/** Abbruchsatz; der erste Abbruch einer Figur ist immer Thomas' Satz. */
export function breakoffLine(seed: string, priorBreakoffs: number): string {
  return priorBreakoffs <= 0 ? BREAKOFF_LINES[0] : pick(BREAKOFF_LINES, seed)
}

const BOUNDARY_BREAKOFF_LINES = [
  'Das reicht. So rede ich nicht weiter mit dir.',
  'Nein. Ich hab dir das jetzt klar gesagt – wir sind hier fertig.',
  'Lass das. Ich hab zu tun, und darüber rede ich nicht.',
]

/**
 * Grenztests (Wunsch Thomas, 28.10.2026): Wer eine Figur beleidigt oder
 * sexuell bedrängt, wechselt oft die Worte („technische Frage“), damit greift
 * die Wiederholungserkennung nicht. Gezählt wird deshalb das Anliegen, nicht
 * der Wortlaut: Ist dies der dritte Grenztest seit dem letzten Abbruch,
 * bricht die Figur ab. Die Einordnung liefert classifyConversationTopic
 * (Anliegen „provocation“); hier wird nur gezählt.
 */
export function boundaryBreakoff(currentIsBoundaryTest: boolean, previousBoundaryTests: number): boolean {
  return currentIsBoundaryTest && previousBoundaryTests + 1 >= BOUNDARY_BREAKOFF_AT
}

/** Abbruchsatz nach wiederholten Grenztests. */
export function boundaryBreakoffLine(seed: string): string {
  return pick(BOUNDARY_BREAKOFF_LINES, seed)
}

/** Kurze Abweisung während der Abkühlzeit nach einem Abbruch. */
export function dismissLine(seed: string): string {
  return pick(DISMISS_LINES, seed)
}

/** Läuft nach einem Abbruch noch die Abkühlzeit? */
export function inBreakoffCooldown(lastBreakoffAtIso: string | null | undefined, nowMs: number): boolean {
  if (!lastBreakoffAtIso) return false
  const at = Date.parse(lastBreakoffAtIso)
  return Number.isFinite(at) && nowMs - at >= 0 && nowMs - at < BREAKOFF_COOLDOWN_MS
}
