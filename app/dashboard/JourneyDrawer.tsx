// app/dashboard/JourneyDrawer.tsx
// Erstellt:     01.07.2026
// Aktualisiert: 09.07.2026 — Commit E: Callbacks durchleiten, Offen-Welt-Hinweis
// Version:      0.2.0
'use client'

import React from 'react'
import JourneyGuideCard from './JourneyGuideCard'
import StarterMissionsCard from './StarterMissionsCard'
import { T } from './ui'

type Props = {
  open: boolean
  currentLocation: string
  onClose: () => void
  onOpenShipyard: () => void
  onOpenWarehouse: () => void
  onOpenTravel: () => void
  onFocusGrid: () => void
  onOpenAcademyHint: () => void
  onActiveStepChange?: (stepId: string | null) => void
  onStepCompleted?: (title: string) => void
  onJourneyCompleted?: (journeyKey: string) => void
}

export default function JourneyDrawer({ open, currentLocation, onClose, ...actions }: Props) {
  if (!open) return null

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1800, background: 'rgba(9,14,22,0.36)', display: 'flex', alignItems: 'stretch' }}
    >
      <aside style={{ width: 'min(460px, 94vw)', background: T.bg, borderRight: `1px solid ${T.line}`, boxShadow: '12px 0 36px rgba(0,0,0,0.22)', padding: '1rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 700 }}>Orientierung</div>
            <h2 style={{ margin: '0.15rem 0 0', color: T.blueDeep, fontFamily: 'Georgia, serif', fontSize: '1.25rem', fontWeight: 400 }}>Spielerreise</h2>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${T.line}`, background: T.surface, color: T.inkSoft, cursor: 'pointer' }}>×</button>
        </div>

        {/* Offene-Welt-Hinweis */}
        <div style={{ background: T.surface, border: `1px solid ${T.lineSoft}`, borderRadius: 8, padding: '0.65rem 0.9rem', marginBottom: '0.85rem', fontSize: '0.68rem', color: T.inkSoft, lineHeight: 1.6 }}>
          Sie können jederzeit mehrere Wege parallel verfolgen oder später wechseln.
          Nach dem ersten Weg stehen Handel, Forschung und Industrie offen.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <JourneyGuideCard
            currentLocation={currentLocation as any}
            onOpenShipyard={actions.onOpenShipyard}
            onOpenWarehouse={actions.onOpenWarehouse}
            onOpenTravel={actions.onOpenTravel}
            onFocusGrid={actions.onFocusGrid}
            onOpenAcademyHint={actions.onOpenAcademyHint}
            onActiveStepChange={actions.onActiveStepChange}
            onStepCompleted={actions.onStepCompleted}
            onJourneyCompleted={actions.onJourneyCompleted}
          />
          <StarterMissionsCard
            onOpenShipyard={actions.onOpenShipyard}
            onOpenWarehouse={actions.onOpenWarehouse}
            onOpenTravel={actions.onOpenTravel}
            onFocusGrid={actions.onFocusGrid}
            onOpenAcademyHint={actions.onOpenAcademyHint}
          />
        </div>
      </aside>
    </div>
  )
}
