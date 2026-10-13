// lib/worldlab/viewTiles.ts
// Welche Kacheln der Bildschirm gerade braucht – abhängig von Kamera und Zoom.
//
// Gezeichnet wird schräg (2:1): ein Bodenpunkt (x nach Osten, y nach Süden, in
// Metern ab der Nordwestecke der Ankerkachel) landet bei
//   u = x − y            (waagerecht im Bild)
//   v = (x + y) · ISO_Y  (senkrecht im Bild, ohne Höhe)
// Im Bild ist jede Kachel eine Raute. Ob sie den sichtbaren Ausschnitt berührt,
// lässt sich genau prüfen: In den Koordinaten (u, v/ISO_Y) ist die Raute ein
// Quadrat mit L1-Radius s um ihre Mitte, der Ausschnitt ein achsparalleles Rechteck.

import type { TileId } from './mercator'

/** Sichtbarer Ausschnitt in Bildkoordinaten der Welt (vor Zoom und Verschiebung). */
export interface ViewRect { left: number; top: number; right: number; bottom: number }

export interface ViewTileOptions {
  anchorTile: TileId
  /** Kantenlänge einer Kachel in Bodenmetern. */
  tileSizeM: number
  /** Stauchung der Senkrechten (2:1-Ansicht: 0,5). */
  isoY: number
}

/** Kacheln, deren Raute den Ausschnitt berührt – die mittlere zuerst. */
export function tilesForView(view: ViewRect, options: ViewTileOptions): TileId[] {
  const { anchorTile, tileSizeM: s, isoY } = options
  const L = view.left, R = view.right, T = view.top / isoY, B = view.bottom / isoY
  // Eckpunkte des Ausschnitts auf dem Boden ergeben den Suchbereich.
  const minX = Math.floor((L + T) / 2 / s), maxX = Math.floor((R + B) / 2 / s)
  const minY = Math.floor((T - R) / 2 / s), maxY = Math.floor((B - L) / 2 / s)
  const cu = (L + R) / 2, cv = (T + B) / 2
  const found: Array<{ tile: TileId; d: number }> = []
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const uc = (tx - ty) * s, vc = (tx + ty + 1) * s
      const du = Math.max(0, L - uc, uc - R), dv = Math.max(0, T - vc, vc - B)
      if (du + dv > s) continue
      found.push({ tile: { x: anchorTile.x + tx, y: anchorTile.y + ty }, d: Math.abs(uc - cu) + Math.abs(vc - cv) })
    }
  }
  found.sort((a, b) => a.d - b.d)
  return found.map(entry => entry.tile)
}

/** Ausschnitt um einen Rand erweitern (in Bildkoordinaten der Welt). */
export function growView(view: ViewRect, by: number, extraBottom = 0): ViewRect {
  return { left: view.left - by, top: view.top - by, right: view.right + by, bottom: view.bottom + by + extraBottom }
}

/**
 * Kleinster Zoom, bei dem höchstens `maxTiles` Kacheln die Bildfläche füllen.
 * Die 2:1-Ansicht erhält Flächen (Determinante 1): Ein Bildschirm von w × h
 * Punkten zeigt bei Zoom z genau w·h/z² Quadratmeter Boden.
 */
export function minZoomForTiles(screenW: number, screenH: number, tileSizeM: number, maxTiles: number): number {
  return Math.sqrt(screenW * screenH / (maxTiles * tileSizeM * tileSizeM))
}
