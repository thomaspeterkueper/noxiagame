'use client'

// app/earth/AdminWalkableInterior.tsx
// Die Verwaltung als dritte Einrichtung des allgemeinen Innenraums
// (NOXIA-INTERIOR-0001). Eigen: Foyer mit Schalter, Personal, das die
// öffentlichen Zahlen des Ortes kennt (Einwohner, Gouverneur, Steuersätze),
// und als Angebot die Rathaus-Tafel (AdminOverlay) für Anmeldung, Steuern, Kasse.

import { useEffect, useMemo, useRef, useState } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { ADMIN_INTRODUCTION, ADMIN_LAYOUT, adminKnowledge, type AdminPublicFacts } from '@/lib/game/administration/adminInterior'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ColonyResident } from '@/lib/store/colonyStateStore'

type Props = {
  entityId: string
  buildingName: string
  locationSlug: string
  companion?: ColonyResident | null
  onClose: () => void
  /** Öffnet die Rathaus-Tafel (bestehendes AdminOverlay). */
  onOpenDesk: () => void
}

export default function AdminWalkableInterior({ entityId, buildingName, locationSlug, companion = null, onClose, onOpenDesk }: Props) {
  const [facts, setFacts] = useState<AdminPublicFacts | null>(null)
  const ctxRef = useRef<InteriorContext | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [publicRes, profile] = await Promise.all([
          fetch('/api/game/admin?location=' + encodeURIComponent(locationSlug), { cache: 'no-store' }).then(r => r.json()).catch(() => null),
          getSessionInfo().then(({ token }) => token ? fetch('/api/game/profile', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' }).then(r => r.json()).catch(() => null) : null),
        ])
        if (!live || !publicRes?.location) return
        const home = String(profile?.homeLocation ?? profile?.home_location ?? '') || null
        setFacts({
          locationName: String(publicRes.location.name ?? locationSlug),
          population: Number(publicRes.location.population ?? 0),
          populationMax: Number(publicRes.location.populationMax ?? 0),
          governorName: publicRes.location.governorName ?? null,
          taxProperty: Number(publicRes.settings?.taxProperty ?? 0),
          taxTransaction: Number(publicRes.settings?.taxTransaction ?? 0),
          taxLanding: Number(publicRes.settings?.taxLanding ?? 0),
          playerHome: home,
          playerRegisteredHere: home ? home === locationSlug : undefined,
        })
      } catch { /* ohne Zahlen verweist das Personal auf den Schalter */ }
    })()
    return () => { live = false }
  }, [locationSlug])

  const knowledge = useMemo(() => adminKnowledge(facts), [facts])
  const layout = ADMIN_LAYOUT

  const fitting: InteriorFitting = {
    kind: 'administration', layout, noun: layout.noun, locative: layout.locative, sectionLabel: 'VERWALTUNG',
    // Die Verwaltung ist staatlich und offen; ohne Personal bleibt der Schalter als Selbstbedienung (Tafel) nutzbar.
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'self-service',
    closedText: () => null,
    furnitureLabel: kind => kind === 'counter' ? 'SCHALTER' : kind === 'board' ? 'AUSHANG' : null,
    decor: { plants: [[130, 112], [700, 420]], rug: { x: 150, y: 125, w: 300, h: 120 } },
    visits: [],
    facts: (self, ctx) => withExtraFacts(
      baseInteriorFacts({ layout, buildingName, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: 'Du arbeitest hier in der Verwaltung des Ortes' }),
      self.roomRole === 'staff' ? knowledge : ['Du wartest hier selbst; Auskunft gibt der Schalter'],
    ),
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => self.roomRole === 'staff' ? ADMIN_INTRODUCTION : undefined,
    things: [],
    idleText: 'Am Schalter meldest du deinen Heimatort an; auf dem Aushang stehen Einwohner und Steuern.',
    greetsAtService: true,
    goToServiceLabel: () => 'Zum Schalter gehen',
    tableService: false,
    loaded: true,
    renderOffer: ctx => {
      if (!ctx.nearService) return <p className="hint">Anmeldung, Steuern und Kasse gibt es am Schalter.</p>
      return <div className="menu">
        <small>AUSHANG</small>
        {facts ? <dl className="notice">
          <dt>Einwohner</dt><dd>{facts.population} / {facts.populationMax}</dd>
          <dt>Gouverneur</dt><dd>{facts.governorName ?? '–'}</dd>
          <dt>Grundsteuer</dt><dd>{facts.taxProperty} Cr</dd>
          <dt>Konsumsteuer</dt><dd>{Math.round(facts.taxTransaction * 1000) / 10} %</dd>
          <dt>Landegebühr</dt><dd>{facts.taxLanding} Cr</dd>
          {facts.playerHome && <><dt>Dein Heimatort</dt><dd>{facts.playerRegisteredHere ? 'hier' : facts.playerHome}</dd></>}
        </dl> : <p>Der Aushang wird geholt …</p>}
        <small>SCHALTER</small>
        <button className="open-school" onClick={onOpenDesk}>{facts?.playerRegisteredHere ? 'Schalter öffnen' : 'Heimatort anmelden · Schalter öffnen'}</button>
      </div>
    },
  }

  return <WalkableInterior entityId={entityId} buildingName={buildingName} companion={companion} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx }} />
}
