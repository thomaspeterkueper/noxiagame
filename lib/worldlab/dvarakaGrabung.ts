/**
 * Dvārakā – Grabungsebene (Spielgegenwart, 2086): erster begehbarer Ort der Erlebnis-Studios.
 * Lageplan und Fundpunkte G1–G14 nach docs/workstreams/chronomap-dvaraka.md (Kap. 2 und 3).
 * Eigene Koordinatenebene in Metern: Ursprung = Mitte des inneren Hafenbeckens, x Ost, y Nord, Meer im Westen.
 * Etiketten: R = Grabungsfund (belegt), S = aus Funden erschlossen. (F = Buchwelt kommt erst in der Chronomap.)
 */
export interface Pt { x: number; y: number }
export type FindLabel = 'R' | 'S'

export interface Find {
  id: string
  title: string
  at: Pt
  label: FindLabel
  /** Fundzettel: was die Grabung hier gefunden hat */
  text: string
  /** Buchstelle im Werk (nur Verweis, Kanon liegt in buecherwelten) */
  ref: string
}

export const FINDS: Find[] = [
  { id: 'G1', title: 'Inneres Hafenbecken mit Kaimauer', at: { x: 118, y: 0 }, label: 'R', ref: 'Kap. 1.0.4, 1.1', text: 'Kaimauer des inneren Beckens, 160 m lang. Dahinter ein äußeres Becken, der Ankerplatz der großen Schiffe (erschlossen).' },
  { id: 'G2', title: 'Südmole', at: { x: -75, y: -92 }, label: 'R', ref: 'Kap. 1.0.7', text: 'Vor etwa zweihundert Jahren vor dem Bruch gebaut. Der äußere Abschnitt neigt sich nach Westen; Abschnitt 3 zeigt drei Risse und zwei Mörtel-Reparaturphasen, der dritte Riss ist offen.' },
  { id: 'G3', title: 'Nordmole', at: { x: -75, y: 92 }, label: 'S', ref: 'nicht im Buch', text: 'Aus dem Verlauf der Südmole und der Einfahrt erschlossen: Gegenstück auf der Nordseite.' },
  { id: 'G4', title: 'Ankerfeld unter der Südmole', at: { x: -85, y: -100 }, label: 'R', ref: 'Kap. 1.0.7', text: 'Zwei Ankertypen in zwei Schichten: unten ältere Steinanker nach einem vergessenen Muster, ohne die üblichen drei Löcher; darüber jüngere.' },
  { id: 'G5', title: 'Einfahrtsmarke', at: { x: -70, y: 10 }, label: 'R', ref: 'Kap. 1.0.7', text: 'Glatter, muschelbesetzter Steinblock im Becken, Rest einer verlandeten Fahrrinne.' },
  { id: 'G6', title: 'Fundament des Wasserturms', at: { x: 240, y: 90 }, label: 'R', ref: 'Kap. 1.0, 1.1', text: 'Steinring von etwa 18 m Durchmesser. Der Turm selbst ist nicht erhalten.' },
  { id: 'G7', title: 'Brunnenreihe mit Kristallkronen', at: { x: 420, y: -80 }, label: 'R', ref: 'Kap. 1.0.6, 1.0.8', text: 'Brunnen in der Quergasse, mit Kristallkronen. Auf einem Brunnenrand die eingeritzte Wartungsnummer 24.' },
  { id: 'G8', title: 'Kanäle unter dem Hafenviertel', at: { x: 200, y: -30 }, label: 'R', ref: 'Kap. 1.0.7', text: 'Vier Bauphasen im Mauerwerk, vier verschiedene Handschriften. Zwischen zwei Phasen eine gerissene Verbindungsmuffe.' },
  { id: 'G9', title: 'Reste von Svaraṭi', at: { x: 450, y: 0 }, label: 'R', ref: 'Kap. 1.1.7, 1.2', text: 'Eisenmahlwerk mit Osmium-Führungsringen, darüber eine silbrige Schicht aus Kristallstaub. Eisen an dieser Küste um 1600 v. Chr. ist ein Fremdkörper und in der Forschung umstritten.' },
  { id: 'G10', title: 'Leere Kristalle', at: { x: 430, y: 30 }, label: 'R', ref: 'Szene B, Kap. 1.0', text: 'Lampensteine, zu leicht, innen leer. Die Fundstellen häufen sich im 300-m-Umkreis um das Mahlwerk (die Häufung ist erschlossen).' },
  { id: 'G11', title: 'Osmium-Siegel', at: { x: 50, y: 200 }, label: 'R', ref: 'Kap. 1.4.2', text: 'Im Hafenschlick unterhalb des Felsens gefunden.' },
  { id: 'G12', title: 'Fischerviertel', at: { x: 60, y: -200 }, label: 'R', ref: 'Kap. 1.0.6, 1.3', text: 'Hausfundamente im Flachwasser südlich des Hafens, Teerreste der Werft und ein trockener Brunnen mit stumpfer Kristallkrone.' },
  { id: 'G13', title: 'Kalksteinbehälter mit Chronik-Fragment', at: { x: 450, y: -15 }, label: 'R', ref: 'Fragment nach Kap. 1.4.2', text: 'Vor der Werkstatt gefunden, in der Schicht der zweiten Untergangsphase. Dass er über der Flutschicht des Bruchtags liegt, ist das Rätsel des Fundes. Das Fragment selbst sagt: „vor oder nach dem Bruchtag – nicht feststellbar“.' },
  { id: 'G14', title: 'Zwei Flutschichten', at: { x: 300, y: -10 }, label: 'S', ref: 'Prolog, 1.4, 1.4.2', text: 'Phase 1 (Bruchtag) über Fischerviertel und Westbezirk, Phase 2 (Generationen später) über der Felsstadt. Aus dem Profil des Grabungsschnitts erschlossen.' },
]

