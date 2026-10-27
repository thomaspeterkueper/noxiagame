'use client'

// app/earth/BankWalkableInterior.tsx
// Die Bank als Einrichtung des allgemeinen Innenraums (NOXIA-INTERIOR-0001).
// Eigen: Schalterhalle, Personal kennt die Konditionen und – nur am Schalter –
// den Stand des Kunden; das Angebot ist die Kurstafel und der Schalter
// (bestehendes BankOverlay) für Einzahlen, Abheben, Kredit, Tilgung.

import { useEffect, useMemo, useRef, useState } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { BANK_INTRODUCTION, BANK_LAYOUT, bankKnowledge, type BankPublicFacts } from '@/lib/game/bank/bankInterior'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ColonyResident } from '@/lib/store/colonyStateStore'

type Props = { entityId: string; buildingName: string; locationSlug: string; locationName: string; companion?: ColonyResident | null; onClose: () => void; onOpenDesk: () => void }

export default function BankWalkableInterior({ entityId, buildingName, locationSlug, locationName, companion = null, onClose, onOpenDesk }: Props) {
  const [status, setStatus] = useState<any>(null)
  const ctxRef = useRef<InteriorContext | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const { token } = await getSessionInfo()
        if (!token) return
        const response = await fetch('/api/game/bank?action=status&location=' + encodeURIComponent(locationSlug), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
        const data = await response.json()
        if (live && response.ok) setStatus(data)
      } catch { /* ohne Zahlen verweist das Personal auf die Tafel */ }
    })()
    return () => { live = false }
  }, [locationSlug])

  const publicFacts = useMemo<BankPublicFacts | null>(() => status ? { locationName, depositRate: Number(status.depositRate ?? 0), loanRate: Number(status.loanRate ?? 0) } : null, [status, locationName])
  const layout = BANK_LAYOUT

  const fitting: InteriorFitting = {
    kind: 'bank', layout, noun: layout.noun, locative: layout.locative, sectionLabel: 'BANK',
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'self-service',
    closedText: () => null,
    furnitureLabel: kind => kind === 'counter' ? 'SCHALTER' : kind === 'board' ? 'KURSE' : null,
    decor: { plants: [[130, 112], [660, 420]], rug: { x: 150, y: 125, w: 300, h: 130 } },
    visits: [],
    facts: (self, ctx) => withExtraFacts(
      baseInteriorFacts({ layout, buildingName, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: 'Du arbeitest hier in der Bank' }),
      // Den Stand des Kunden kennt das Personal nur, wenn er am Schalter steht.
      self.roomRole === 'staff'
        ? bankKnowledge(publicFacts ? { ...publicFacts, customer: ctx.nearService && status ? { deposit: Number(status.deposit ?? 0), loan: Number(status.loan ?? 0), creditLimit: Number(status.creditLimit ?? 0), availableLoan: Number(status.availableLoan ?? 0), hasModule: Boolean(status.hasModule) } : null } : null)
        : ['Du wartest hier selbst; über Konten anderer weißt du nichts'],
    ),
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => self.roomRole === 'staff' ? BANK_INTRODUCTION : undefined,
    things: [],
    idleText: 'Die Kurstafel zeigt die Zinsen; am Schalter siehst du dein Konto.',
    greetsAtService: true,
    goToServiceLabel: () => 'Zum Schalter gehen',
    tableService: false,
    loaded: true,
    renderOffer: ctx => {
      if (!ctx.nearService) return <p className="hint">Konto, Einlagen und Kredit gibt es am Schalter.</p>
      return <div className="menu">
        <small>KURSTAFEL</small>
        {status ? <dl className="notice">
          <dt>Einlagen</dt><dd>{Math.round(Number(status.depositRate) * 10000) / 100} % je Tick</dd>
          <dt>Kredit</dt><dd>{Math.round(Number(status.loanRate) * 10000) / 100} % je Tick</dd>
          <dt>Dein Guthaben hier</dt><dd>{Number(status.deposit ?? 0)} Cr</dd>
          <dt>Dein Kredit</dt><dd>{Number(status.loan ?? 0)} Cr</dd>
          <dt>Kreditrahmen</dt><dd>{Number(status.creditLimit ?? 0)} Cr</dd>
        </dl> : <p>Die Kurstafel wird geholt …</p>}
        <small>SCHALTER</small>
        <button className="open-school" onClick={onOpenDesk}>Schalter öffnen – einzahlen, abheben, Kredit</button>
      </div>
    },
  }

  return <WalkableInterior entityId={entityId} buildingName={buildingName} companion={companion} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx }} />
}
