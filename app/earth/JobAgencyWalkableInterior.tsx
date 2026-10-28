'use client'

// app/earth/JobAgencyWalkableInterior.tsx
// Die Agentur für Arbeit als Einrichtung des allgemeinen Innenraums
// (NOXIA-INTERIOR-0001; Thomas, 28.10.2026: „es sollte auch eine
// Arbeitsvermittlung geben“). Eigen: Stellenwand mit den freien Schichten in
// den Lokalen des Ortes (aus den echten Gebäuden), Vermittlerin, die genau
// diese Liste kennt, Beratungstisch. Angenommen wird im Lokal selbst.

import { useEffect, useMemo, useRef, useState } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { JOB_AGENCY_INTRODUCTION, JOB_AGENCY_LAYOUT, JOB_CATEGORY_LABEL, distanceM, jobAgencyKnowledge, venueJobOffers, type AgencyBuilding, type JobOffer } from '@/lib/game/jobs/jobAgency'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ColonyResident } from '@/lib/store/colonyStateStore'

type Props = { entityId: string; buildingName: string; companion?: ColonyResident | null; onClose: () => void }

const distanceText = (m: number) => m < 950 ? `ca. ${Math.max(50, Math.round(m / 50) * 50)} m` : `ca. ${(Math.round(m / 100) / 10).toLocaleString('de-DE')} km`

export default function JobAgencyWalkableInterior({ entityId, buildingName, companion = null, onClose }: Props) {
  const [offers, setOffers] = useState<JobOffer[] | null>(null)
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null)
  const ctxRef = useRef<InteriorContext | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const { token } = await getSessionInfo()
        const headers = { Authorization: 'Bearer ' + token }
        // Erst die Stellenliste des Arbeitsmarkts (R-21), sonst aus den Gebäuden des Ortes.
        const [jobs, map] = await Promise.all([
          fetch('/api/game/jobs?location=earth', { headers, cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/world-lab/buildings', { headers, cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        ])
        if (!live) return
        const buildings: AgencyBuilding[] = Array.isArray(map?.buildings) ? map.buildings.map((b: any) => ({ id: String(b.id), typeId: String(b.typeId), name: String(b.name), lat: Number(b.lat), lon: Number(b.lon) })) : []
        const self = buildings.find(b => b.id === entityId)
        if (self) setHere({ lat: self.lat, lon: self.lon })
        const server = jobs && typeof jobs.venues === 'object' ? jobs.venues : null
        setOffers(venueJobOffers(buildings, server))
      } catch { if (live) setOffers([]) }
    })()
    return () => { live = false }
  }, [entityId])

  const knowledge = useMemo(() => jobAgencyKnowledge(offers), [offers])
  const layout = JOB_AGENCY_LAYOUT
  // In der Nähe zuerst, dann nach Lohn.
  const shown = useMemo(() => !offers ? [] : here ? [...offers].sort((a, b) => distanceM(here, a) - distanceM(here, b) || b.wage - a.wage) : offers, [offers, here])

  const fitting: InteriorFitting = {
    kind: 'job_agency', layout, noun: layout.noun, locative: layout.locative, sectionLabel: 'VERMITTLUNG',
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'self-service',
    closedText: () => null,
    furnitureLabel: kind => kind === 'counter' ? 'VERMITTLUNG' : kind === 'board' ? 'STELLEN' : null,
    decor: { plants: [[400, 112], [700, 420]], rug: { x: 150, y: 125, w: 300, h: 120 } },
    visits: [],
    facts: (self, ctx) => withExtraFacts(
      baseInteriorFacts({ layout, buildingName, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: 'Du arbeitest hier in der Arbeitsvermittlung' }),
      self.roomRole === 'staff' ? knowledge : ['Du wartest hier selbst; die Stellen hängen an der Wand'],
    ),
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => self.roomRole === 'staff' ? JOB_AGENCY_INTRODUCTION : undefined,
    things: [],
    idleText: 'An der Stellenwand hängen die freien Schichten im Ort; an der Vermittlung berät man dich.',
    greetsAtService: true,
    goToServiceLabel: () => 'Zur Vermittlung gehen',
    tableService: false,
    loaded: true,
    renderOffer: ctx => <div className="menu agency">
      <small>STELLENWAND · {JOB_CATEGORY_LABEL.venue.toUpperCase()}</small>
      {!offers && <p>Die Stellen werden geholt …</p>}
      {offers && shown.length === 0 && <p>Gerade ist in den Lokalen nichts frei.</p>}
      {shown.slice(0, ctx.nearService ? 10 : 5).map(o => <div key={o.buildingId + o.role} className="job">
        <span><b>{o.roleLabel}</b> · {o.placeName} <em>({o.placeKind})</em></span>
        <span>{o.gameHours} Std · {o.wage} Cr{o.paid ? '' : ' (Probe)'}{here ? ' · ' + distanceText(distanceM(here, o)) : ''}</span>
      </div>)}
      {offers && shown.length > (ctx.nearService ? 10 : 5) && <p className="hint">… und {shown.length - (ctx.nearService ? 10 : 5)} weitere{ctx.nearService ? '' : ' – die ganze Liste an der Vermittlung'}.</p>}
      {offers && shown.length > 0 && <p className="hint">Angenommen wird im Lokal unter „Arbeiten“. Ein Einsatz dauert wenige Minuten und zählt als ganze Schicht.</p>}
      <small>BALD</small>
      <p className="hint">{JOB_CATEGORY_LABEL.business} · {JOB_CATEGORY_LABEL.ship} · {JOB_CATEGORY_LABEL.permanent} – folgt.</p>
    </div>,
  }

  return <>
    <WalkableInterior entityId={entityId} buildingName={buildingName} companion={companion} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx }} />
    <style jsx global>{`.walkable-interior .room.job_agency{--wall:#e6ebe8;--panel:#8fa6a0;--rail:#4f6a63;--floor:#cfd2c8;--plank:#bfc2b6;--top:#eef0e8}.walkable-interior .room.job_agency .counter{background:linear-gradient(#eef0e8 0 30%,#4f6a63 30%)}.walkable-interior .room.job_agency .counter .machine,.walkable-interior .room.job_agency .counter .vitrine{display:none}.walkable-interior .room.job_agency .board{background:#f4f1e6;border-color:#4f6a63}.walkable-interior .room.job_agency .board:after{background:repeating-linear-gradient(90deg,#c84d4d 0 18px,transparent 18px 26px,#3b8f6a 26px 44px,transparent 44px 52px);height:6px;top:7px;width:85%}.walkable-interior .menu.agency .job{display:flex;flex-direction:column;gap:1px;margin-top:6px;padding:6px 8px;border:1px solid #3b5f55;border-radius:5px;background:#0f2a26;font-size:11px}.walkable-interior .menu.agency .job em{color:#9fb5b0;font-style:normal}.walkable-interior .menu.agency .job span:last-child{color:#f1d57a;font-size:10px}`}</style>
  </>
}
