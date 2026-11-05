// lib/figures/kiesel.ts
// Figuren im Stil „Kiesel“ (Thomas, 04.11.2026: „Kiesel wirkt am angenehmsten“;
// Entwürfe in der Figurenwerkstatt). Eiförmiger Kopf, runde Körper ohne Umriss,
// leichte Schatten; eigene Formen, keine Nachbildung bekannter Spielfiguren.
// Eine Figur entsteht nur aus Werten (Alter, Statur, Haut, Haare, Bart, Kleidung,
// Ausdruck) – dieselbe Person mit 20 und mit 70, ohne neue Zeichnung.
// Reine Funktion: liefert SVG-Text für viewBox 0 0 64 96, Füße bei y≈90.
// Lokal und Porträt zeichnen das direkt; die Karte (PixiJS) kann daraus Bilder
// rechnen und zwischenspeichern (W-17).

export type KieselAge = 'kind' | 'jung' | 'erwachsen' | 'aelter' | 'alt'
export type KieselBuild = 'schmal' | 'mittel' | 'kraeftig'
export type KieselHair = 'kurz' | 'lang' | 'locken' | 'zopf' | 'dutt' | 'glatze'
export type KieselBeard = 'ohne' | 'stoppeln' | 'vollbart' | 'schnurrbart'
export type KieselFace = 'freundlich' | 'neutral' | 'traurig' | 'erstaunt' | 'wuetend'
export type KieselClothes = 'alltag' | 'schuerze' | 'bar' | 'druckanzug' | 'fest' | 'kleid' | 'overall' | 'kittel' | 'polizei' | 'feuerwehr' | 'rettung'
export type KieselDir = 'sw' | 'se' | 'nw' | 'ne'
export type KieselPose =
  | 'stehen' | 'gehen' | 'sitzen'
  | 'tanzen'
  | 'tragen' | 'polieren' | 'wischen' | 'haemmern' | 'hacken' | 'schaufeln'
  | 'schubsen' | 'hinfallen'
  | 'zuschlagen' | 'abwehren' | 'getroffen' | 'liegen'
  | 'winken' | 'jubeln' | 'klatschen' | 'verbeugen' | 'prost'
  | 'paartanz' | 'anstossen' | 'handschlag' | 'umarmen' | 'troesten'
  | 'armnehmen' | 'handinhand' | 'handinhand_l'

/**
 * Posen in Thomas' Steigerung (04.11.2026: „alles in genau dieser Steigerung, leider
 * ist die Welt nicht nur nett“): Tanzen – Arbeit mit Werkzeug wie in Siedler –
 * Rangelei mit Hinfallen – Kampf mit Folgen (verletzt, am Boden). Die Folgen selbst
 * (Verletzung, Hausverbot, Polizei, Gedächtnis) regeln Population und NPC (Request);
 * hier wird nur gezeichnet.
 */
export const KIESEL_POSES: Readonly<Record<KieselPose, { label: string; stufe: 'grund' | 'tanz' | 'arbeit' | 'rangelei' | 'kampf' | 'geste' | 'gemeinsam'; animated: boolean }>> = {
  stehen: { label: 'Stehen', stufe: 'grund', animated: false },
  gehen: { label: 'Gehen', stufe: 'grund', animated: true },
  sitzen: { label: 'Sitzen', stufe: 'grund', animated: false },
  tanzen: { label: 'Tanzen', stufe: 'tanz', animated: true },
  tragen: { label: 'Tablett tragen', stufe: 'arbeit', animated: false },
  polieren: { label: 'Glas polieren', stufe: 'arbeit', animated: true },
  wischen: { label: 'Wischen', stufe: 'arbeit', animated: true },
  haemmern: { label: 'Hämmern', stufe: 'arbeit', animated: true },
  hacken: { label: 'Hacken', stufe: 'arbeit', animated: true },
  schaufeln: { label: 'Schaufeln', stufe: 'arbeit', animated: true },
  schubsen: { label: 'Schubsen', stufe: 'rangelei', animated: true },
  hinfallen: { label: 'Hinfallen', stufe: 'rangelei', animated: true },
  zuschlagen: { label: 'Zuschlagen', stufe: 'kampf', animated: true },
  abwehren: { label: 'Abwehren', stufe: 'kampf', animated: true },
  getroffen: { label: 'Getroffen', stufe: 'kampf', animated: true },
  liegen: { label: 'Am Boden', stufe: 'kampf', animated: false },
  winken: { label: 'Winken', stufe: 'geste', animated: true },
  jubeln: { label: 'Jubeln', stufe: 'geste', animated: true },
  klatschen: { label: 'Klatschen', stufe: 'geste', animated: true },
  verbeugen: { label: 'Verbeugen', stufe: 'geste', animated: true },
  prost: { label: 'Prost', stufe: 'geste', animated: true },
  paartanz: { label: 'Paartanz', stufe: 'gemeinsam', animated: true },
  anstossen: { label: 'Anstoßen', stufe: 'gemeinsam', animated: true },
  handschlag: { label: 'Hand geben', stufe: 'gemeinsam', animated: true },
  umarmen: { label: 'Umarmen', stufe: 'gemeinsam', animated: true },
  troesten: { label: 'Trösten', stufe: 'gemeinsam', animated: true },
  armnehmen: { label: 'In den Arm nehmen', stufe: 'gemeinsam', animated: false },
  handinhand: { label: 'Hand in Hand', stufe: 'gemeinsam', animated: false },
  handinhand_l: { label: 'Hand in Hand (andere Hand)', stufe: 'gemeinsam', animated: false },
}

