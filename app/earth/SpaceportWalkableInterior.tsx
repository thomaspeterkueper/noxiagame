'use client'

// app/earth/SpaceportWalkableInterior.tsx
// Der Raumhafen als vierte Einrichtung des allgemeinen Innenraums
// (NOXIA-INTERIOR-0001). Eigen: Ankunftshalle, Flugleitung als Bedienplatz,
// Personal kennt die echten Zielorte und das Schiff des Gastes; das Angebot
// sind die bestehenden Hafenfunktionen – Navigation, Fracht, Wartung, Kantine –
// die als Tafeln darüber öffnen.
// Aktualisiert: 29.10.2026 — Mitflug auf Handelsschiffen: Anheuern an der Flugleitung, Personal kennt die Frachtrouten
// Version:      1.1.1

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { SPACEPORT_INTRODUCTION, SPACEPORT_LAYOUT, spaceportKnowledge, type SpaceportFacts } from '@/lib/game/spaceport/spaceportInterior'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import { learningGateFacts, statusesFromViews } from '@/lib/game/interiors/learningGates'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { getSessionInfo } from '@/lib/supabase/auth'
import { crewKnowledge, crewStatusLine, durationText, sinceText, type CrewState } from '@/lib/game/jobs/crewSignon'

type Props = {
  entityId: string
  buildingName: string
  facts: SpaceportFacts | null
  companion?: ColonyResident | null
  onClose: () => void
  onOpen: (what: 'navigation' | 'cargo' | 'maintenance' | 'canteen') => void
}

export default function SpaceportWalkableInterior({ entityId, buildingName, facts, companion = null, onClose, onOpen }: Props) {
  const ctxRef = useRef<InteriorContext | null>(null)
  const [crew, setCrew] = useState<CrewState | null>(null)
  const [crewBusy, setCrewBusy] = useState(false)
  const [crewNote, setCrewNote] = useState<string | null>(null)
  const loadCrew = useCallback(async (init?: RequestInit) => {
    try {
      const { token } = await getSessionInfo()
      const res = await fetch('/api/game/crew', { ...init, headers: { ...(init?.headers ?? {}), Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setCrewNote(data?.error ?? 'Anheuern ist gerade nicht möglich.'); return }
      if (data) { setCrew(data as CrewState); setCrewNote(null) }
    } catch { setCrewNote('Die Heuerliste ist gerade nicht erreichbar.') }
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => { void loadCrew() }, 0)
    return () => clearTimeout(timer)
  }, [loadCrew])
  async function crewAction(body: Record<string, string>) {
    setCrewBusy(true)
    await loadCrew({ method: 'POST', body: JSON.stringify(body) })
    setCrewBusy(false)
  }
  const knowledge = useMemo(() => [...spaceportKnowledge(facts), ...crewKnowledge(crew)], [facts, crew])
  const layout = SPACEPORT_LAYOUT

  const fitting: InteriorFitting = {
    kind: 'spaceport', layout, noun: layout.noun, locative: layout.locative, sectionLabel: 'HAFEN',
    // Der Hafen ist rund um die Uhr in Betrieb; ohne Personal bleibt die Anzeigetafel.
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'self-service',
    closedText: () => null,
    furnitureLabel: kind => kind === 'counter' ? 'FLUGLEITUNG' : kind === 'board' ? 'ABFLÜGE' : kind === 'pass' ? 'CARGO →' : null,
    decor: { plants: [[130, 112]], rug: null },
    visits: [],
    facts: (self, ctx) => withExtraFacts(
      baseInteriorFacts({ layout, buildingName, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: 'Du arbeitest hier im Raumhafen' }),
      self.roomRole === 'staff' ? [...knowledge, ...learningGateFacts(statusesFromViews('spaceport', ctx.gates), ctx.nearService)] : ['Du wartest hier selbst auf einen Flug; Auskunft gibt die Flugleitung'],
    ),
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => self.roomRole === 'staff' ? SPACEPORT_INTRODUCTION : undefined,
    things: [],
    idleText: 'An der Flugleitung wählst du Ziel und Abflug; durch den Durchgang geht es zu Fracht und Wartung.',
    greetsAtService: true,
    goToServiceLabel: () => 'Zur Flugleitung gehen',
    tableService: false,
    loaded: true,
    renderOffer: ctx => {
      if (!ctx.nearService) return <p className="hint">Abflug, Fracht und Wartung regelst du an der Flugleitung.</p>
      const names = facts?.destinations.map(d => d.name) ?? []
      return <div className="menu">
        <small>ABFLÜGE</small>
        {facts ? <p>{names.length ? 'Ziele: ' + names.slice(0, 6).join(', ') + (names.length > 6 ? ' …' : '') : 'Zurzeit keine Ziele gelistet.'}{facts.hasShip ? ' Dein Schiff liegt im Dock.' : ' Du hast kein eigenes Schiff – Linienflug gegen Ticket.'}</p> : <p>Die Anzeigetafel wird geholt …</p>}
        <div className="tiles">
          <button className="tile" onClick={() => onOpen('navigation')}><span className="domain">Flugleitung</span><span>Abflug & Navigation</span><b>Ziel wählen</b></button>
          <button className="tile" onClick={() => onOpen('cargo')}><span className="domain">Cargo-Terminal</span><span>Fracht & Handel</span><b>Markt öffnen</b></button>
          <button className="tile" onClick={() => onOpen('maintenance')}><span className="domain">Service</span><span>Wartung & Werft</span><b>Schiff prüfen</b></button>
          {facts?.canteen && <button className="tile" onClick={() => onOpen('canteen')}><span className="domain">Hafen</span><span>Hafenkantine</span><b>Wasser & Ration</b></button>}
        </div>
        <small>MITFLIEGEN ALS CREW</small>
        {!crew && !crewNote && <p>Die Heuerliste wird geholt …</p>}
        {crew && crewStatusLine(crew) && <p>{crewStatusLine(crew)}</p>}
        {crew && crew.hasShip && <p className="hint">Mit eigenem Schiff fliegst du selbst; anheuern können Leute ohne Schiff.</p>}
        {crew && !crew.hasShip && crew.routes.length === 0 && <p className="hint">Von hier fährt zurzeit keine Fracht ab.</p>}
        {crew && !crew.hasShip && !crew.inTransit && crew.signon?.status !== 'waiting' && crew.routes.length > 0 && <div className="tiles">
          {crew.routes.map(r => <button key={r.destination} className="tile" disabled={crewBusy} onClick={() => void crewAction({ action: 'sign_on', destination: r.destination })}>
            <span className="domain">Epona Fracht</span><span>Nach {r.name} · {durationText(r.hours)}</span><b>Anheuern · {r.wage} Cr Heuer</b>
            <span className="hint">Letzte Fracht {sinceText(Math.max(0, crew.tick - r.lastDepartTick))}</span>
          </button>)}
        </div>}
        {crew?.signon?.status === 'waiting' && <button className="tile" disabled={crewBusy} onClick={() => void crewAction({ action: 'cancel' })}><span>Von der Heuerliste abmelden</span></button>}
        {crewNote && <p className="hint">{crewNote}</p>}
      </div>
    },
  }

  return <WalkableInterior entityId={entityId} buildingName={buildingName} companion={companion} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx }} />
}
