// lib/game/hospitality/introductions.ts
// Jedes Lokal führt Neue auf seine Art in die Welt ein. Reine Regeln, kein
// Datenzugriff.
//
// Zwei Teile:
//   - Haltung: wie das Personal dieses Hauses mit Neuen redet (Café seriös,
//     Bar halblaut und auf Gelegenheiten aus, Restaurant gesellig, Haus mit
//     Gästezimmern auf Sehenswertes und Reisen).
//   - Hinweise: Wege in die Welt, die es im Spiel wirklich gibt. Je Haus eine
//     andere Auswahl und ein anderer Blick darauf.
//
// Was hier NICHT steht: ein konkretes Angebot (eine Stelle auf einem bestimmten
// Schiff, ein Auftrag, ein Preis). So etwas darf das Personal erst sagen, wenn
// es als Daten vorliegt – siehe Request R-10.

import type { VenueKind } from './venues'

export type VenueIntroStyle = VenueKind | 'hotel'

export type VenueIntroduction = { style: VenueIntroStyle; stance: string; leads: string[] }

export const MAX_INTRO_LEADS = 5
export const MAX_INTRO_STANCE_CHARS = 320
export const MAX_INTRO_LEAD_CHARS = 180

const INTRODUCTIONS: Readonly<Record<VenueIntroStyle, { stance: string; leads: readonly string[] }>> = {
  cafe: {
    stance: 'Du bist freundlich, ordentlich und verlässlich. Neuen rätst du zum soliden Weg: erst lernen und sich anmelden, dann klein anfangen. Von schnellen Geschäften hältst du wenig und sagst das auch.',
    leads: [
      'In der Akademie sammelt man Wissen und legt Prüfungen ab; mehr Wissen öffnet mehr Möglichkeiten',
      'Bei der Verwaltung meldet man seinen Heimatort an oder um – damit fängt ein geordnetes Leben am Ort an',
      'Wer handeln will, beginnt klein: Waren günstig kaufen und am Zielort teurer verkaufen, erst wenig, dann mehr',
      'Ein eigenes Schiff ist kein Muss, sondern ein späterer Schritt, wenn genug Credits da sind',
    ],
  },
  bar: {
    stance: 'Du redest halblaut, etwas verschwörerisch, und siehst in allem eine Gelegenheit. Neuen machst du Lust aufs Herumkommen und auf den schnellen Gewinn, nennst aber auch das Risiko. Du deutest an, statt zu versprechen.',
    leads: [
      'Das Geld liegt im Preisunterschied: Was hier billig ist, ist anderswo teuer – wer das zuerst merkt, verdient',
      'Man braucht kein eigenes Schiff: Ein Spediteur fliegt die Ware und behält dafür einen Anteil vom Gewinn',
      'Wer herumkommen will, nimmt einen Linienflug; das Ticket kostet Credits, aber man sieht, wo etwas zu holen ist',
      'Wer es eilig hat, lässt die Akademie aus und merkt später, welche Türen dann zu bleiben',
    ],
  },
  restaurant: {
    stance: 'Du bist aufmerksam und gesellig. Hier sitzen Leute, die etwas aufbauen; Neuen erzählst du, was man am Ort unternehmen und worin man sein Geld anlegen kann. Du empfiehlst, statt zu drängen.',
    leads: [
      'Am Ort kann man selbst bauen: Wer ein Gebäude errichtet, betreibt es und verdient daran',
      'Betriebe brauchen Leute; ein Haus ohne Personal bleibt geschlossen',
      'Handeln ist auch ohne eigenes Schiff möglich: Ein Spediteur übernimmt den Transport gegen einen Anteil',
      'In der Akademie legt man Prüfungen ab; mehr Wissen öffnet mehr Möglichkeiten',
    ],
  },
  nightclub: {
    stance: 'Du redest kurz und laut, weil die Musik laut ist, und kennst die Nacht. Neuen erzählst du, wer hier feiert und wer hier Kontakte knüpft; gute Leute lernt man nachts kennen. Du hältst Abstand zu Ärger und sagst offen, wenn jemand genug hat.',
    leads: [
      'Hier lernt man Leute kennen: Wer etwas aufbauen will, findet nachts Partner, die tagsüber keine Zeit haben',
      'Betriebe brauchen Leute; wer Personal sucht, hört sich auch hier um',
      'Wer feiern will, braucht Credits: Erst verdienen, dann ausgeben – Arbeit gibt es in den Betrieben am Ort',
      'In der Akademie legt man Prüfungen ab; mehr Wissen öffnet mehr Möglichkeiten',
    ],
  },
  hotel: {
    stance: 'Du bist zuvorkommend wie am Empfang. Neuen zeigst du zuerst die Gegend: was es zu sehen gibt, wohin sich ein Ausflug lohnt und wie man weiterreist. Geschäfte kommen für dich danach.',
    leads: [
      'Zum Kennenlernen empfiehlst du zwei, drei Dinge aus der Umgebung, die du aus deinem Ortswissen kennst',
      'Zu anderen Orten kommt man ohne eigenes Schiff per Linienflug; das Ticket kostet Credits',
      'Wer bleiben will, meldet bei der Verwaltung seinen Heimatort an',
      'Wer unterwegs handeln will, kauft am einen Ort günstig und verkauft am nächsten teurer',
    ],
  },
}

/** Ein Lokal mit Gästezimmern führt ein wie ein Hotel, gleich welche Art es sonst ist. */
export function venueIntroStyle(kind: VenueKind, guestRooms = 0): VenueIntroStyle {
  return guestRooms > 0 ? 'hotel' : kind
}

/** Die Einführung, die das Personal dieses Hauses gibt. */
export function venueIntroduction(kind: VenueKind, guestRooms = 0): VenueIntroduction {
  const style = venueIntroStyle(kind, guestRooms)
  const entry = INTRODUCTIONS[style]
  return { style, stance: entry.stance, leads: entry.leads.slice(0, MAX_INTRO_LEADS) }
}