/** Läuft die Pose in Schritten (Bild 0–3)? Tragen nur, wenn die Figur dabei geht. */
export const kieselAnimated = (pose: KieselPose, moving = false) => KIESEL_POSES[pose]?.animated || (moving && (pose === 'tragen' || pose === 'armnehmen' || pose === 'handinhand' || pose === 'handinhand_l'))

export interface KieselLook {
  age: KieselAge
  build: KieselBuild
  /** Hautfarbe als Farbwert. */
  skin: string
  hair: KieselHair
  /** Haarfarbe als Farbwert; mit dem Alter wird sie von selbst grauer. */
  hairColor: string
  beard: KieselBeard
  face: KieselFace
  clothes: KieselClothes
  /** Farbe der Oberbekleidung im Alltag (aus der Person, damit nicht alle gleich aussehen). */
  topColor?: string
  robot?: boolean
  /** Sichtbar verletzt (Pflaster), nur wenn die Bevölkerung es meldet. */
  verletzt?: boolean
}

const AGES: Record<KieselAge, { scale: number; head: number; stoop: number; lines: number }> = {
  kind: { scale: .66, head: 1.18, stoop: 0, lines: 0 },
  jung: { scale: .86, head: 1.06, stoop: 0, lines: 0 },
  erwachsen: { scale: 1, head: 1, stoop: 0, lines: 0 },
  aelter: { scale: 1, head: 1, stoop: 0, lines: 1 },
  alt: { scale: .95, head: 1, stoop: 2, lines: 2 },
}
const BUILD: Record<KieselBuild, number> = { schmal: .84, mittel: 1, kraeftig: 1.22 }
const GREY = '#a7a39c'

type Clothing = { top: string; bottom: string; shoes: string; apron?: string; vest?: string; suit?: string; tie?: string; straps?: string; dress?: boolean; coat?: boolean; stripes?: string; cap?: string }
export const KIESEL_CLOTHES: Readonly<Record<KieselClothes, Clothing & { label: string }>> = {
  alltag: { label: 'Alltag', top: '#4f7fa8', bottom: '#3a4659', shoes: '#2b2622' },
  schuerze: { label: 'Café-Schürze', top: '#e9e2d2', bottom: '#2f3540', shoes: '#2b2622', apron: '#7a4a2a' },
  bar: { label: 'Barkeeper', top: '#1f2a30', bottom: '#1b1f24', shoes: '#141414', vest: '#7b2f34' },
  druckanzug: { label: 'Druckanzug', top: '#e7e9ea', bottom: '#e7e9ea', shoes: '#5c636a', suit: '#d9734a' },
  fest: { label: 'Festkleidung', top: '#2a3550', bottom: '#2a3550', shoes: '#141414', tie: '#b8892a' },
  kleid: { label: 'Kleid', top: '#8f3e6b', bottom: '#8f3e6b', shoes: '#3a2a2a', dress: true },
  overall: { label: 'Overall', top: '#3f6fa8', bottom: '#3f6fa8', shoes: '#3b2f25', straps: '#2c4f7a' },
  kittel: { label: 'Kittel', top: '#f4f6f6', bottom: '#4b5563', shoes: '#2b2622', coat: true },
  // Öffentliche Dienste (05.11.2026)
  polizei: { label: 'Polizei', top: '#2c4a7c', bottom: '#1f2b45', shoes: '#141414', stripes: '#c9d6e8', cap: '#22385e' },
  feuerwehr: { label: 'Feuerwehr', top: '#1f2a3a', bottom: '#1f2a3a', shoes: '#141414', stripes: '#e8d23a' },
  rettung: { label: 'Rettungsdienst', top: '#e8512b', bottom: '#2a3140', shoes: '#141414', stripes: '#f2f2e6' },
}
const ROBOT = { metal: '#c9d3d6', dark: '#4f6a63', glow: '#4fd8c5' }

