// lib/worldlab/treeSprites.ts
// Bäume und Büsche der Erdkarte als kleine Bilder, im Browser gezeichnet –
// schlicht wie die Häuser, aber je Art an der Form erkennbar (05.11.2026).
// Ansicht 2:1, Fußpunkt unten Mitte, Licht von links oben.

import type { Foliage, PlantForm, PlantSpecies } from './plants'

export const TREE_PX = { w: 48, h: 80 }
/** Breite und Höhe eines Bildes in Bildeinheiten der Welt (1 m Höhe = √1,5) bei 12 m Baumhöhe. */
export const TREE_WORLD = { w: 9, h: 15 }
export const TREE_BASE_HEIGHT_M = 12

function shadeHex(hex: string, f: number) {
  const v = [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * f)))
  return `rgb(${v[0]},${v[1]},${v[2]})`
}

/** Schlüssel für ein Bild: gleiche Art und gleiches Laub teilen sich ein Bild. */
export function plantTextureKey(species: PlantSpecies, f: Foliage) {
  return `${species.id}|${Math.round(f.leaf * 10)}|${f.color}|${f.blossom ?? ''}|${f.fruit ?? ''}`
}

/** Zeichnet eine Art mit ihrem heutigen Laub auf `ctx` (TREE_PX). */
export function paintPlant(ctx: CanvasRenderingContext2D, species: PlantSpecies, f: Foliage) {
  const { w, h } = TREE_PX
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2, foot = h - 4
  const form: PlantForm = species.form
  const leaf = Math.max(0, Math.min(1, f.leaf))
  const low = form === 'bush' || form === 'hedge'
  // Schatten am Boden (kahle Bäume werfen weniger)
  ctx.fillStyle = `rgba(25,40,20,${0.12 + 0.16 * leaf})`
  ctx.beginPath(); ctx.ellipse(cx + 5, foot, low ? 16 : 14, 5, 0, 0, Math.PI * 2); ctx.fill()

  const blobs = (centres: number[][], r: number, cy: number, color: string, alpha = 1) => {
    ctx.globalAlpha = alpha
    for (const [dx, dy, s] of centres) { ctx.fillStyle = shadeHex(color, 0.85); ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, r * s, 0, Math.PI * 2); ctx.fill() }
    for (const [dx, dy, s] of centres) { ctx.fillStyle = shadeHex(color, 1.12); ctx.beginPath(); ctx.arc(cx + dx * r - r * s * 0.3, cy + dy * r - r * s * 0.3, r * s * 0.5, 0, Math.PI * 2); ctx.fill() }
    ctx.globalAlpha = 1
  }
  const dots = (cy: number, r: number, color: string, n: number) => {
    ctx.fillStyle = color
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, d = Math.sqrt((i + 0.5) / n) * r
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 1.3, 0, Math.PI * 2); ctx.fill()
    }
  }
  const trunk = (top: number, width: number, color = species.bark) => { ctx.fillStyle = color; ctx.fillRect(cx - width / 2, top, width, foot - top) }
  // Kahle Äste: Zweige vom Stamm nach außen, sichtbar, solange wenig Laub hängt
  const branches = (from: number, r: number, cy: number) => {
    if (leaf > 0.55) return
    // Zweige dunkel, auch bei der Birke mit weißem Stamm
    ctx.strokeStyle = species.form === 'slender' ? '#6a5446' : species.bark; ctx.lineCap = 'round'
    ctx.globalAlpha = 1 - leaf
    for (const [ex, ey, wd] of [[-0.9, -0.2, 1.6], [0.9, -0.3, 1.6], [-0.5, -0.9, 1.3], [0.45, -0.95, 1.3], [0, -1.05, 1.4], [-0.95, 0.35, 1.1], [0.95, 0.3, 1.1]]) {
      ctx.lineWidth = wd
      ctx.beginPath(); ctx.moveTo(cx, from); ctx.quadraticCurveTo(cx + ex * r * 0.3, cy + ey * r * 0.4, cx + ex * r, cy + ey * r); ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  switch (form) {
    case 'cone': case 'larch': {
      // Fichte (dicht, dunkel) und Lärche (lichter, hellgrün, im Herbst golden, im Winter kahl)
      trunk(foot - 9, 3)
      const layers = form === 'cone' ? 4 : 4, width = form === 'cone' ? 15 : 12
      if (form === 'larch' && leaf < 0.5) {
        ctx.fillStyle = species.bark; ctx.fillRect(cx - 1, foot - 62, 2, 54)
        ctx.strokeStyle = species.bark; ctx.lineWidth = 0.9
        for (let i = 0; i < 6; i++) { const y = foot - 14 - i * 8, half = width - i * 1.8; ctx.beginPath(); ctx.moveTo(cx - half, y + 3); ctx.lineTo(cx, y); ctx.lineTo(cx + half, y + 3); ctx.stroke() }
        if (leaf <= 0.05) break
      }
      ctx.globalAlpha = form === 'larch' ? Math.max(0.15, leaf) : 1
      for (let i = 0; i < layers; i++) {
        const y = foot - 7 - i * 13, half = width - i * (width / 4.6)
        ctx.fillStyle = shadeHex(f.color, 0.92 + i * 0.05)
        ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.lineTo(cx, y - 22); ctx.closePath(); ctx.fill()
        ctx.fillStyle = shadeHex(f.color, 1.2)
        ctx.beginPath(); ctx.moveTo(cx - half * 0.9, y - 1); ctx.lineTo(cx - 1, y - 1); ctx.lineTo(cx, y - 21); ctx.closePath(); ctx.fill()
      }
      ctx.globalAlpha = 1
      break
    }
    case 'pine': {
      // Kiefer: langer, oben rötlicher Stamm, flache Schirmkrone
      trunk(foot - 46, 3, species.bark)
      ctx.fillStyle = '#5a4030'; ctx.fillRect(cx - 1.5, foot - 18, 3, 18)
      blobs([[0, 0, 1], [-0.75, 0.15, 0.7], [0.75, 0.1, 0.72], [-0.3, -0.35, 0.7], [0.35, -0.3, 0.66]], 11, foot - 52, f.color)
      break
    }
    case 'column': {
      // Pyramidenpappel: schmal und hoch
      trunk(foot - 12, 3)
      branches(foot - 12, 9, foot - 40)
      ctx.globalAlpha = Math.max(0, leaf)
      ctx.fillStyle = shadeHex(f.color, 0.88); ctx.beginPath(); ctx.ellipse(cx, foot - 40, 8, 30, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = shadeHex(f.color, 1.15); ctx.beginPath(); ctx.ellipse(cx - 2.5, foot - 46, 3.5, 20, 0, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      break
    }
    case 'slender': {
      // Birke: weißer Stamm mit dunklen Querstrichen, lockere, schmale Krone
      trunk(foot - 34, 3, species.bark)
      ctx.fillStyle = '#2a2a28'
      for (let y = foot - 32; y < foot - 2; y += 5) ctx.fillRect(cx - 1.5 + ((y * 7) % 3) - 1, y, 2, 1)
      branches(foot - 30, 11, foot - 40)
      if (leaf > 0.02) blobs([[0, 0, 0.85], [-0.55, 0.3, 0.6], [0.55, 0.25, 0.62], [0, -0.55, 0.62], [-0.35, -0.3, 0.5], [0.4, -0.35, 0.5]], 11, foot - 42, f.color, Math.max(0.2, leaf))
      break
    }
    case 'weeping': {
      // Weide: breite Krone mit hängenden Zweigen
      trunk(foot - 22, 4)
      branches(foot - 20, 14, foot - 34)
      if (leaf > 0.02) {
        blobs([[0, 0, 1], [-0.6, 0.15, 0.7], [0.6, 0.15, 0.7], [0, -0.45, 0.7]], 14, foot - 36, f.color, Math.max(0.2, leaf))
        ctx.strokeStyle = shadeHex(f.color, 0.95); ctx.lineWidth = 1.2; ctx.globalAlpha = Math.max(0.2, leaf)
        for (let i = -4; i <= 4; i++) { const x = cx + i * 3.6; ctx.beginPath(); ctx.moveTo(x, foot - 34); ctx.quadraticCurveTo(x + i * 0.8, foot - 22, x + i * 1.2, foot - 12 + Math.abs(i)); ctx.stroke() }
        ctx.globalAlpha = 1
      }
      break
    }
    case 'small': {
      // Obstbaum: kurzer Stamm, niedrige, breite runde Krone
      trunk(foot - 13, 3)
      branches(foot - 12, 12, foot - 24)
      if (leaf > 0.02) blobs([[0, 0, 1], [-0.65, 0.2, 0.72], [0.65, 0.2, 0.72], [-0.3, -0.4, 0.66], [0.35, -0.38, 0.66]], 11, foot - 24, f.color, Math.max(0.2, leaf))
      if (f.blossom) dots(foot - 25, 13, f.blossom, 34)
      if (f.fruit) dots(foot - 23, 11, f.fruit, 12)
      break
    }
    case 'bush': {
      // Strauch: ohne Stamm, niedrige Kugeln
      if (leaf < 0.5) {
        ctx.strokeStyle = species.bark; ctx.lineWidth = 1
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 1.2, foot - 2); ctx.lineTo(cx + i * 4.2, foot - 22 + Math.abs(i) * 2); ctx.stroke() }
      }
      if (leaf > 0.02) blobs([[0, 0, 1], [-0.75, 0.25, 0.78], [0.75, 0.25, 0.78], [-0.3, -0.3, 0.7], [0.35, -0.3, 0.7]], 10, foot - 12, f.color, Math.max(0.2, leaf))
      if (f.blossom) dots(foot - 14, 11, f.blossom, 16)
      if (f.fruit) dots(foot - 12, 10, f.fruit, 14)
      break
    }
    case 'hedge': {
      ctx.fillStyle = shadeHex(f.color, 0.85); ctx.beginPath(); ctx.roundRect(cx - 17, foot - 16, 34, 15, 5); ctx.fill()
      ctx.fillStyle = shadeHex(f.color, 1.12); ctx.beginPath(); ctx.roundRect(cx - 15, foot - 16, 24, 6, 3); ctx.fill()
      break
    }
    case 'broad': {
      // Eiche: dicker Stamm, breite, knorrige Krone aus vielen Ballen
      trunk(foot - 22, 6)
      branches(foot - 20, 17, foot - 36)
      if (leaf > 0.02) blobs([[0, 0, 0.9], [-0.7, 0.1, 0.62], [0.72, 0.05, 0.62], [-0.35, -0.5, 0.58], [0.4, -0.48, 0.6], [-0.9, -0.25, 0.42], [0.95, -0.25, 0.44], [0, 0.35, 0.55]], 16, foot - 36, f.color, Math.max(0.2, leaf))
      break
    }
    case 'dome': default: {
      // Buche, Linde, Ahorn, Kastanie: hohe, runde Kuppel
      trunk(foot - 22, 4)
      branches(foot - 20, 15, foot - 38)
      if (leaf > 0.02) blobs([[0, 0, 1], [-0.55, 0.25, 0.7], [0.55, 0.2, 0.72], [0, -0.45, 0.72], [-0.3, -0.25, 0.6], [0.35, -0.3, 0.6]], 15, foot - 38, f.color, Math.max(0.2, leaf))
      if (f.blossom) dots(foot - 40, 15, f.blossom, 22)
      break
    }
  }
}
