// components/game/BuildingOverlay.tsx
// Erstellt:     26.06.2026
// Aktualisiert: 03.07.2026 — Vollständiges NOXIA-Styling, 5 Sektionen
// Version:      1.1.0
//
// Pure Darstellungskomponente — keine Gebäudelogik, keine Berechnungen.
// Bekommt OverlayDef, rendert 5 Sektionen nach NOXIA-Struktur:
//   1. Kopf           (title, subtitle)
//   2. Was passiert?  (metrics + hint)
//   3. Was fällt auf? (alerts, sortiert nach severity)
//   4. Was tun?       (actions, primary hervorgehoben)
//   5. Warum?         (insight, aufklappbar)

'use client'

import React, { useState } from 'react'
import type { OverlayDef, OverlayMetric, OverlayAlert, OverlayAction } from '@/lib/game/buildings/types'

export type { OverlayDef }

const MONO = "'Courier Prime', monospace"
const SANS = 'system-ui, sans-serif'

const C = {
  bg: '#f8f5ee',
  bgAlt: '#f2ede4',
  bgWhite: '#ffffff',
  border: '#ddd6c8',
  borderLight: '#ece8e0',
  text: '#1a1a18',
  textMuted: '#6b6357',
  textFaint: '#9e9485',
  accent: '#2a4e7a',
  accentLight: '#e8eef6',
  gold: '#8a6a00',
  goldLight: '#faf3e0',
  green: '#1a7a4a',
  greenLight: '#e8f7ef',
  greenBorder: '#a0dcb8',
  red: '#b52a2a',
  redLight: '#faeaea',
  redBorder: '#f0a0a0',
  orange: '#b54a00',
  orangeLight: '#faeee8',
  orangeBorder: '#e8b890',
}

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  critical: { bg: C.redLight, border: C.redBorder, color: C.red, icon: '●' },
  warning: { bg: C.orangeLight, border: C.orangeBorder, color: C.orange, icon: '▲' },
  info: { bg: C.accentLight, border: '#b8cce8', color: C.accent, icon: 'i' },
  success: { bg: C.greenLight, border: C.greenBorder, color: C.green, icon: '✓' },
}

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '—', critical: '!' }
const TREND_COLOR: Record<string, string> = {
  up: C.green,
  down: C.red,
  stable: C.textFaint,
  critical: C.red,
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2, success: 3 }

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: '0.63rem',
      color: C.textFaint,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      fontFamily: MONO,
      marginBottom: '0.5rem',
    }}>
      {text}
    </div>
  )
}

function MetricCard({ m }: { m: OverlayMetric }) {
  const trendColor = m.trend ? (TREND_COLOR[m.trend] ?? C.accent) : C.accent
  const trendIcon = m.trend ? (TREND_ICON[m.trend] ?? '') : ''

  return (
    <div style={{
      background: C.bgWhite,
      border: `1px solid ${C.borderLight}`,
      borderRadius: '9px',
      padding: '0.75rem 0.9rem',
    }}>
      <div style={{
        fontSize: '0.65rem',
        color: C.textFaint,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        fontFamily: MONO,
        marginBottom: '5px',
      }}>
        {m.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: trendColor, fontFamily: MONO, lineHeight: 1 }}>
          {typeof m.value === 'number' ? m.value.toLocaleString('de') : m.value}
        </span>
        {m.unit && <span style={{ fontSize: '0.7rem', color: C.textFaint }}>{m.unit}</span>}
        {trendIcon && (
          <span style={{ fontSize: '0.75rem', color: trendColor, marginLeft: '2px', fontFamily: MONO }}>
            {trendIcon}
          </span>
        )}
      </div>
      {m.hint && (
        <div style={{ fontSize: '0.68rem', color: C.textMuted, marginTop: '4px', lineHeight: 1.4 }}>
          {m.hint}
        </div>
      )}
    </div>
  )
}