export const CAMP: Pt = { x: 330, y: 70 }
export const LAB: Pt = { x: 360, y: 40 }
export const START: Pt = { x: 320, y: 55 }

/** Begehbarer Bereich in Metern. */
export const BOUNDS = { minX: -380, maxX: 620, minY: -260, maxY: 240 }

export type Ground = 'land' | 'shallow' | 'deep' | 'mole' | 'out'

const inRect = (p: Pt, x0: number, x1: number, y0: number, y1: number) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1

/** Untergrund: Land, Flachwasser (watend, langsam), tiefes Becken (gesperrt), Mole (begehbar) oder außerhalb. */
export function groundAt(p: Pt): Ground {
  if (!inRect(p, BOUNDS.minX, BOUNDS.maxX, BOUNDS.minY, BOUNDS.maxY)) return 'out'
  // Molen: schmale Streifen quer durch das Becken
  if (inRect(p, -140, -10, -97, -90) || inRect(p, -140, -10, 90, 97)) return 'mole'
  // Äußeres und inneres Becken sind tief
  if (inRect(p, -370, -150, -130, 130) || inRect(p, -150, 120, -88, 88)) return 'deep'
  // Offene See im Westen
  if (p.x < -150) return 'shallow'
  // Flachwasser südlich des Hafens (Fischerviertel) und rund ums Becken
  if (p.x < 120 && (p.y < -97 || p.y > 97)) return 'shallow'
  if (p.y < -100 && p.x < 420) return 'shallow'
  return 'land'
}

/** Schritt von `from` nach `to`: tiefes Wasser sperrt, Flachwasser bremst auf die Hälfte. */
export function stepTo(from: Pt, to: Pt, maxStep: number): Pt {
  const dx = to.x - from.x, dy = to.y - from.y
  const d = Math.hypot(dx, dy)
  if (d < 1e-6) return from
  const next = { x: from.x + dx / d * Math.min(maxStep, d), y: from.y + dy / d * Math.min(maxStep, d) }
  const ground = groundAt(next)
  if (ground === 'deep' || ground === 'out') {
    // an der Kante entlang gleiten: erst nur x, dann nur y versuchen
    const tryX = { x: next.x, y: from.y }, tryY = { x: from.x, y: next.y }
    if (groundAt(tryX) !== 'deep' && groundAt(tryX) !== 'out' && Math.abs(dx) > 0) return tryX
    if (groundAt(tryY) !== 'deep' && groundAt(tryY) !== 'out' && Math.abs(dy) > 0) return tryY
    return from
  }
  if (ground === 'shallow') return { x: from.x + (next.x - from.x) * 0.5, y: from.y + (next.y - from.y) * 0.5 }
  return next
}

