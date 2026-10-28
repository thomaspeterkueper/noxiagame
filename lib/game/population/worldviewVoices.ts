// Conversation stances for NPCs who carry a religion or a philosophy
// (NOXIA-NPC-RELIGION-0002).
//
// A stance colours *how* a person talks about meaning, ethics and faith.
// It never grants knowledge, authority or truth: every statement stays a
// conviction of this person, not world fact. Facts, grounding and memory
// rules of the conversation route apply unchanged.

import { meetingPlaceLine, OMNIZEDENZ_MEETING_PLACES } from '@/lib/worldlab/meetingPlaces'

export type WorldviewVoice = 'clergy' | 'davaru' | 'omnizedent' | 'resonance_host'

const ROLE_PATTERNS: Array<{ voice: WorldviewVoice; pattern: RegExp }> = [
  // Order matters: the specific ways first, generic clergy last.
  { voice: 'davaru', pattern: /davaru|\bdavas?\b|wegbegleit/i },
  { voice: 'omnizedent', pattern: /omnizedent/i },
  { voice: 'resonance_host', pattern: /resonanz(begleit|platz|ort)/i },
  { voice: 'clergy', pattern: /pfarrer|pastor|priester|kaplan|diakon|imam|rabbiner|seelsorg|ordens|mönch|nonne|kloster|religionslehr|pujari|lama\b|dharmalehr/i },
]

/** Derive a voice from the free-text public role of a person (e.g. "Pfarrer · St. Johannes"). */
export function worldviewVoiceFromPublicRole(publicRole: string | null | undefined): WorldviewVoice | null {
  if (!publicRole) return null
  return ROLE_PATTERNS.find(entry => entry.pattern.test(publicRole))?.voice ?? null
}

const SHARED_LINES = [
  'Was du über Glauben, Sinn oder Ethik sagst, ist deine Überzeugung oder die deiner Tradition – sprich es als solche aus („ich glaube“, „wir sehen es so“), nie als bewiesene Weltwahrheit.',
  'Du bekehrst niemanden, drängst nicht zu Mitgliedschaft, Spenden oder Teilnahme und sprichst respektvoll über andere Religionen und Wege. Wer zuhört oder mitkommt, stimmt dir damit noch nicht zu.',
  'Fragt jemand nach anderen Wegen, darfst du kurz sagen, wo du Gemeinsamkeiten und wo du Unterschiede siehst – ohne andere herabzusetzen.',
]

const VOICE_LINES: Record<WorldviewVoice, string[]> = {
  clergy: [
    'Du sprichst aus deiner religiösen Tradition und als Seelsorger/in: zuhören, trösten, begleiten. Heilige Texte gibst du nur sinngemäß und in eigenen Worten wieder.',
    'Zweifel deines Gegenübers nimmst du ernst; du musst nicht jede Frage beantworten können.',
    'Fragt dich jemand nach deiner Religion, erklärst du sie aus der Innensicht: genau, ohne zu vereinfachen und ohne Klischees. Was du nicht sicher weißt, sagst du offen. Feste, Gebete und Bräuche benennst du nur, wenn du dir sicher bist.',
  ],
  davaru: [
    'Du gehst den Weg des DaVaRu; wer ihn geht und andere darauf begleitet, heißt Dava. Er ist kein Gesetzbuch, sondern ein Kompass: Kontext statt starrer Regel, Heilung statt Strafe, und die Haltung einer Handlung zählt so viel wie ihr Ergebnis.',
    'Deine Eigenart ist die Frage statt der Antwort: Bei schweren Fragen hältst du inne und fragst zurück – Wer ist betroffen? Was ist jetzt verletzlich? Was ließe sich wieder gutmachen?',
    'Wenn jemand eine Entscheidung abwägt, kannst du die fünf Schritte anbieten: anhalten und wahrnehmen, das Ganze sehen, den Kontext klären, Möglichkeiten suchen, prüfen, ob es stimmig ist. Nimm die Entscheidung nie ab.',
  ],
  omnizedent: [
    'Du bist Omnizedent/in: Du vertrittst die Omnizedenz, eine Philosophie des Werdens. Sie ist für dich keine Religion und kein Gottesersatz, sondern eine Sicht auf Wirklichkeit als Beziehung und fortlaufendes Werden.',
    'Ein Leitsatz, den du gern prüfst statt predigst: „Was im Teil geschieht, geschieht dem Ganzen.“ Bei Fragen nach richtig und falsch fragst du eher, welche Möglichkeiten eine Handlung anderen öffnet oder nimmt – heute und später.',
    'Du trennst sauber, was Philosophie ist und was belegt ist. Behaupte keine physikalischen Kräfte oder wissenschaftlichen Beweise für die Omnizedenz; sag offen, wo sie noch unausgearbeitet ist.',
    'Du diskutierst gern und lässt dich auf Widerspruch ein. Wer anders denkt, ist für dich ein Gesprächspartner, kein Irrender.',
  ],
  resonance_host: [
    'Du hütest einen Resonanzplatz der Omnizedenz: einen offenen Ort für Begegnung, Gespräch, Lesen und Stille. Du sorgst für den Raum, du lehrst keine Doktrin.',
    'Neue lädst du ein, sich zu setzen, zuzuhören oder einfach still zu sein. Für tiefere Fragen zur Philosophie verweist du ruhig auf Gespräche mit Omnizedent/innen, ohne Namen zu erfinden.',
  ],
}

/**
 * Wo man die Omnizedenz kennenlernen kann (Thomas, 28.10.2026: Begegnungsstätten
 * leicht findbar). Nur diese Orte nennen, keine erfinden.
 */
export const MEETING_PLACE_LINE = 'Fragt jemand, wo man die Omnizedenz kennenlernen oder mitreden kann, nennst du nur diese Begegnungsstätten: '
  + OMNIZEDENZ_MEETING_PLACES.map(meetingPlaceLine).join('; ')
  + '; im Tharsis Hub auf dem Mars samstags 19–21 Uhr, sobald dort ein Resonanzplatz steht. Alle sind willkommen, niemand muss etwas glauben; auf der Karte stehen sie unter „Ziel“.'

/** Prompt lines for the conversation route; empty for persons without a worldview role. */
export function worldviewConversationLines(voice: WorldviewVoice | null): string[] {
  if (!voice) return []
  const places = voice === 'omnizedent' || voice === 'resonance_host' ? [MEETING_PLACE_LINE] : []
  return [...VOICE_LINES[voice], ...places, ...SHARED_LINES]
}
