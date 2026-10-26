'use client'

// lib/grid/PersonPortrait.tsx
// Gezeichnetes Porträt einer Person aus ihren Erscheinungsdaten (person_appearance):
// Kopfform nach Körperbau, Frisur und Haarfarbe, Bart, Altersgruppe (Kind,
// Jugend, jung, erwachsen, älter), Kleidung nach Rolle. Deterministisch je
// Person – dieselbe Person sieht überall gleich aus, ohne Bilddateien.
// Was man nicht weiß, wird nicht erfunden: Ohne Daten entsteht ein neutrales Gesicht.

import React from 'react'
import { npcVisual, type NpcAppearance } from './NpcVisual'

function h(s: string) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) } return x >>> 0 }

const LINE = '#2a2420'

export function PersonPortrait({ id, role, appearance, size = 72, title }: { id: string; role?: string | null; appearance?: NpcAppearance; size?: number; title?: string }) {
  const v = npcVisual(id, role, appearance)
  const n = h(id)
  // Kopfform: schmal, mittel, breit; Kinder rundlicher.
  const child = v.ageBand === 'child', teen = v.ageBand === 'teen', older = v.ageBand === 'older', young = v.ageBand === 'young_adult'
  const rx = (v.bodyFrame === 'slender' ? 17 : v.bodyFrame === 'broad' ? 21 : 19) + (child ? 2 : 0)
  const ry = child ? rx + 1 : 23
  const cx = 40, cy = 40
  const eyeY = cy - 2, eyeDx = rx * 0.45
  const eyeShape = n % 3 // 0 rund, 1 mandel, 2 schmal
  const mouthW = 6 + (n >> 4) % 4
  const smile = (n >> 6) % 3 !== 0 ? 2 : 0
  const hairDark = shade(v.hair, -18), hairLight = shade(v.hair, 22)
  const skinShade = shade(v.skin, -22)
  const fem = v.genderPresentation === 'feminine', masc = v.genderPresentation === 'masculine'
  const hairStyle = v.hairStyle
  const hair = (() => {
    const top = cy - ry
    switch (hairStyle) {
      case 'shaved': return <ellipse cx={cx} cy={top + 6} rx={rx - 1} ry={5} fill={v.hair} opacity=".55" />
      case 'long': return <>
        <path d={`M${cx - rx - 6} ${cy + 22} Q${cx - rx - 9} ${top + 2} ${cx} ${top - 9} Q${cx + rx + 9} ${top + 2} ${cx + rx + 6} ${cy + 22} Q${cx} ${cy + 30} ${cx - rx - 6} ${cy + 22} Z`} fill={v.hair} />
        <path d={`M${cx - rx - 1} ${top + 12} Q${cx} ${top - 6} ${cx + rx + 1} ${top + 12}`} fill="none" stroke={hairLight} strokeWidth="2" opacity=".5" />
      </>
      case 'curly': return <>
        {[-1, -0.6, -0.2, 0.2, 0.6, 1].map((t, i) => <circle key={i} cx={cx + t * (rx + 1)} cy={top + 4 + Math.abs(t) * 6} r={7} fill={i % 2 ? v.hair : hairDark} />)}
        <circle cx={cx} cy={top - 1} r={8} fill={v.hair} />
      </>
      case 'braided': return <>
        <path d={`M${cx - rx - 1} ${top + 12} Q${cx} ${top - 9} ${cx + rx + 1} ${top + 12} V${top + 6} Q${cx} ${top - 2} ${cx - rx - 1} ${top + 6} Z`} fill={v.hair} />
        <path d={`M${cx + rx - 2} ${top + 10} q6 10 4 26`} fill="none" stroke={v.hair} strokeWidth="5" strokeLinecap="round" />
        <path d={`M${cx + rx - 2} ${top + 10} q6 10 4 26`} fill="none" stroke={hairLight} strokeWidth="1" strokeDasharray="2 3" opacity=".7" />
      </>
      default: return <path d={`M${cx - rx - 1} ${top + 13} Q${cx - rx} ${top - 4} ${cx} ${top - 5} Q${cx + rx} ${top - 4} ${cx + rx + 1} ${top + 13} Q${cx + rx * .5} ${top + 4} ${cx} ${top + 6} Q${cx - rx * .5} ${top + 4} ${cx - rx - 1} ${top + 13} Z`} fill={v.hair} />
    }
  })()
  const greyed = older && !['light', 'grey'].includes(appearance?.hairColorCode ?? '')
  return <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label={title ?? 'Porträt'} style={{ display: 'block', flex: 'none' }}>
    {title && <title>{title}</title>}
    <defs><clipPath id={`pp-${n}`}><circle cx="40" cy="40" r="38" /></clipPath></defs>
    <circle cx="40" cy="40" r="38" fill={shade(v.suit, 30)} opacity=".35" />
    <g clipPath={`url(#pp-${n})`}>
      {/* Schultern und Kleidung */}
      <path d={`M${cx - rx - 14} 84 Q${cx - rx - 10} 60 ${cx - 8} 58 L${cx + 8} 58 Q${cx + rx + 10} 60 ${cx + rx + 14} 84 Z`} fill={v.suit} stroke={LINE} strokeWidth="1.5" />
      <path d={`M${cx - 7} 58 L${cx} 66 L${cx + 7} 58`} fill={v.skin} stroke={LINE} strokeWidth="1" />
      <rect x={cx - 9} y={68} width="18" height="3" fill={v.accent} />
      {/* Hals */}
      <rect x={cx - 6} y={cy + ry - 6} width="12" height="12" fill={skinShade} />
      {/* Langes Haar hinter dem Kopf */}
      {hairStyle === 'long' && hair}
      {/* Kopf */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={v.skin} stroke={LINE} strokeWidth="1.5" />
      {/* Ohren */}
      <ellipse cx={cx - rx} cy={cy + 1} rx="3" ry="4.5" fill={v.skin} stroke={LINE} strokeWidth="1" />
      <ellipse cx={cx + rx} cy={cy + 1} rx="3" ry="4.5" fill={v.skin} stroke={LINE} strokeWidth="1" />
      {/* Haar vor dem Kopf */}
      {hairStyle !== 'long' && hair}
      {greyed && <ellipse cx={cx} cy={cy - ry + 6} rx={rx - 2} ry={6} fill="#cfc9bd" opacity=".45" />}
      {/* Augenbrauen */}
      <path d={`M${cx - eyeDx - 4} ${eyeY - 7} q4 ${masc ? -3 : -2} 8 0`} fill="none" stroke={hairDark} strokeWidth={masc ? 2.2 : 1.4} strokeLinecap="round" />
      <path d={`M${cx + eyeDx - 4} ${eyeY - 7} q4 ${masc ? -3 : -2} 8 0`} fill="none" stroke={hairDark} strokeWidth={masc ? 2.2 : 1.4} strokeLinecap="round" />
      {/* Augen */}
      {[cx - eyeDx, cx + eyeDx].map((ex, i) => <g key={i}>
        {eyeShape === 2
          ? <path d={`M${ex - 4} ${eyeY} q4 -3 8 0 q-4 3 -8 0`} fill="#fff" stroke={LINE} strokeWidth="1" />
          : <ellipse cx={ex} cy={eyeY} rx={eyeShape === 1 ? 4 : 3.4} ry={eyeShape === 1 ? 2.6 : 3.2} fill="#fff" stroke={LINE} strokeWidth="1" />}
        <circle cx={ex + 0.5} cy={eyeY} r={eyeShape === 2 ? 1.3 : 1.7} fill="#2a2420" />
        {fem && <path d={`M${ex - 4} ${eyeY - 2} q4 -3 8 0`} fill="none" stroke={LINE} strokeWidth="1.2" />}
      </g>)}
      {/* Nase */}
      <path d={`M${cx} ${eyeY + 2} q${masc ? 3.5 : 2.5} 7 0 8`} fill="none" stroke={skinShade} strokeWidth="1.5" strokeLinecap="round" />
      {/* Mund */}
      <path d={`M${cx - mouthW / 2} ${cy + 11} q${mouthW / 2} ${smile + 2} ${mouthW} 0`} fill="none" stroke={shade(v.skin, -55)} strokeWidth="1.6" strokeLinecap="round" />
      {/* Alter: Falten */}
      {older && <>
        <path d={`M${cx - eyeDx - 6} ${eyeY + 1} q-2 2 -1 5`} fill="none" stroke={skinShade} strokeWidth="1" />
        <path d={`M${cx + eyeDx + 6} ${eyeY + 1} q2 2 1 5`} fill="none" stroke={skinShade} strokeWidth="1" />
        <path d={`M${cx - 6} ${cy + 6} q-3 4 -3 8`} fill="none" stroke={skinShade} strokeWidth="1" />
        <path d={`M${cx + 6} ${cy + 6} q3 4 3 8`} fill="none" stroke={skinShade} strokeWidth="1" />
        <path d={`M${cx - 10} ${cy - 15} h20`} fill="none" stroke={skinShade} strokeWidth="1" opacity=".6" />
      </>}
      {(young || teen) && <ellipse cx={cx - eyeDx - 1} cy={cy + 6} rx="4" ry="2" fill="#e07a7a" opacity=".22" />}
      {(young || teen) && <ellipse cx={cx + eyeDx + 1} cy={cy + 6} rx="4" ry="2" fill="#e07a7a" opacity=".22" />}
      {/* Bart */}
      {v.facialHair === 'short' && <path d={`M${cx - rx + 3} ${cy + 4} Q${cx} ${cy + ry + 6} ${cx + rx - 3} ${cy + 4} Q${cx + rx - 6} ${cy + 14} ${cx} ${cy + 16} Q${cx - rx + 6} ${cy + 14} ${cx - rx + 3} ${cy + 4} Z`} fill={v.hair} opacity=".8" />}
      {v.facialHair === 'full' && <path d={`M${cx - rx + 2} ${cy + 2} Q${cx} ${cy + ry + 12} ${cx + rx - 2} ${cy + 2} L${cx + rx - 4} ${cy + 10} Q${cx} ${cy + 8} ${cx - rx + 4} ${cy + 10} Z`} fill={v.hair} />}
      {v.facialHair === 'moustache' && <path d={`M${cx - 7} ${cy + 9} q7 -4 14 0 q-7 1 -14 0`} fill={v.hair} />}
    </g>
    <circle cx="40" cy="40" r="38" fill="none" stroke={v.accent} strokeWidth="2.5" />
  </svg>
}

/** Farbe aufhellen (positiv) oder abdunkeln (negativ), in Prozentpunkten. */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount / 100) * (amount > 0 ? 255 - c : c))))
  const r = f(num >> 16), g = f((num >> 8) & 255), b = f(num & 255)
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}
