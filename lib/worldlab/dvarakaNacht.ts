/**
 * Chronomap „Dvārakā – die Stadt vor dem Bruch“, erste Szene: die dritte Nacht (um 1600 v. Chr.).
 * Lageplan nach docs/workstreams/chronomap-dvaraka.md (Kap. 3 und 4), gleiche Koordinatenebene wie die Grabung
 * (Ursprung Mitte des inneren Hafenbeckens, x Ost, y Nord). Alles hier ist Buchwelt (F) oder Grabungsfund (R):
 * Die Tafeln erzählen nur, was im Konzept aus dem Buch steht; Gespräche und Dialoge folgen erst mit den
 * Fakten aus dem Wissensgraphen (REQ-L3-000003) und der Buchtext-Aufarbeitung.
 */
import { FINDS, type Pt } from './dvarakaGrabung'

export type PlaceLabel = 'R' | 'F'

export interface NightPlace {
  id: string
  name: string
  at: Pt
  label: PlaceLabel
  /** Was der Spieler hier sieht (Rekonstruktion nach dem Buch) */
  text: string
  /** Bei [R]: die Fundstelle der Grabung, deren Fundzettel hier erscheint */
  find?: string
  /** Wer nachts hier ist */
  figures?: string[]
}

export const NIGHT_LABEL_TEXT: Record<PlaceLabel, string> = { R: 'Grabungsfund (belegt): an dieser Stelle fand die Grabung später etwas', F: 'Rekonstruktion nach dem Buch' }

export const NIGHT_START: Pt = { x: 900, y: -380 }
export const NIGHT_BOUNDS = { minX: 340, maxX: 1020, minY: -440, maxY: 220 }

export const NIGHT_PLACES: NightPlace[] = [
  { id: 'N1', name: 'Pilgerherberge an der Südpforte', at: { x: 900, y: -380 }, label: 'F', figures: ['Deven', 'Akash'], text: 'Hier beginnt deine Reise, als Pilger in der dritten Nacht. Deven hatte drei Tage geplant und blieb neun. Das Hämmern aus dem Westen hört für einen Augenblick auf.' },
  { id: 'N2', name: 'Bauholzlager (Harish)', at: { x: 720, y: -200 }, label: 'F', text: 'Am Rand des Felsens. Die Preise für Bauholz stehen höher als sonst (+15 %).' },
  { id: 'N3', name: 'Wartungsgebäude (Bikram)', at: { x: 650, y: -70 }, label: 'F', text: 'Stufen, auf denen Priya und Devraj sitzen werden. Bikrams Bericht liegt in Priyas Liste unter Punkt sieben von acht.' },
  { id: 'N4', name: 'Gopals Werkstatt', at: { x: 580, y: 90 }, label: 'F', figures: ['Priya', 'Devraj'], text: 'Werkstatt im Westbezirk, Wirkungsort von Priya und Devraj.' },
  { id: 'N5', name: 'Kristall-Schrein des Westbezirks', at: { x: 560, y: -20 }, label: 'F', figures: ['Pandey', 'Pilgerinnen'], text: 'Pandey am Schrein, Pilgerinnen kommen und gehen. Die Lampensteine sind dunkel.' },
  { id: 'N6', name: 'Gasse der Weber', at: { x: 520, y: 40 }, label: 'F', figures: ['Priya'], text: 'Priya zählt: Die ersten Lampen (Nr. 4 bis 7) sind ausgefallen.' },
  { id: 'N7', name: 'Werkstatt Kasyapa (Svaraṭi)', at: { x: 450, y: 0 }, label: 'R', find: 'G9', figures: ['Kasyapa'], text: 'Die Maschine Svaraṭi steht in dieser Nacht noch ganz. Am Bruchtag wird Kasyapa den Hebel ziehen.' },
  { id: 'N8', name: 'Quergasse mit Brunnenreihe', at: { x: 420, y: -80 }, label: 'R', find: 'G7', figures: ['Govind', 'Rajan', 'Ketan'], text: 'Brunnen in einer Reihe, ihre Kristallkronen stumpf. An Brunnen 24 sitzt Ketans Warnung.' },
  { id: 'N9', name: 'Bäckergasse', at: { x: 380, y: 130 }, label: 'F', figures: ['Kamala', 'Leela'], text: 'Bäckerei der Gasse, Dhruvas Haus zwei Türen weiter.' },
  { id: 'N10', name: 'Dhruvas Schreibstube', at: { x: 870, y: 60 }, label: 'F', text: 'Tagebuch und Notizhefte in der Felsstadt.' },
  { id: 'N11', name: 'Stadtrat-Gebäude', at: { x: 950, y: 0 }, label: 'F', text: 'Hier tagen die Meister. Priyas Audienz kommt am Morgen des Bruchtages.' },
]

/** Fundzettel zu einem [R]-Ort der Nacht (Text der Grabung). */
export function nightFind(place: NightPlace) { return place.find ? FINDS.find(find => find.id === place.find) ?? null : null }

export function nightBlocked(p: Pt): boolean {
  return p.x < NIGHT_BOUNDS.minX || p.x > NIGHT_BOUNDS.maxX || p.y < NIGHT_BOUNDS.minY || p.y > NIGHT_BOUNDS.maxY
}

/** Schritt über das Pflaster; die Grenzen der Szene halten die Spielerin im Viertel. */
export function nightStep(from: Pt, to: Pt, maxStep: number): Pt {
  const dx = to.x - from.x, dy = to.y - from.y
  const d = Math.hypot(dx, dy)
  if (d < 1e-6) return from
  const next = { x: from.x + dx / d * Math.min(maxStep, d), y: from.y + dy / d * Math.min(maxStep, d) }
  if (!nightBlocked(next)) return next
  const tryX = { x: next.x, y: from.y }, tryY = { x: from.x, y: next.y }
  if (!nightBlocked(tryX) && dx !== 0) return tryX
  if (!nightBlocked(tryY) && dy !== 0) return tryY
  return from
}

/** Nächster Ort im Umkreis `radius` (Meter), sonst null. */
export function nightPlaceNear(p: Pt, radius = 16): NightPlace | null {
  let best: { place: NightPlace; d: number } | null = null
  for (const place of NIGHT_PLACES) {
    const d = Math.hypot(place.at.x - p.x, place.at.y - p.y)
    if (d <= radius && (!best || d < best.d)) best = { place, d }
  }
  return best?.place ?? null
}
