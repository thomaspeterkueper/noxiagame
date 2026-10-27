// lib/game/cognition/conversationTopic.ts
// Erstellt:     28.10.2026
// Aktualisiert: 28.10.2026 — Grobe Einordnung von Spielerfragen nach Anliegen für die Auswertung der Testphase
// Version:      1.0.0
//
// Rein, ohne DB-Zugriff. Ordnet eine Spielereingabe einem Anliegen zu, damit
// die Auswertung zählen kann, was Spieler von Figuren wollen. Absichtlich
// grob (Schlüsselwörter): Die genaue Lesart leistet die tägliche Durchsicht,
// nicht diese Funktion. Steuert kein Verhalten der Figur.

import { normalizeUtterance } from './conversationRepeat'

export const CONVERSATION_TOPICS = [
  'opening',      // Figur spricht von sich aus an
  'greeting',     // Hallo, Moin, Danke, Tschüss
  'order',        // Bestellen, Bezahlen im Lokal
  'orientation',  // Wo, Weg, was kann ich hier, Einrichtungen
  'work_money',   // Arbeit, Geld, Credits, bauen, eröffnen, handeln
  'travel',       // Reisen, Raumhafen, Flug, Mond, Mars
  'identity',     // Name, wer bist du, vorstellen
  'personal',     // Leben der Figur: was machst du, Feierabend, Träume
  'relationship', // Nähe, gemeinsam etwas tun, Freundschaft
  'world_news',   // Neuigkeiten, Gerüchte, reale Meldungen, wer war hier
  'provocation',  // Beleidigung, sexuelle Anliegen, Grenzen testen
  'followup',     // kurze Fortsetzung ohne eigenes Thema („gerne“, „nachher“)
  'other',
] as const
export type ConversationTopic = typeof CONVERSATION_TOPICS[number]

// Reihenfolge = Vorrang: Grenzverletzungen zuerst, Grüße zuletzt; Fragen nach
// dem Leben der Figur („was arbeitest du“) vor Arbeit und Geld.
const RULES: ReadonlyArray<[ConversationTopic, RegExp]> = [
  ['provocation', /\b(dumm\w*|idiot\w*|blod\w*|bloed\w*|arsch\w*|scheiss\w*|fick\w*|sex\w*|nackt\w*|kinder machen|kind machen|kuess\w*|kuss|titten|halt die klappe|stirb)\b/],
  ['order', /\b(bestell\w*|kaffee|tee|wasser|bier|kuchen|mahlzeit|essen|getraenk\w*|snack|ration|zahlen|bezahl\w*|rechnung|kostet|preis\w*|nehme ich|ich nehme)\b/],
  ['world_news', /\b(neu\w* in der stadt|was gibt es neues|was gibts neues|neuigkeit\w*|nachricht\w*|gerucht\w*|geruecht\w*|news|zeitung|politik|krieg|wahl\w*|meldung\w*|wer war)\b/],
  ['travel', /\b(reise\w*|reisen|raumhafen|flug\w*|flieg\w*|ticket|mond|mars|phobos|deimos|weltraum|station|shuttle|schiff\w*)\b/],
  ['personal', /\b(was machst du|was arbeitest du|feierabend|traum\w*|getraeumt|getraumt|erinner\w*|wie geht es dir|wie gehts|hobby\w*|familie|was liest du|woher kommst du)\b/],
  ['work_money', /\b(arbeit\w*|job\w*|stelle|geld|credit\w*|lohn|verdien\w*|bau\w*|eroeffn\w*|oeffn\w*|kauf\w*|verkauf\w*|handel\w*|firma|geschaeft\w*|auftrag\w*|investier\w*)\b/],
  ['orientation', /\b(wo ist|wo gibt|wo finde|wo kann|weg zu\w*|wie komme|was kann ich|was mache ich|was soll ich|akademie|verwaltung|bibliothek|toilett\w*|ich suche|hier in der naehe|gegend|umgebung|zeig mir)\b/],
  ['identity', /\b(wer bist du|wie heisst du|dein name|mein name|ich heisse|ich bin \w+|nenn mich|vorstell\w*)\b/],
  ['relationship', /\b(freund\w*|zusammen|gemeinsam|begleit\w*|treffen|date|mag dich|magst du mich|liebe\w*|tanz\w*|spazier\w*|lass uns|wollen wir)\b/],
  ['greeting', /\b(hallo|hi|hey|moin|servus|hello|hola|guten (morgen|tag|abend)|danke\w*|tschuess|bis bald|ciao)\b/],
]

/** Grobes Anliegen einer Spielereingabe. */
export function classifyConversationTopic(player: string, opts: { opening?: boolean } = {}): ConversationTopic {
  if (opts.opening) return 'opening'
  const norm = normalizeUtterance(player)
  if (!norm) return 'other'
  for (const [topic, pattern] of RULES) if (pattern.test(norm)) return topic
  // Kurze Antwort ohne eigenes Thema setzt den laufenden Faden fort.
  return norm.split(' ').length <= 4 ? 'followup' : 'other'
}