function mix(a: string, b: string, t: number): string {
  const p = (x: string) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16))
  const A = p(a), B = p(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
const shade = (c: string, t: number) => mix(c, '#000000', t)
const r1 = (v: number) => Math.round(v * 10) / 10

type Rig = { back: number; front: number; lean: number; legs: 'stand' | 'walk' | 'sit' | 'wide'; bob: number; face?: KieselFace; tool?: 'tablett' | 'glas' | 'mopp' | 'hammer' | 'axt' | 'schaufel' | 'becher' }

/** Arm- und Körperhaltung je Pose und Bild. Winkel in Grad: 0 hängt, 90 nach vorn, 180 nach oben. */
function rig(pose: KieselPose, f: number, moving: boolean): Rig {
  const i = ((f % 4) + 4) % 4
  const ph = [0, 1, 0, -1][i]
  const pick = <T,>(v: readonly T[]) => v[i]
  switch (pose) {
    case 'gehen': return { back: ph * 18, front: -ph * 18, lean: 0, legs: 'walk', bob: i % 2 ? -1 : 0 }
    case 'sitzen': return { back: 8, front: 8, lean: 0, legs: 'sit', bob: 0 }
    case 'tanzen': return { back: pick([150, 165, 25, 125]), front: pick([25, 165, 150, 125]), lean: pick([-7, 0, 7, 0]), legs: 'walk', bob: pick([0, -2.5, 0, -2.5]), face: 'freundlich' }
    case 'tragen': return { back: moving ? ph * 16 : 0, front: 78, lean: 0, legs: moving ? 'walk' : 'stand', bob: moving && i % 2 ? -1 : 0, tool: 'tablett' }
    case 'polieren': return { back: 52, front: pick([62, 74, 62, 50]), lean: 2, legs: 'stand', bob: 0, tool: 'glas' }
    case 'wischen': return { back: pick([32, 46, 32, 18]), front: pick([38, 54, 38, 22]), lean: 5, legs: 'stand', bob: 0, tool: 'mopp' }
    case 'haemmern': return { back: 20, front: pick([155, 110, 55, 110]), lean: pick([-3, 0, 6, 0]), legs: 'stand', bob: 0, tool: 'hammer' }
    case 'hacken': return { back: pick([168, 120, 42, 120]), front: pick([168, 120, 42, 120]), lean: pick([-5, 0, 9, 0]), legs: 'wide', bob: pick([0, 0, 1, 0]), tool: 'axt' }
    case 'schaufeln': return { back: pick([38, 70, 115, 70]), front: pick([45, 76, 120, 76]), lean: pick([12, 6, -3, 6]), legs: 'wide', bob: 0, tool: 'schaufel' }
    case 'schubsen': return { back: pick([70, 92, 92, 60]), front: pick([70, 92, 92, 60]), lean: pick([4, 14, 12, 2]), legs: 'wide', bob: 0, face: 'wuetend' }
    case 'hinfallen': return { back: pick([30, 70, 120, 150]), front: pick([40, 90, 140, 160]), lean: pick([-10, -28, -55, -82]), legs: 'wide', bob: pick([0, 2, 5, 8]), face: 'erstaunt' }
    case 'zuschlagen': return { back: pick([70, 60, 70, 60]), front: pick([-45, 100, 96, 20]), lean: pick([-7, 11, 9, 0]), legs: 'wide', bob: 0, face: 'wuetend' }
    case 'abwehren': return { back: pick([118, 124, 118, 112]), front: pick([112, 118, 112, 106]), lean: pick([-4, -6, -4, -3]), legs: 'wide', bob: 0, face: 'neutral' }
    case 'getroffen': return { back: pick([-30, -40, -20, 10]), front: pick([40, 55, 30, 10]), lean: pick([-14, -18, -10, -4]), legs: 'wide', bob: 0, face: 'erstaunt' }
    case 'winken': return { back: 0, front: pick([150, 168, 150, 132]), lean: 0, legs: 'stand', bob: 0, face: 'freundlich' }
    case 'jubeln': return { back: pick([160, 176, 160, 176]), front: pick([160, 176, 160, 176]), lean: 0, legs: 'stand', bob: pick([0, -2.5, 0, -2.5]), face: 'freundlich' }
    case 'klatschen': return { back: pick([62, 78, 62, 78]), front: pick([78, 62, 78, 62]), lean: 0, legs: 'stand', bob: 0, face: 'freundlich' }
    case 'verbeugen': return { back: 8, front: 8, lean: pick([0, 16, 28, 16]), legs: 'stand', bob: 0, face: 'freundlich' }
    case 'prost': return { back: 0, front: pick([125, 140, 125, 140]), lean: 0, legs: 'stand', bob: 0, face: 'freundlich', tool: 'becher' }
    case 'paartanz': return { back: pick([30, 40, 30, 20]), front: 82, lean: pick([-4, 0, 4, 0]), legs: 'walk', bob: pick([0, -1.5, 0, -1.5]), face: 'freundlich' }
    case 'anstossen': return { back: 0, front: pick([98, 110, 98, 110]), lean: 3, legs: 'stand', bob: 0, face: 'freundlich', tool: 'becher' }
    case 'handschlag': return { back: 0, front: pick([74, 66, 74, 66]), lean: 3, legs: 'stand', bob: 0, face: 'freundlich' }
    case 'umarmen': return { back: 86, front: 86, lean: pick([7, 9, 7, 9]), legs: 'stand', bob: 0, face: 'freundlich' }
    case 'troesten': return { back: 0, front: pick([96, 100, 96, 100]), lean: 6, legs: 'stand', bob: 0, face: 'neutral' }
    case 'armnehmen': return { back: moving ? ph * 14 : 0, front: 102, lean: 4, legs: moving ? 'walk' : 'stand', bob: moving && i % 2 ? -1 : 0, face: 'freundlich' }
    case 'handinhand': return { back: moving ? ph * 16 : 0, front: 30, lean: 0, legs: moving ? 'walk' : 'stand', bob: moving && i % 2 ? -1 : 0, face: 'freundlich' }
    case 'handinhand_l': return { back: 30, front: moving ? -ph * 16 : 0, lean: 0, legs: moving ? 'walk' : 'stand', bob: moving && i % 2 ? -1 : 0, face: 'freundlich' }
    case 'liegen': return { back: 170, front: 150, lean: 0, legs: 'stand', bob: 0, face: 'traurig' }
    default: return { back: 0, front: 0, lean: 0, legs: 'stand', bob: 0 }
  }
}

/**
 * Die Figur als SVG-Inhalt (ohne äußeres <svg>), viewBox 0 0 64 96.
 * `moving` nur für Posen, die man im Gehen macht (Tablett tragen).
 */
export function kieselSVG(a: KieselLook, dir: KieselDir = 'se', pose: KieselPose = 'stehen', frame = 0, moving = false): string {
  const age = AGES[a.age] ?? AGES.erwachsen
  const w = BUILD[a.build] ?? 1
  const back = dir === 'nw' || dir === 'ne'
  const mirror = dir === 'sw' || dir === 'nw'
  const S = age.scale, H = age.head
  const out: string[] = []
  const rect = (x: number, y: number, ww: number, hh: number, fill: string, opacity = 1) =>
    out.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(ww)}" height="${r1(hh)}" rx="${r1(Math.min(ww, hh) / 2)}" fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`)
  const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, opacity = 1) =>
    out.push(`<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`)

  const R = rig(pose, frame, moving)
  const lying = pose === 'liegen'
  const face: KieselFace = R.face && a.face !== 'traurig' ? R.face : (lying ? 'traurig' : a.face)
  const sitting = R.legs === 'sit'
  const ph = R.legs === 'walk' ? [0, 1, 0, -1][((frame % 4) + 4) % 4] : R.legs === 'wide' ? 1 : 0
  const bob = R.bob
  const ground = 90
  const legH = (sitting ? 9 : 20) * S, torsoH = 22 * S, headR = 11 * S * H
  const hipY = ground - (sitting ? 10 : 0) - legH + bob
  const torsoW = 18 * S * w, cx = 32
  const torsoTop = hipY - torsoH + age.stoop
  const headCy = torsoTop - headR * .92 + age.stoop * .5
  const c: Clothing | null = a.robot ? null : { ...(KIESEL_CLOTHES[a.clothes] ?? KIESEL_CLOTHES.alltag) }
  if (c && a.clothes === 'alltag' && a.topColor) c.top = a.topColor
  let hairC = a.hairColor
  if (age.lines >= 1 && hairC.toLowerCase() !== GREY) hairC = mix(hairC, GREY, age.lines === 1 ? .35 : .7)

  if (lying) ell(32, ground - 1, 30 * S, 5 * S, '#000', .16)
  else ell(32, ground + 1, 14 * S * w, 4 * S, '#000', .16)
  if (lying) out.push(`<g transform="translate(${r1(12 * S)} ${r1(-2)}) rotate(-86 32 ${ground - 2})">`)
  if (sitting) out.push(`<rect x="${r1(cx - 13 * S)}" y="${r1(hipY + legH - 3)}" width="${r1(26 * S)}" height="12" rx="2" fill="#8b6a4a"/>`)
  // Was am Boden liegt, woran gearbeitet wird
  if (!lying && (R.tool === 'hammer' || R.tool === 'axt')) { rect(cx + 15 * S, ground - 7, 12 * S, 7, '#8b6a4a'); if (R.tool === 'axt') ell(cx + 21 * S, ground - 7, 6 * S, 2, '#b08a5e') }
  if (!lying && R.tool === 'schaufel') ell(cx + 22 * S, ground - 2, 9 * S, 4, '#6b5038')

  // Beine
  const legW = 6.5 * S * Math.max(.9, w * .92)
  const legCol = a.robot ? ROBOT.dark : c!.bottom, shoe = a.robot ? ROBOT.dark : c!.shoes
  const legs: Array<[number, number]> = [[-1, -ph], [1, ph]]
  if (c?.dress && !sitting) {
    for (const [s, o] of legs) { rect(cx + s * 4 * S - legW / 2 + o * 2, hipY + legH * .45, legW * .8, legH * .55 - bob, a.skin); rect(cx + s * 4 * S - legW / 2 + o * 2 - .5, ground - 3, legW * .9 + 1, 4, shoe) }
  } else if (sitting) {
    for (const [s] of legs) { const lx = cx + s * 4 * S - legW / 2; rect(lx, hipY, legW, legH, legCol); rect(lx - .5, hipY + legH - 3, legW + 3, 4, shoe) }
  } else {
    for (const [s, o] of legs) { const lx = cx + s * 4.2 * S - legW / 2 + o * 2.2; rect(lx, hipY, legW, ground - hipY - 3 + (o < 0 ? -1 : 0), legCol); rect(lx - .5, ground - 4 + (o < 0 ? -1 : 0), legW + 2.5, 4.5, shoe) }
  }

  // Oberkörper neigt sich um die Hüfte
  out.push(`<g transform="rotate(${r1(R.lean)} ${cx} ${r1(hipY)})">`)
  if (c?.dress && !sitting) {
    const top = hipY - 2, bot = hipY + legH * .62
    out.push(`<path d="M${r1(cx - torsoW * .46)} ${r1(top)} L${r1(cx + torsoW * .46)} ${r1(top)} L${r1(cx + torsoW * .72)} ${r1(bot)} L${r1(cx - torsoW * .72)} ${r1(bot)} Z" fill="${c.bottom}"/>`)
  }
  const armW = 5.2 * S * Math.max(.9, w * .9), armH = 17 * S
  const armY = torsoTop + 2.5 * S + armW / 2
  const topCol = a.robot ? ROBOT.metal : c!.top
  const armCol = a.robot ? ROBOT.dark : topCol
  const flip = back && pose === 'gehen' ? -1 : 1
  const L = armH + 1.5
  // Werkzeug in der Hand, im Bezug des Arms (Hand bei 0,L)
  const toolLocal = (t: Rig['tool']): string => {
    if (t === 'hammer') return `<rect x="-1.2" y="${r1(L - 1)}" width="2.4" height="${r1(11 * S)}" rx="1" fill="#8a6440" transform="rotate(-90 0 ${r1(L)})"/><rect x="${r1(8 * S)}" y="${r1(L - 4.5 * S)}" width="${r1(4 * S)}" height="${r1(9 * S)}" rx="1" fill="#5b6066"/>`
    if (t === 'axt') return `<rect x="-1.3" y="${r1(L - 2)}" width="2.6" height="${r1(20 * S)}" rx="1" fill="#8a6440"/><path d="M1 ${r1(L + 14 * S)} q${r1(8 * S)} ${r1(1 * S)} ${r1(7 * S)} ${r1(7 * S)} q-${r1(4 * S)} -${r1(1 * S)} -${r1(7 * S)} 0z" fill="#9aa3a8"/>`
    if (t === 'schaufel') return `<rect x="-1.2" y="${r1(L - 2)}" width="2.4" height="${r1(20 * S)}" rx="1" fill="#8a6440"/><path d="M-4 ${r1(L + 17 * S)} h8 l-1 ${r1(8 * S)} q-3 2 -6 0z" fill="#7d868c"/>`
    return ''
  }
  const arm = (px: number, angle: number, t?: Rig['tool']) => {
    const handFill = a.robot ? ROBOT.metal : a.skin
    out.push(`<g transform="translate(${r1(px)} ${r1(armY)}) rotate(${r1(-angle)})"><rect x="${r1(-armW / 2)}" y="${r1(-armW / 2)}" width="${r1(armW)}" height="${r1(armH)}" rx="${r1(armW / 2)}" fill="${armCol}"/>${toolLocal(t)}<ellipse cx="0" cy="${r1(L - armW / 2)}" rx="${r1(armW * .55)}" ry="${r1(armW * .55)}" fill="${handFill}"/></g>`)
  }
  const handAt = (px: number, angle: number) => { const rad = angle * Math.PI / 180; return { x: px + Math.sin(rad) * (L - armW / 2), y: armY + Math.cos(rad) * (L - armW / 2) } }
  const backX = cx - torsoW / 2 - armW / 2 + 1.2, frontX = cx + torsoW / 2 + armW / 2 - 1.2
  arm(backX, R.back * flip)
  rect(cx - torsoW / 2, torsoTop, torsoW, torsoH + (c?.coat ? 6 * S : 0), topCol)
  if (c && !back) {
    if (c.apron) rect(cx - torsoW * .36, torsoTop + torsoH * .42, torsoW * .72, torsoH * .75, c.apron)
    if (c.vest) { rect(cx - torsoW / 2 + 1, torsoTop + 1, torsoW * .3, torsoH - 2, c.vest); rect(cx + torsoW * .2 - 1, torsoTop + 1, torsoW * .3, torsoH - 2, c.vest) }
    if (c.tie) rect(cx - 1.5, torsoTop + 2, 3, torsoH * .6, c.tie)
    if (c.straps) { rect(cx - torsoW * .34, torsoTop, 2.6, torsoH * .6, c.straps); rect(cx + torsoW * .34 - 2.6, torsoTop, 2.6, torsoH * .6, c.straps) }
    if (c.suit) rect(cx - torsoW * .38, torsoTop + torsoH * .25, torsoW * .76, 4, c.suit)
    if (c.coat) rect(cx - 1, torsoTop + 2, 2, torsoH + 3 * S, shade(c.top, .12))
  }
  if (c?.stripes) { rect(cx - torsoW / 2 + .5, torsoTop + torsoH * .45, torsoW - 1, 2.6 * S, c.stripes, .95); rect(cx - torsoW / 2 + .5, torsoTop + torsoH * .72, torsoW - 1, 2.6 * S, c.stripes, .95) }
  if (c && back && c.suit) rect(cx - torsoW * .42, torsoTop + 3, torsoW * .84, torsoH * .6, '#b9c0c4')
  if (a.robot && !back) rect(cx - torsoW * .3, torsoTop + torsoH * .3, torsoW * .6, torsoH * .3, '#f1d57a')
  out.push(`<rect x="${r1(cx)}" y="${r1(torsoTop)}" width="${r1(torsoW / 2)}" height="${r1(torsoH)}" rx="${r1(torsoW / 4)}" fill="#000" opacity=".08"/>`)
  // Dinge, die waagerecht bleiben (Tablett, Glas, Mopp), in Weltlage an der Hand
  const hf = handAt(frontX, R.front * flip), hb = handAt(backX, R.back * flip)
  if (R.tool === 'mopp') { out.push(`<line x1="${r1(hf.x)}" y1="${r1(hf.y - 3)}" x2="${r1(hf.x + 9 * S)}" y2="${r1(ground - 3 - bob)}" stroke="#8a6440" stroke-width="2.2" stroke-linecap="round"/>`); ell(hf.x + 9 * S, ground - 2 - bob, 6 * S, 2.4, '#d9d4c4') }
  arm(frontX, R.front * flip, R.tool)
  if (R.tool === 'tablett') {
    ell(hf.x + 3, hf.y - 2.5, 8 * S, 2.2, '#b9c0c4'); rect(hf.x - 1, hf.y - 9, 3, 6, '#e8d9a8', .9); rect(hf.x + 4, hf.y - 8, 2.6, 5, '#7a3b2a', .9)
  }
  if (R.tool === 'becher') { rect(hf.x - 2.6, hf.y - 9, 5.2, 8, '#e8c35a', .92); rect(hf.x - 2.6, hf.y - 10, 5.2, 2.2, '#fbf6e6') }
  if (R.tool === 'glas') {
    rect(hb.x - 2.8, hb.y - 9, 5.6, 9, '#cfe8ee', .9); rect(hf.x - 3, hf.y - 3, 6, 4, '#f4f1ea')
  }

  // Kopf
  const hx = cx + (back ? -1 : 1.5), hy = headCy, hr = headR
  if (a.robot) {
    out.push(`<line x1="${r1(hx)}" y1="${r1(hy - hr)}" x2="${r1(hx)}" y2="${r1(hy - hr - 5)}" stroke="#9fb5b0" stroke-width="2"/>`)
    ell(hx, hy - hr - 6, 2.2, 2.2, ROBOT.glow)
    out.push(`<rect x="${r1(hx - hr * 1.05)}" y="${r1(hy - hr * .85)}" width="${r1(hr * 2.1)}" height="${r1(hr * 1.7)}" rx="5" fill="${ROBOT.metal}"/>`)
    if (!back) { out.push(`<rect x="${r1(hx - hr * .75 + 1.5)}" y="${r1(hy - hr * .35)}" width="${r1(hr * 1.5)}" height="${r1(hr * .8)}" rx="3" fill="#163a35"/>`); ell(hx - hr * .3 + 2, hy + .5, 1.8, 1.8, face === 'wuetend' ? '#e2574c' : ROBOT.glow); ell(hx + hr * .35 + 2, hy + .5, 1.8, 1.8, face === 'wuetend' ? '#e2574c' : ROBOT.glow) }
  } else {
    rect(cx - 2.2 * S, torsoTop - 3 * S, 4.4 * S, 4 * S, shade(a.skin, .06))
    if (a.hair === 'lang') out.push(`<rect x="${r1(hx - hr * 1.02)}" y="${r1(hy - hr * .3)}" width="${r1(hr * 2.04)}" height="${r1(hr * 1.7)}" rx="4" fill="${hairC}"/>`)
    if (a.hair === 'zopf' && back) rect(hx - 2.5, hy + hr * .4, 5, hr * 1.2, hairC)
    ell(hx, hy, hr, hr * 1.06, a.skin)
    if (!back) {
      const ex = hx + 2.4 * H, ey = hy + .5
      for (const x of [ex - 4.2 * H, ex + 2.6 * H]) out.push(`<ellipse cx="${r1(x)}" cy="${r1(ey)}" rx="1.5" ry="1.9" fill="#1d1714"/><circle cx="${r1(x + .5)}" cy="${r1(ey - .6)}" r=".5" fill="#fff"/>`)
      if (face === 'wuetend') out.push(`<path d="M${r1(ex - 6 * H)} ${r1(ey - 4.2)} l3.2 1.4 M${r1(ex + 4.4 * H)} ${r1(ey - 4.2)} l-3.2 1.4" stroke="#3a2a22" stroke-width="1.1" stroke-linecap="round"/>`)
      ell(ex - 5.5 * H, ey + 4, 2, 1.1, '#e07a6a', face === 'wuetend' ? .6 : .35); ell(ex + 4.2 * H, ey + 4, 2, 1.1, '#e07a6a', face === 'wuetend' ? .6 : .35)
      const my = ey + 5 * H, mx = ex - .8
      const mouth = { freundlich: `M${r1(mx - 3)} ${r1(my)} Q${r1(mx)} ${r1(my + 2.6)} ${r1(mx + 3)} ${r1(my)}`, neutral: `M${r1(mx - 2.4)} ${r1(my + .8)} L${r1(mx + 2.4)} ${r1(my + .8)}`, traurig: `M${r1(mx - 2.6)} ${r1(my + 1.8)} Q${r1(mx)} ${r1(my - .6)} ${r1(mx + 2.6)} ${r1(my + 1.8)}`, wuetend: `M${r1(mx - 2.6)} ${r1(my + 1.4)} L${r1(mx + 2.6)} ${r1(my + .6)}`, erstaunt: '' }[face] ?? ''
      out.push(face === 'erstaunt' ? `<ellipse cx="${r1(mx)}" cy="${r1(my + .8)}" rx="1.3" ry="1.6" fill="#6b2a24"/>` : `<path d="${mouth}" fill="none" stroke="#6b2a24" stroke-width="1.3" stroke-linecap="round"/>`)
      const wrinkle = shade(a.skin, .35)
      if (age.lines >= 1) out.push(`<path d="M${r1(ex - 6.5 * H)} ${r1(ey - 3.5)} q1.5 -.8 3 0 M${r1(ex + 1.5 * H)} ${r1(ey - 3.5)} q1.5 -.8 3 0" fill="none" stroke="${wrinkle}" stroke-width=".7"/>`)
      if (age.lines >= 2) out.push(`<path d="M${r1(mx - 5)} ${r1(my - 1)} q-.6 1.4 .3 2.6 M${r1(mx + 5)} ${r1(my - 1)} q.6 1.4 -.3 2.6" fill="none" stroke="${wrinkle}" stroke-width=".7"/>`)
      if (a.beard === 'stoppeln') out.push(`<path d="M${r1(hx - hr * .85)} ${r1(hy + hr * .15)} Q${r1(hx)} ${r1(hy + hr * 1.35)} ${r1(hx + hr * .9)} ${r1(hy + hr * .15)} L${r1(hx + hr * .9)} ${r1(hy + hr * .5)} Q${r1(hx)} ${r1(hy + hr * 1.15)} ${r1(hx - hr * .85)} ${r1(hy + hr * .5)}Z" fill="${hairC}" opacity=".28"/>`)
      if (a.beard === 'vollbart') { rect(hx - hr * .85, my - 2.2, hr * 1.75, hr * .75, hairC); out.push(`<path d="M${r1(mx - 2.2)} ${r1(my + .2)} Q${r1(mx)} ${r1(my + 1.6)} ${r1(mx + 2.2)} ${r1(my + .2)}" fill="none" stroke="#6b2a24" stroke-width="1.1" stroke-linecap="round"/>`) }
      if (a.beard === 'schnurrbart') rect(mx - 3.2, my - 2, 6.4, 1.8, hairC)
    }
    if (a.hair !== 'glatze') {
      out.push(`<path d="M${r1(hx - hr * 1.02)} ${r1(hy - hr * .1)} Q${r1(hx - hr * 1.1)} ${r1(hy - hr * 1.25)} ${r1(hx)} ${r1(hy - hr * 1.12)} Q${r1(hx + hr * 1.12)} ${r1(hy - hr * 1.2)} ${r1(hx + hr * 1.02)} ${r1(hy - hr * (back ? 0 : .25))} Q${r1(hx + hr * .2)} ${r1(hy - hr * (back ? 0 : .7))} ${r1(hx - hr * 1.02)} ${r1(hy - hr * .1)}Z" fill="${hairC}"/>`)
      if (a.hair === 'locken') for (let i = -2; i <= 2; i++) ell(hx + i * hr * .45, hy - hr * .9 + (Math.abs(i) === 2 ? 3 : 0), hr * .32, hr * .3, hairC)
      if (a.hair === 'dutt') ell(hx - 1, hy - hr * 1.18, hr * .38, hr * .34, hairC)
      if (a.hair === 'zopf' && !back) ell(hx - hr * 1.05, hy + hr * .15, hr * .26, hr * .42, hairC)
      if (a.hair === 'lang' && !back) out.push(`<rect x="${r1(hx - hr * 1.06)}" y="${r1(hy - hr * .4)}" width="${r1(hr * .38)}" height="${r1(hr * 1.45)}" rx="2" fill="${hairC}"/>`)
    } else if (age.lines >= 1) rect(hx - hr * 1.04, hy - hr * .15, hr * .3, hr * .55, hairC)
    if (c?.cap) { out.push(`<path d="M${r1(hx - hr * 1.05)} ${r1(hy - hr * .35)} Q${r1(hx)} ${r1(hy - hr * 1.5)} ${r1(hx + hr * 1.05)} ${r1(hy - hr * .35)}Z" fill="${c.cap}"/>`); rect(hx - hr * (back ? 1.1 : .2), hy - hr * .45, hr * 1.3, 2.4, shade(c.cap, .25)) }
    if (a.verletzt) out.push(`<g transform="rotate(-24 ${r1(hx + hr * .35)} ${r1(hy - hr * .55)})"><rect x="${r1(hx + hr * .35 - 4.5)}" y="${r1(hy - hr * .55 - 1.6)}" width="9" height="3.2" rx="1" fill="#efd9b4"/><rect x="${r1(hx + hr * .35 - 4.5)}" y="${r1(hy - hr * .55 - .3)}" width="9" height=".6" fill="#c8a77a"/></g>`)
    if (c?.suit) out.push(`<ellipse cx="${r1(hx)}" cy="${r1(hy - .5)}" rx="${r1(hr * 1.32)}" ry="${r1(hr * 1.35)}" fill="#bfe4f2" opacity=".32" stroke="#e7e9ea" stroke-width="2"/>`)
  }
  out.push('</g>')
  if (lying) out.push('</g>')
  // Kampf: kurze Zeichen, wo es trifft; am Boden kreisen Sterne
  if (pose === 'zuschlagen' && frame % 4 === 1) out.push(`<path d="M${r1(cx + 26 * S)} ${r1(torsoTop - 4)} l3 -4 l1 4 l4 -1 l-3 3 l3 3 l-4 -1 l-1 4 l-2 -4 l-4 1 l3 -3 l-3 -3z" fill="#f1d57a" opacity=".9"/>`)
  if (pose === 'getroffen' && frame % 4 < 2) out.push(`<path d="M${r1(cx - 20 * S)} ${r1(headCy - 6)} l-5 -2 M${r1(cx - 20 * S)} ${r1(headCy)} l-6 0 M${r1(cx - 20 * S)} ${r1(headCy + 6)} l-5 2" stroke="#f1d57a" stroke-width="1.4" stroke-linecap="round"/>`)
  if (lying && a.verletzt) for (let i = 0; i < 3; i++) out.push(`<circle cx="${r1(52 * S + 8 + Math.cos(i * 2.1 + frame) * 6)}" cy="${r1(ground - 14 + Math.sin(i * 2.1 + frame) * 2)}" r="1.4" fill="#f1d57a"/>`)
  const body = out.join('')
  return mirror ? `<g transform="translate(64 0) scale(-1 1)">${body}</g>` : body
}

