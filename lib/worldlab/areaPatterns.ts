// lib/worldlab/areaPatterns.ts
// Muster für Flächen der Erdkarte (Wald, Park, Friedhof, Kleingärten, Parkplatz,
// Acker), gezeichnet auf eine Leinwand im Browser. Jede Musterkachel wiederholt
// sich nahtlos; `sizeM` Meter am Boden entsprechen PATTERN_PX Pixeln.

import type { AreaPattern } from './blocks'

export const PATTERN_PX = 128

function rgb(color: number, factor = 1) {
  const c = (shift: number) => Math.max(0, Math.min(255, Math.round(((color >> shift) & 255) * factor)))
  return `rgb(${c(16)},${c(8)},${c(0)})`
}

/** Fester Zufall: dasselbe Muster bei jedem Laden. */
function random(seed: number) {
  let state = seed >>> 0 || 1
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 }
}

/** Zeichnet ein Muster auf `ctx` (PATTERN_PX × PATTERN_PX). */
export function paintPattern(ctx: CanvasRenderingContext2D, pattern: AreaPattern, base: number) {
  const N = PATTERN_PX, px = N / pattern.sizeM
  ctx.fillStyle = rgb(base)
  ctx.fillRect(0, 0, N, N)
  const rnd = random(pattern.kind.length * 7919 + Math.round(pattern.sizeM * 31))
  // Etwas, das über den Rand ragt, auch auf der Gegenseite zeichnen – sonst Nähte.
  const wrapped = (x: number, y: number, r: number, draw: (x: number, y: number) => void) => {
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      if (x + dx + r < 0 || x + dx - r > N || y + dy + r < 0 || y + dy - r > N) continue
      draw(x + dx, y + dy)
    }
  }

  if (pattern.kind === 'trees') {
    const count = Math.max(1, Math.round((pattern.density ?? 1) * pattern.sizeM * pattern.sizeM / 14))
    const crowns = Array.from({ length: count }, () => ({ x: rnd() * N, y: rnd() * N, r: (1.8 + rnd() * 1.6) * px, tone: 0.82 + rnd() * 0.2 }))
    crowns.sort((a, b) => a.y - b.y)
    const crown = 0x4f7d45
    for (const tree of crowns) {
      // Schatten nach rechts unten, Krone, Licht von links oben
      wrapped(tree.x, tree.y, tree.r * 1.4, (x, y) => {
        ctx.fillStyle = 'rgba(30,50,25,0.28)'
        ctx.beginPath(); ctx.ellipse(x + tree.r * 0.45, y + tree.r * 0.35, tree.r, tree.r * 0.8, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = rgb(crown, tree.tone)
        ctx.beginPath(); ctx.arc(x, y, tree.r, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = rgb(crown, tree.tone * 1.25)
        ctx.beginPath(); ctx.arc(x - tree.r * 0.3, y - tree.r * 0.3, tree.r * 0.45, 0, Math.PI * 2); ctx.fill()
      })
    }
  } else if (pattern.kind === 'graves') {
    // Grabreihen alle 2 m, Gräber 1 × 2 m mit Stein am Kopfende, Weg alle 8 m
    ctx.fillStyle = rgb(base, 1.12)
    for (let y = 0; y < N; y += 8 * px) ctx.fillRect(0, y, N, 0.9 * px)
    for (let row = 0; row < pattern.sizeM / 2; row++) {
      const y = row * 2 * px + 1.2 * px
      if (row % 4 === 3) continue
      for (let col = 0; col < pattern.sizeM / 1.6; col++) {
        const x = col * 1.6 * px + 0.3 * px
        ctx.fillStyle = rgb(base, 0.86 + rnd() * 0.08)
        ctx.fillRect(x, y, 1 * px, 1.3 * px)
        ctx.fillStyle = rnd() < 0.5 ? '#9a9a96' : '#7f7f7c'
        ctx.fillRect(x + 0.15 * px, y - 0.2 * px, 0.7 * px, 0.35 * px)
      }
    }
  } else if (pattern.kind === 'plots') {
    // Parzellen 10 × 15 m mit Hecke, Beeten und Laube
    const pw = 10 * px, ph = 15 * px
    for (let y = 0; y < N; y += ph) for (let x = 0; x < N; x += pw) {
      for (let b = 0; b < 5; b++) {
        ctx.fillStyle = b % 2 ? rgb(0x8a6a48, 0.95 + rnd() * 0.1) : rgb(base, 0.9 + rnd() * 0.15)
        ctx.fillRect(x + 1 * px, y + (3 + b * 1.6) * px, pw - 2 * px, 1.2 * px)
      }
      ctx.fillStyle = '#8d6b4c'
      ctx.fillRect(x + pw - 3.4 * px, y + 0.8 * px, 2.4 * px, 2 * px)
      ctx.fillStyle = '#6d5039'
      ctx.fillRect(x + pw - 3.4 * px, y + 0.8 * px, 2.4 * px, 0.5 * px)
      ctx.strokeStyle = rgb(0x4f7d45, 0.9)
      ctx.lineWidth = 0.6 * px
      ctx.strokeRect(x + 0.3 * px, y + 0.3 * px, pw - 0.6 * px, ph - 0.6 * px)
    }
  } else if (pattern.kind === 'stalls') {
    // Stellplätze 2,5 × 5 m beidseits einer Fahrgasse
    ctx.strokeStyle = 'rgba(245,245,240,0.8)'
    ctx.lineWidth = 0.15 * px * 1.5
    for (let x = 0; x <= N; x += 2.5 * px) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 5 * px); ctx.moveTo(x, 10 * px); ctx.lineTo(x, 15 * px); ctx.stroke()
    }
    for (let i = 0; i < 4; i++) {
      if (rnd() < 0.5) continue
      const x = Math.floor(rnd() * 6) * 2.5 * px + 0.4 * px, y = (rnd() < 0.5 ? 0.6 : 10.6) * px
      ctx.fillStyle = ['#7d8fa6', '#a64b3c', '#d8d8d2', '#3f4447'][Math.floor(rnd() * 4)]
      ctx.fillRect(x, y, 1.7 * px, 3.8 * px)
    }
  } else if (pattern.kind === 'rows') {
    ctx.fillStyle = rgb(base, 0.94)
    for (let y = 0; y < N; y += 1.5 * px) ctx.fillRect(0, y, N, 0.5 * px)
  }
}

/**
 * Abbildung Musterpixel → Bildkoordinaten der Welt (2:1-Ansicht): Musterpixel
 * (u, v) liegt am Boden bei (u, v) · sizeM / PATTERN_PX Metern.
 */
export function patternMatrix(sizeM: number, isoY: number) {
  const k = sizeM / PATTERN_PX
  return { a: k, b: k * isoY, c: -k, d: k * isoY, tx: 0, ty: 0 }
}
