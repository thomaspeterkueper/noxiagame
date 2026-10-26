'use client'

// app/earth/AcademyWalkableInterior.tsx
// Die Akademie als zweite Einrichtung des allgemeinen Innenraums
// (NOXIA-INTERIOR-0001). Eigen sind hier: der Lernraum-Grundriss, das Personal
// mit seinem Wissen über die echten Lernmodule, und das Angebot – die Module
// als Kacheln, die den Lernraum (SchoolOverlay) öffnen. Bewegung, Personen,
// Gespräch und Tafel kommen vom Motor.

import { useEffect, useMemo, useRef, useState } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { ACADEMY_INTRODUCTION, ACADEMY_LAYOUT, academyKnowledge } from '@/lib/game/academy/academyInterior'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import type { SsfKnowledgeModule } from '@/lib/ssfKnowledge'

type Props = {
  entityId: string
  buildingName: string
  companion?: ColonyResident | null
  onClose: () => void
  /** Öffnet den Lernraum (bestehendes SchoolOverlay), ggf. mit einem Modul. */
  onOpenSchool: (moduleId?: string) => void
}

export default function AcademyWalkableInterior({ entityId, buildingName, companion = null, onClose, onOpenSchool }: Props) {
  const [modules, setModules] = useState<SsfKnowledgeModule[]>([])
  const [modulesState, setModulesState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const ctxRef = useRef<InteriorContext | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const response = await fetch('/api/ssf/modules', { cache: 'no-store' })
        const data = await response.json()
        if (!live) return
        if (response.ok && Array.isArray(data.modules)) { setModules(data.modules); setModulesState('ready') } else setModulesState('failed')
      } catch { if (live) setModulesState('failed') }
    })()
    return () => { live = false }
  }, [])

  const knowledge = useMemo(() => academyKnowledge(modules), [modules])
  const layout = ACADEMY_LAYOUT

  const fitting: InteriorFitting = {
    kind: 'academy', layout, noun: layout.noun, locative: layout.locative, sectionLabel: 'AKADEMIE',
    // Die Akademie ist offen, solange jemand da ist; ohne Personal bleibt der Lernraum offen, nur das Sekretariat ist leer.
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'self-service',
    closedText: () => null,
    furnitureLabel: kind => kind === 'desk' ? 'SEKRETARIAT' : kind === 'lectern' ? 'PULT' : kind === 'board' ? 'TAFEL' : null,
    decor: { plants: [[130, 112], [700, 420]], rug: null },
    visits: [],
    facts: (self, ctx) => withExtraFacts(
      baseInteriorFacts({ layout, buildingName, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: 'Du arbeitest hier in der Akademie' }),
      self.roomRole === 'staff' ? knowledge : ['Welche Module es gibt, steht am Sekretariat; du bist selbst nur zu Besuch'],
    ),
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => self.roomRole === 'staff' ? ACADEMY_INTRODUCTION : undefined,
    things: [],
    idleText: 'Am Sekretariat siehst du die Lernmodule; im Lernraum kannst du lernen und Prüfungen ablegen.',
    greetsAtService: true,
    goToServiceLabel: () => 'Zum Sekretariat gehen',
    tableService: false,
    loaded: true,
    renderOffer: ctx => {
      if (!ctx.nearService) return <p className="hint">Die Lernmodule bekommst du am Sekretariat.</p>
      return <div className="menu">
        <small>LERNMODULE</small>
        {modulesState === 'loading' && <p>Die Modulliste wird geholt …</p>}
        {modulesState === 'failed' && <p>Die Modulliste ist gerade nicht erreichbar.</p>}
        {modulesState === 'ready' && modules.length === 0 && <p>Zurzeit werden keine Module angeboten.</p>}
        {modules.length > 0 && <>
          <p>{modules.length} Module. Öffne eines, um im Lernraum zu lernen.</p>
          <div className="tiles">{modules.slice(0, 12).map(module => <button key={module.id} className="tile" onClick={() => onOpenSchool(module.id)} title={module.summary}>
            <span className="domain">{module.domain}</span>
            <span>{module.title}</span><b>{module.durationMinutes} min · Stufe {module.difficulty}</b>
          </button>)}</div>
          {modules.length > 12 && <p>… und {modules.length - 12} weitere im Lernraum.</p>}
        </>}
        <button className="open-school" onClick={() => onOpenSchool()}>Lernraum öffnen</button>
      </div>
    },
  }

  return <WalkableInterior entityId={entityId} buildingName={buildingName} companion={companion} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx }} />
}
