// lib/worldlab/treeSprites.ts
// Bäume der Erdkarte als kleine Bilder, im Browser gezeichnet: drei Laubbäume
// und eine Fichte (das Sauerland hat viele). Ansicht 2:1, Fußpunkt unten Mitte.

export const TREE_PX = { w: 48, h: 72 }
/** Breite und Höhe eines Baumbildes in Bildeinheiten der Welt (1 m Höhe = √1,5). */
export const TREE_WORLD = { w: 9, h: 13.5 }
export const TREE_VARIANTS = 4

function rgb(r: number, g: number, b: number, f = 1) {
  return `rgb(${Math.round(Math.min(255, r * f))},${Math.round(Math.min(255, g * f))},${Math.round(Math.min(255, b * f))})`
}

/** Zeichnet Baum `variant` (0–2 Laubbaum, 3 Fichte) auf `ctx` (TREE_PX). */
export function paintTree(ctx: CanvasRenderingContext2D, variant: number) {
  const { w, h } = TREE_PX
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2, foot = h - 4
  // Schatten am Boden
  ctx.fillStyle = 'rgba(25,40,20,0.28)'
  ctx.beginPath(); ctx.ellipse(cx + 5, foot, 14, 5, 0, 0, Math.PI * 2); ctx.fill()
  if (variant === 3) {
    // Fichte: Stamm kurz, drei Lagen nach oben schmaler
    ctx.fillStyle = '#5a4030'
    ctx.fillRect(cx - 1.5, foot - 8, 3, 8)
    for (let i = 0; i < 4; i++) {
      const y = foot - 6 - i * 13, half = 15 - i * 3.2
      ctx.fillStyle = rgb(48, 86, 56, 0.9 + i * 0.05)
      ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.lineTo(cx, y - 22); ctx.closePath(); ctx.fill()
      ctx.fillStyle = rgb(48, 86, 56, 1.18)
      ctx.beginPath(); ctx.moveTo(cx - half * 0.9, y - 1); ctx.lineTo(cx - 1, y - 1); ctx.lineTo(cx, y - 21); ctx.closePath(); ctx.fill()
    }
    return
  }
  const tones = [[86, 130, 70], [100, 140, 72], [74, 118, 66]][variant]
  const r = [15, 13, 17][variant]
  ctx.fillStyle = '#6a4a34'
  ctx.fillRect(cx - 2, foot - 20, 4, 20)
  const crownY = foot - 20 - r * 0.7
  // Krone aus mehreren Kugeln, Licht von links oben
  const blobs = [[0, 0, 1], [-0.55, 0.25, 0.7], [0.55, 0.2, 0.72], [0, -0.45, 0.72], [-0.3, -0.25, 0.6], [0.35, -0.3, 0.6]]
  for (const [dx, dy, s] of blobs) {
    ctx.fillStyle = rgb(tones[0], tones[1], tones[2], 0.85)
    ctx.beginPath(); ctx.arc(cx + dx * r, crownY + dy * r, r * s, 0, Math.PI * 2); ctx.fill()
  }
  for (const [dx, dy, s] of blobs) {
    ctx.fillStyle = rgb(tones[0], tones[1], tones[2], 1.12)
    ctx.beginPath(); ctx.arc(cx + dx * r - r * s * 0.3, crownY + dy * r - r * s * 0.3, r * s * 0.5, 0, Math.PI * 2); ctx.fill()
  }
}

/** Welcher Baum an einer Stelle steht: fest je Ort, damit er beim Neuladen gleich bleibt. */
export function treeVariant(x: number, y: number): number {
  const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
  return h < 0.3 ? 3 : Math.floor(h * 10) % 3
}
