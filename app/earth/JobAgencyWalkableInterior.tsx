'use client'

// app/earth/JobAgencyWalkableInterior.tsx
// Die Agentur für Arbeit als Einrichtung des allgemeinen Innenraums
// (NOXIA-INTERIOR-0001; Thomas, 28.10.2026: „es sollte auch eine
// Arbeitsvermittlung geben“). Eigen: Stellenwand mit den freien Schichten in
// den Lokalen des Ortes (aus den echten Gebäuden), Vermittlerin, die genau
// diese Liste kennt, Beratungstisch. Angenommen wird im Lokal selbst.
// Direkt vermitteln (29.10.2026): an der Vermittlung oder im Gespräch eine Stelle
// wählen – Vermittlungsschein (referral.ts); „Gleich hingehen“ öffnet das Lokal,
// dort beginnt die Schicht sofort.

import { useEffect, useMemo, useRef, useState } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { AGENCY_ROBOT_FACTS, AGENCY_ROBOT_NAME, AGENCY_ROBOT_INTRODUCTION, JOB_AGENCY_INTRODUCTION, JOB_AGENCY_LAYOUT, agencyRobot, JOB_CATEGORY_LABEL, distanceM, jobAgencyKnowledge, venueJobOffers, type AgencyBuilding, type JobOffer } from '@/lib/game/jobs/jobAgency'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { isRobotId } from '@/lib/grid/RobotVisual'
import { agencyReferralFacts, loadReferral, referralFromOffer, referralTitle, referralValid, saveReferral, spokenJobChoices, type JobReferral } from '@/lib/game/jobs/referral'

type Props = { entityId: string; buildingName: string; companion?: ColonyResident | null; onClose: () => void; onGoTo?: (referral: JobReferral) => void }

const distanceText = (m: number) => m < 950 ? `ca. ${Math.max(50, Math.round(m / 50) * 50)} m` : `ca. ${(Math.round(m / 100) / 10).toLocaleString('de-DE')} km`