// ── Aus den Daten der Bevölkerung ─────────────────────────────────────────
// person_appearance kennt Codes (skin_1…6, dark/brown/…, short/long/…, none/short/…,
// child/teen/young_adult/adult/older). Kleidung kommt aus clothing_profile, sonst
// aus Arbeit und Ort – nichts davon ändert die Person.

const SKIN: Record<string, string> = { skin_1: '#f6d7c3', skin_2: '#eabf9f', skin_3: '#d49a6a', skin_4: '#b07a4c', skin_5: '#8a5a36', skin_6: '#5e3b25' }
const HAIRC: Record<string, string> = { dark: '#26201d', brown: '#5b3a24', light: '#d9b563', blond: '#d9b563', red: '#a8452a', grey: GREY, gray: GREY, white: '#e8e4dc' }
const HAIRS: Record<string, KieselHair> = { short: 'kurz', long: 'lang', curly: 'locken', braided: 'zopf', bun: 'dutt', shaved: 'glatze', bald: 'glatze' }
const BEARDS: Record<string, KieselBeard> = { none: 'ohne', stubble: 'stoppeln', short: 'stoppeln', full: 'vollbart', mustache: 'schnurrbart', moustache: 'schnurrbart' }
const AGEMAP: Record<string, KieselAge> = { child: 'kind', teen: 'jung', young_adult: 'erwachsen', adult: 'erwachsen', older: 'aelter', elder: 'alt' }
const BUILDS: Record<string, KieselBuild> = { slender: 'schmal', average: 'mittel', broad: 'kraeftig' }
const TOPS = ['#4f7fa8', '#6a8f5a', '#a8664f', '#7a6aa8', '#c49a3a', '#4f8f8a', '#8f4f5f', '#5f6f7f']
const SKIN_KEYS = Object.keys(SKIN)
const HAIR_KEYS = ['dark', 'brown', 'light', 'red']