function AlertRow({ a }: { a: OverlayAlert; key?: string }) {
  const s = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.info
  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: '9px',
      padding: '0.7rem 0.9rem',
      display: 'flex',
      gap: '0.6rem',
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: '0.75rem', color: s.color, fontFamily: MONO, flexShrink: 0, marginTop: '2px', fontWeight: 700 }}>
        {s.icon}
      </span>
      <span style={{ fontSize: '0.85rem', color: C.text, lineHeight: 1.55, fontFamily: SANS }}>
        {a.text}
      </span>
    </div>
  )
}

function ActionBtn({ a, onAction }: { a: OverlayAction; onAction?: (id: string) => void }) {
  return (
    <button
      disabled={a.disabled}
      onClick={() => !a.disabled && onAction?.(a.id)}
      style={{
        width: '100%',
        padding: '0.75rem 1rem',
        background: a.disabled ? C.bgAlt : a.primary ? C.accent : C.bgWhite,
        color: a.disabled ? C.textFaint : a.primary ? '#ffffff' : C.text,
        border: `1px solid ${a.disabled ? C.border : a.primary ? C.accent : C.border}`,
        borderRadius: '9px',
        cursor: a.disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left' as const,
        fontSize: '0.9rem',
        fontWeight: a.primary ? 700 : 500,
        fontFamily: SANS,
        opacity: a.disabled ? 0.6 : 1,
      }}
    >
      {a.label}
    </button>
  )
}

export interface BuildingOverlayProps {
  overlay: OverlayDef
  onClose: () => void
  onAction?: (actionId: string) => void
}

export default function BuildingOverlay({ overlay, onClose, onAction }: BuildingOverlayProps) {
  const [showInsight, setShowInsight] = useState(false)

  const sortedAlerts = [...overlay.alerts].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        background: 'rgba(2,4,8,0.72)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: 'min(540px, 100vw)',
        background: C.bg,
        borderRadius: '14px 14px 0 0',
        maxHeight: '82vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          padding: '1.1rem 1.4rem 0.85rem',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: C.text, fontFamily: MONO }}>
              {overlay.title}
            </div>
            {overlay.subtitle && (
              <div style={{ fontSize: '0.78rem', color: C.textMuted, marginTop: '3px', fontFamily: SANS }}>
                {overlay.subtitle}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: C.bgAlt,
            border: `1px solid ${C.border}`,
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            color: C.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontFamily: MONO,
          }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' as const, padding: '1.1rem 1.4rem 1.5rem' }}>
          {overlay.metrics.length > 0 && (
            <section style={{ marginBottom: '1.25rem' }}>
              <SectionLabel text="Was passiert hier?" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                {overlay.metrics.map(m => <MetricCard key={m.id} m={m} />)}
              </div>
            </section>
          )}

          {sortedAlerts.length > 0 && (
            <section style={{ marginBottom: '1.25rem' }}>
              <SectionLabel text="Was fällt auf?" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {sortedAlerts.map(a => <AlertRow key={a.id} a={a} />)}
              </div>
            </section>
          )}

          {overlay.actions.length > 0 && (
            <section style={{ marginBottom: '1.25rem' }}>
              <SectionLabel text="Was kann ich tun?" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {overlay.actions.map(a => <ActionBtn key={a.id} a={a} onAction={onAction} />)}
              </div>
            </section>
          )}

          {overlay.insight && (
            <section>
              <button
                onClick={() => setShowInsight(v => !v)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  borderRadius: '9px',
                  padding: '0.6rem 0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: SANS,
                }}
              >
                <span style={{ fontSize: '0.82rem', color: C.textMuted, fontWeight: 700 }}>Warum?</span>
                <span style={{ fontSize: '0.72rem', color: C.textFaint, fontFamily: MONO }}>
                  {showInsight ? '▲' : '▼'}
                </span>
              </button>
              {showInsight && (
                <div style={{
                  marginTop: '0.45rem',
                  padding: '0.85rem 1rem',
                  background: C.goldLight,
                  border: `1px solid ${C.gold}44`,
                  borderRadius: '9px',
                  fontSize: '0.85rem',
                  color: C.text,
                  lineHeight: 1.75,
                  fontFamily: SANS,
                }}>
                  {overlay.insight}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