export default function JobAgencyWalkableInterior({ entityId, buildingName, companion = null, onClose, onGoTo }: Props) {
  const [offers, setOffers] = useState<JobOffer[] | null>(null)
  const [referral, setReferral] = useState<JobReferral | null>(() => { const r = loadReferral(); return referralValid(r, Date.now()) ? r : null })
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
  // Der Vermittlungsroboter arbeitet immer – auch ohne Personal (Thomas, 29.10.2026).
  const robot = useMemo(() => agencyRobot(entityId) as unknown as ColonyResident, [entityId])
  // In der Nähe zuerst, dann nach Lohn.
  const shown = useMemo(() => !offers ? [] : here ? [...offers].sort((a, b) => distanceM(here, a) - distanceM(here, b) || b.wage - a.wage) : offers, [offers, here])

  const sameJob = (o: JobOffer) => referral?.buildingId === o.buildingId && referral.role === o.role
  // Wer vermittelt: im Gespräch die Figur, sonst die Vermittlung selbst.
  const refer = (o: JobOffer, ctx: InteriorContext) => {
    const by = ctx.selected ? (isRobotId(ctx.selected.id) ? AGENCY_ROBOT_NAME : ctx.selected.displayName ?? 'die Vermittlung') : 'die Vermittlung'
    const next = referralFromOffer(o, by, Date.now())
    saveReferral(next); setReferral(next)
    ctx.setStatus('Vermittelt: ' + referralTitle(next) + (here ? ', ' + distanceText(distanceM(here, o)) : '') + '. Der Schein gilt zwei Stunden.')
  }
  const giveBack = (ctx: InteriorContext) => { saveReferral(null); setReferral(null); ctx.setStatus('Vermittlung zurückgegeben.') }
  const jobRow = (o: JobOffer, ctx: InteriorContext, canRefer: boolean) => <div key={o.buildingId + o.role} className={'job' + (sameJob(o) ? ' chosen' : '')}>
    <span><b>{o.roleLabel}</b> · {o.placeName} <em>({o.placeKind})</em></span>
    <span>{o.gameHours} Std · {o.wage} Cr{o.paid ? '' : ' (Probe)'}{here ? ' · ' + distanceText(distanceM(here, o)) : ''}</span>
    {canRefer && !sameJob(o) && <button onClick={() => refer(o, ctx)}>Vermitteln lassen</button>}
  </div>

  const fitting: InteriorFitting = {
    kind: 'job_agency', layout, noun: layout.noun, locative: layout.locative, sectionLabel: 'VERMITTLUNG',
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'self-service',
    closedText: () => null,
    furnitureLabel: kind => kind === 'counter' ? 'VERMITTLUNG' : kind === 'board' ? 'STELLEN' : null,
    decor: { plants: [[400, 112], [700, 420]], rug: { x: 150, y: 125, w: 300, h: 120 } },
    visits: [],
    facts: (self, ctx) => withExtraFacts(
      baseInteriorFacts({ layout, buildingName: buildingName.split(' · ').pop() ?? buildingName, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: 'Du arbeitest hier in der Arbeitsvermittlung' }),
      isRobotId(self.id) ? [...agencyReferralFacts(referral, Date.now()), ...AGENCY_ROBOT_FACTS, ...knowledge] : self.roomRole === 'staff' ? [...agencyReferralFacts(referral, Date.now()), ...knowledge] : ['Du wartest hier selbst; die Stellen hängen an der Wand'],
    ),
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => isRobotId(self.id) ? AGENCY_ROBOT_INTRODUCTION : self.roomRole === 'staff' ? JOB_AGENCY_INTRODUCTION : undefined,
    extraResidents: [robot],
    things: [],
    idleText: 'An der Stellenwand hängen die freien Schichten im Ort; an der Vermittlung berät man dich.',
    greetsAtService: true,
    goToServiceLabel: () => 'Zur Vermittlung gehen',
    tableService: false,
    loaded: true,
    renderOffer: ctx => {
      // Vermitteln kann man an der Vermittlung – oder im Gespräch mit VERA oder dem Personal.
      const talking = Boolean(ctx.selected && (isRobotId(ctx.selected.id) || ctx.shown.some(e => e.resident.id === ctx.selected!.id && e.figure.roomRole === 'staff')))
      const canRefer = ctx.nearService || talking
      const spoken = talking ? spokenJobChoices(ctx.lastPlayerText, shown).filter(o => !sameJob(o)) : []
      const limit = canRefer ? 10 : 5
      const valid = referralValid(referral, Date.now()) ? referral : null
      return <div className="menu agency">
        {valid && <div className="referral">
          <small>VERMITTELT{valid.by !== 'die Vermittlung' ? ' VON ' + valid.by.toUpperCase() : ''}</small>
          <p><b>{referralTitle(valid)}</b><br />{valid.gameHours} Std · {valid.wage} Cr{valid.paid ? '' : ' (Probe)'} · der Schein gilt bis {new Date(valid.issuedAtMs + 2 * 3600_000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          {onGoTo && <button className="open-school" onClick={() => onGoTo(valid)}>Gleich hingehen und anfangen</button>}
          <button className="quiet" onClick={() => giveBack(ctx)}>Vermittlung zurückgeben</button>
        </div>}
        {spoken.length > 0 && <div className="spoken">
          <small>IM GESPRÄCH GENANNT</small>
          {spoken.map(o => <button key={o.buildingId + o.role} className="open-school" onClick={() => refer(o, ctx)}>Als {o.roleLabel} vermitteln: {o.placeName} ({o.placeKind}) – {o.wage} Cr{o.paid ? '' : ' (Probe)'}</button>)}
        </div>}
        <small>STELLENWAND · {JOB_CATEGORY_LABEL.venue.toUpperCase()}</small>
        {!offers && <p>Die Stellen werden geholt …</p>}
        {offers && shown.length === 0 && <p>Gerade ist in den Lokalen nichts frei.</p>}
        {shown.slice(0, limit).map(o => jobRow(o, ctx, canRefer))}
        {offers && shown.length > limit && <p className="hint">… und {shown.length - limit} weitere{canRefer ? '' : ' – die ganze Liste an der Vermittlung'}.</p>}
        {offers && shown.length > 0 && <p className="hint">{canRefer ? 'Wähl eine Stelle, die Agentur vermittelt dich direkt. Ein Einsatz dauert wenige Minuten und zählt als ganze Schicht.' : 'Vermittelt wird an der Vermittlung. Ein Einsatz dauert wenige Minuten und zählt als ganze Schicht.'}</p>}
        <small>BALD</small>
        <p className="hint">{JOB_CATEGORY_LABEL.business} · {JOB_CATEGORY_LABEL.ship} · {JOB_CATEGORY_LABEL.permanent} – folgt.</p>
      </div>
    },
  }

  return <>
    <WalkableInterior entityId={entityId} buildingName={buildingName} companion={companion} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx }} />
    <style jsx global>{`.walkable-interior .room.job_agency{--wall:#e6ebe8;--panel:#8fa6a0;--rail:#4f6a63;--floor:#cfd2c8;--plank:#bfc2b6;--top:#eef0e8}.walkable-interior .room.job_agency .counter{background:linear-gradient(#eef0e8 0 30%,#4f6a63 30%)}.walkable-interior .room.job_agency .counter .machine,.walkable-interior .room.job_agency .counter .vitrine{display:none}.walkable-interior .room.job_agency .board{background:#f4f1e6;border-color:#4f6a63}.walkable-interior .room.job_agency .board:after{background:repeating-linear-gradient(90deg,#c84d4d 0 18px,transparent 18px 26px,#3b8f6a 26px 44px,transparent 44px 52px);height:6px;top:7px;width:85%}.walkable-interior .menu.agency .job{display:flex;flex-direction:column;gap:1px;margin-top:6px;padding:6px 8px;border:1px solid #3b5f55;border-radius:5px;background:#0f2a26;font-size:11px}.walkable-interior .menu.agency .job em{color:#9fb5b0;font-style:normal}.walkable-interior .menu.agency .job span:nth-child(2){color:#f1d57a;font-size:10px}.walkable-interior .menu.agency .job.chosen{border-color:#4fd8c5;background:#123a34}.walkable-interior .menu.agency .job button{align-self:flex-start;margin-top:4px;padding:3px 8px;border:1px solid #4fd8c5;border-radius:4px;background:#163a35;color:#e8fbf7;font:700 10px system-ui;cursor:pointer}.walkable-interior .menu.agency .referral{margin:0 0 8px;padding:8px;border:1px solid #4fd8c5;border-radius:6px;background:#123a34}.walkable-interior .menu.agency .referral p{margin:4px 0 6px;font-size:11px;line-height:1.45}.walkable-interior .menu.agency .referral .quiet{display:block;margin-top:5px;border:0;background:none;color:#9fb5b0;font:600 10px system-ui;text-decoration:underline;cursor:pointer;padding:0}`}</style>
  </>
}