function hash(s: string): number { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) } return x >>> 0 }

export interface KieselSource {
  id: string
  appearance?: { genderPresentation?: string; bodyFrame?: string; skinToneCode?: string; hairStyleCode?: string; hairColorCode?: string; facialHairCode?: string; visibleAgeBand?: string; clothingProfile?: Record<string, unknown> } | null
  lifeStage?: string | null
  knownAgeYears?: number | null
  isRobot?: boolean
}

/**
 * Aussehen einer Person für Kiesel. `work` = was sie hier gerade tut
 * (z. B. 'cafe', 'bar', 'restaurant', 'nightclub', 'science', 'space'); daraus die Kleidung,
 * falls clothing_profile nichts sagt. Fehlt das Aussehen, entsteht es fest aus der Kennung.
 */
export function kieselLookFor(p: KieselSource, work?: string | null): KieselLook {
  const ap = p.appearance ?? {}
  const n = hash(p.id)
  const ageBand = p.lifeStage === 'child' ? 'child' : typeof p.knownAgeYears === 'number' ? (p.knownAgeYears < 13 ? 'child' : p.knownAgeYears < 18 ? 'teen' : p.knownAgeYears >= 75 ? 'elder' : p.knownAgeYears >= 55 ? 'older' : 'adult') : ap.visibleAgeBand ?? 'adult'
  const gp = ap.genderPresentation ?? (['feminine', 'masculine', 'androgynous'][n % 3])
  const profile = (ap.clothingProfile ?? {}) as { work?: unknown; style?: unknown; occasion?: unknown }
  const workKey = String(profile.work ?? work ?? '')
  const clothes: KieselClothes =
    /police|polizei/.test(workKey) ? 'polizei'
      : /fire|feuerwehr/.test(workKey) ? 'feuerwehr'
      : /paramedic|ambulance|rettung/.test(workKey) ? 'rettung'
      : /bar|nightclub|pub/.test(workKey) ? 'bar'
      : /cafe|restaurant|hotel|kitchen|service/.test(workKey) ? 'schuerze'
        : /space|eva|mars|pressure/.test(workKey) ? 'druckanzug'
          : /science|lab|clinic|health|research/.test(workKey) ? 'kittel'
            : /engineer|mine|repair|logistic|warehouse|bau/.test(workKey) ? 'overall'
              : /fest|ceremony|worship/.test(String(profile.occasion ?? '')) ? 'fest'
                : gp === 'feminine' && (n >> 5) % 4 === 0 ? 'kleid' : 'alltag'
  const beard = gp === 'feminine' ? 'ohne' : BEARDS[ap.facialHairCode ?? ''] ?? ((n >> 9) % 4 === 0 ? 'stoppeln' : 'ohne')
  return {
    age: AGEMAP[ageBand] ?? 'erwachsen',
    build: BUILDS[ap.bodyFrame ?? ''] ?? (['schmal', 'mittel', 'kraeftig'] as const)[(n >> 3) % 3],
    skin: SKIN[ap.skinToneCode ?? ''] ?? SKIN[SKIN_KEYS[n % SKIN_KEYS.length]],
    hair: HAIRS[ap.hairStyleCode ?? ''] ?? (gp === 'feminine' ? (['lang', 'zopf', 'dutt', 'locken'] as const)[(n >> 4) % 4] : (['kurz', 'kurz', 'locken', 'glatze'] as const)[(n >> 4) % 4]),
    hairColor: HAIRC[ap.hairColorCode ?? ''] ?? HAIRC[HAIR_KEYS[(n >> 6) % HAIR_KEYS.length]],
    beard,
    face: 'freundlich',
    clothes,
    topColor: TOPS[(n >> 7) % TOPS.length],
    robot: Boolean(p.isRobot),
  }
}

/** Blickrichtung aus einer Bewegung auf dem Bildschirm (dx nach rechts, dy nach unten). */
export function kieselDirFrom(dx: number, dy: number, previous: KieselDir = 'se'): KieselDir {
  if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return previous
  const front = dy >= -Math.abs(dx) * .3
  return front ? (dx >= 0 ? 'se' : 'sw') : (dx >= 0 ? 'ne' : 'nw')
}
