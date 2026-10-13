// lib/worldlab/facade.ts
// Zeichenvorlage des Baukastens und die Rechnung, die gezeichnete Fassaden-
// und Dachbilder auf schräg gesehene Wände und Dachflächen legt.
//
// Festgelegt am 13.10.2026 (docs/workstreams/world-map-zeichenvorlage.md):
//   - Ansicht 2:1, geometrisch richtig: Blick 30° von oben, 45° gedreht.
//     Ein Meter nach Osten → (1, ½), nach Süden → (−1, ½), nach oben → (0, −√1,5).
//   - Gezeichnet wird von vorn, flach, 16 Pixel je Meter.
//   - Ein Wandbild ist genau ein Geschoss hoch und wiederholt sich nach rechts
//     und nach oben; ein Dachbild wiederholt sich in beide Richtungen.

/** Pixel je Meter in den gezeichneten Vorlagen. */
export const ART_PX_PER_M = 16
/** Senkrechte Stauchung des Bodens in der 2:1-Ansicht. */
export const ISO_Y = 0.5
/** Bildeinheiten je Höhenmeter – geometrisch richtig zur 2:1-Ansicht (Blick 30° von oben). */
export const ISO_HEIGHT = Math.sqrt(1.5)

export interface Vec { x: number; y: number }

/** Bodenpunkt (Meter, x Ost, y Süd) und Höhe (Meter) → Bildkoordinaten der Welt. */
export function iso(x: number, y: number, h = 0): Vec {
  return { x: x - y, y: (x + y) * ISO_Y - h * ISO_HEIGHT }
}

/** Affine Abbildung im PixiJS-Format: Bildpunkt (a·u + c·v + tx, b·u + d·v + ty). */
export interface Affine { a: number; b: number; c: number; d: number; tx: number; ty: number }

export function apply(m: Affine, u: number, v: number): Vec {
  return { x: m.a * u + m.c * v + m.tx, y: m.b * u + m.d * v + m.ty }
}

/**
 * Wandbild auf eine Wand von `from` nach `to` (Bodenpunkte in Metern), Oberkante
 * in `topM` Metern Höhe. Bildpixel (0, 0) liegt oben an `from`; nach rechts geht
 * es die Wand entlang, nach unten geht es senkrecht hinab. Die Wiederholung des
 * Bildes übernimmt PixiJS. `from` sollte die im Bild linke Ecke sein, damit das
 * Bild nicht gespiegelt erscheint (siehe `leftToRight`).
 */
export function wallMatrix(from: Vec, to: Vec, topM: number): Affine {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1
  const a = iso(from.x, from.y, topM)
  const b = iso(to.x, to.y, topM)
  const s = 1 / ART_PX_PER_M
  return {
    a: (b.x - a.x) / length * s,
    b: (b.y - a.y) / length * s,
    c: 0,
    d: ISO_HEIGHT * s,
    tx: a.x,
    ty: a.y,
  }
}

/** Die beiden Ecken einer Wand so geordnet, dass die erste im Bild links liegt. */
export function leftToRight(p: Vec, q: Vec): [Vec, Vec] {
  return iso(p.x, p.y).x <= iso(q.x, q.y).x ? [p, q] : [q, p]
}

/**
 * Dachbild auf eine Dachfläche. `eaveFrom`/`eaveTo` ist die Traufkante (Boden-
 * punkte in Metern, Höhe `eaveM`), `inward` die waagerechte Richtung von der
 * Traufe zum First (Einheitsvektor), `pitch` das Verhältnis Steigung : Lauf.
 * Im Bild liegen die Ziegelreihen parallel zur Traufe; nach oben geht es den
 * Hang hinauf, Bildpixel (0, 0) liegt an `eaveFrom`. Gemessen wird entlang der
 * Dachfläche, nicht im Grundriss – 16 Pixel je Meter Dachfläche.
 */
export function roofMatrix(eaveFrom: Vec, eaveTo: Vec, eaveM: number, inward: Vec, pitch: number): Affine {
  const length = Math.hypot(eaveTo.x - eaveFrom.x, eaveTo.y - eaveFrom.y) || 1
  const origin = iso(eaveFrom.x, eaveFrom.y, eaveM)
  const along = iso(eaveTo.x, eaveTo.y, eaveM)
  // Ein Meter den Hang hinauf: waagerecht cos α, senkrecht sin α.
  const slope = Math.hypot(1, pitch)
  const run = 1 / slope, rise = pitch / slope
  const up = iso(eaveFrom.x + inward.x * run, eaveFrom.y + inward.y * run, eaveM + rise)
  const s = 1 / ART_PX_PER_M
  return {
    a: (along.x - origin.x) / length * s,
    b: (along.y - origin.y) / length * s,
    // Bild-v wächst nach unten, also den Hang hinab.
    c: -(up.x - origin.x) * s,
    d: -(up.y - origin.y) * s,
    tx: origin.x,
    ty: origin.y,
  }
}