/** Nächster Fund im Umkreis `radius`, sonst null. */
export function findNear(p: Pt, radius = 14): Find | null {
  let best: { find: Find; d: number } | null = null
  for (const find of FINDS) {
    const d = Math.hypot(find.at.x - p.x, find.at.y - p.y)
    if (d <= radius && (!best || d < best.d)) best = { find, d }
  }
  return best?.find ?? null
}

export const LABEL_TEXT: Record<FindLabel, string> = { R: 'Grabungsfund (belegt)', S: 'aus Funden erschlossen' }

/**
 * Proben für das Grabungslabor (Feldlabor, lib/game/lab/lab.ts). Befunde halten sich an die Fundzettel:
 * „measurement“ sagt, was gemessen wurde, „interpretation“ ist die Deutung der Grabung (immer vorsichtig).
 * Neue Fakten gehören nicht hierher, sondern in den Wissensgraphen und die Bücher (buecherwelten).
 */
export const SAMPLES: Record<string, import('@/lib/game/lab/lab').LabSample> = {
  G4: { id: 'P-G4', label: 'Ankerstein aus der unteren Schicht', source: 'G4', findings: [
    { analysisId: 'basic', measurement: 'Beide Ankertypen sind aus Stein; die älteren haben nicht die üblichen drei Löcher.' },
    { analysisId: 'geo', measurement: 'Die älteren Anker liegen in einer tieferen Schicht als die jüngeren.', interpretation: 'Zwei Nutzungsphasen des Ankerplatzes, die ältere nach einem vergessenen Muster.' },
  ] },
  G9: { id: 'P-G9', label: 'Kristallstaub vom Mahlwerk', source: 'G9', findings: [
    { analysisId: 'basic', measurement: 'Silbrige Schicht aus feinem Kristallstaub; sie liegt auf dem Mahlwerk, nicht darunter.', interpretation: 'Möglicherweise ist die Schicht erst nach dem Stillstand der Maschine entstanden.' },
    { analysisId: 'geo', measurement: 'Kein Sedimentband zwischen Mahlwerk und Staubschicht.', interpretation: 'Der Staub hat sich vermutlich nicht langsam abgelagert.' },
    { analysisId: 'raman', measurement: 'Das Spektrum zeigt ein regelmäßiges Kristallgitter; es passt zu keiner Referenzprobe der Grabung (Referenz fehlt).' },
  ] },
  G10: { id: 'P-G10', label: 'Leerer Lampenstein', source: 'G10', findings: [
    { analysisId: 'basic', measurement: 'Deutlich leichter als ein gleich großer Vollkristall; innen hohl.' },
    { analysisId: 'geo', measurement: 'Der Hohlraum ist glatt und ohne Einschlüsse.', interpretation: 'Möglicherweise wurde der Stein entleert, nicht verwittert.' },
  ] },
  G13: { id: 'P-G13', label: 'Kalksteinbehälter', source: 'G13', findings: [
    { analysisId: 'basic', measurement: 'Verschlossener Kalksteinbehälter; Inhalt ist das Chronik-Fragment.' },
    { analysisId: 'geo', measurement: 'Er liegt in der Schicht der zweiten Untergangsphase, über der Flutschicht des Bruchtags.', interpretation: 'Entweder wurde er später dorthin gebracht, oder Dhruva kam zurück – nicht entscheidbar.' },
  ] },
}

/** Das Labor steht am Camp; man betritt es aus 14 m. */
export function labNear(p: Pt, radius = 14): boolean { return Math.hypot(LAB.x - p.x, LAB.y - p.y) <= radius }
