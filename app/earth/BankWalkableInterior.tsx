'use client'

// app/earth/BankWalkableInterior.tsx
// Die Bank als Einrichtung des allgemeinen Innenraums (NOXIA-INTERIOR-0001).
// Eigen: Schalterhalle, Personal kennt die Konditionen und – nur am Schalter –
// den Stand des Kunden; das Angebot ist die Kurstafel und der Schalter
// (bestehendes BankOverlay) für Einzahlen, Abheben, Kredit, Tilgung.
// Beratung (27.10.2026): am Beratungstisch die Beratungsmappe aus dem echten
// Konto und ein Gespräch mit der Kundenberatung, die die Mappe kennt; fehlendes
// Wissen (Lernschwellen) öffnet das Lernmodul gleich hier.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { ADVICE_STAFF_SPOT_ID, isAtAdviceTable, BANK_ADVISOR_INTRODUCTION, BANK_INTRODUCTION, BANK_LAYOUT, bankAdvice, bankAdvisorFacts, bankKnowledge, customerStatusFrom, type BankPublicFacts } from '@/lib/game/bank/bankInterior'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import { learningGateFacts, statusesFromViews } from '@/lib/game/interiors/learningGates'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ColonyResident } from '@/lib/store/colonyStateStore'

type Props = { entityId: string; buildingName: string; locationSlug: string; locationName: string; companion?: ColonyResident | null; onClose: () => void; onOpenDesk: () => void; learnRequest?: { gateId: string; at: number } | null }

const atAdviceTable = (ctx: Pick<InteriorContext, 'seat' | 'pos'>) => isAtAdviceTable(ctx.seat?.id ?? null, ctx.pos)

export default function BankWalkableInterior({ entityId, buildingName, locationSlug, locationName, companion = null, onClose, onOpenDesk, learnRequest = null }: Props) {
  const [status, setStatus] = useState<any>(null)
  const ctxRef = useRef<InteriorContext | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const { token } = await getSessionInfo()
      if (!token) return
      const response = await fetch('/api/game/bank?action=status&location=' + encodeURIComponent(locationSlug), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      const data = await response.json()
      if (response.ok) setStatus(data)
    } catch { /* ohne Zahlen verweist das Personal auf die Tafel */ }
  }, [locationSlug])
  useEffect(() => { void loadStatus() }, [loadStatus])

  const publicFacts = useMemo<BankPublicFacts | null>(() => status ? { locationName, depositRate: Number(status.depositRate ?? 0), loanRate: Number(status.loanRate ?? 0) } : null, [status, locationName])
  const customer = useMemo(() => customerStatusFrom(status), [status])
  const layout = BANK_LAYOUT

  // Lernschwellen mit dem Stand des Spielers – für das Wissen des Personals.
  const gateStatus = (ctx: InteriorContext) => statusesFromViews('bank', ctx.gates)
  const isAdvisor = (selfId: string, ctx: InteriorContext) => ctx.figures.find(f => f.id === selfId)?.spot.id === ADVICE_STAFF_SPOT_ID
  const advisorOf = (ctx: InteriorContext) => {
    const staff = ctx.shown.filter(item => item.figure.roomRole === 'staff')
    return staff.find(item => item.figure.spot.id === ADVICE_STAFF_SPOT_ID) ?? null
  }

  const fitting: InteriorFitting = {
    kind: 'bank', layout, noun: layout.noun, locative: layout.locative, sectionLabel: 'BANK',
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'self-service',
    closedText: () => null,
    furnitureLabel: kind => kind === 'counter' ? 'SCHALTER' : kind === 'board' ? 'KURSE' : kind === 'table' ? 'BERATUNG' : null,
    decor: { plants: [[130, 112], [660, 420]], rug: { x: 150, y: 125, w: 300, h: 130 } },
    visits: [],
    facts: (self, ctx) => {
      const base = baseInteriorFacts({ layout, buildingName, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: 'Du arbeitest hier in der Bank' })
      if (self.roomRole !== 'staff') return withExtraFacts(base, ['Du wartest hier selbst; über Konten anderer weißt du nichts'])
      const advising = atAdviceTable(ctx) && isAdvisor(self.id, ctx)
      // Den Stand des Kunden kennt die Beratung am Beratungstisch, der Schalter nur am Schalter.
      const knowsCustomer = advising || ctx.nearService
      const own = advising
        ? bankAdvisorFacts(customer)
        : bankKnowledge(publicFacts ? { ...publicFacts, customer: ctx.nearService && customer ? { deposit: customer.deposit, loan: customer.loan, creditLimit: customer.creditLimit, availableLoan: customer.availableLoan, hasModule: customer.hasModule } : null } : null)
      return withExtraFacts(base, [...own, ...learningGateFacts(gateStatus(ctx), knowsCustomer)])
    },
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => {
      const ctx = ctxRef.current
      if (self.roomRole !== 'staff') return undefined
      return ctx && atAdviceTable(ctx) && isAdvisor(self.id, ctx) ? BANK_ADVISOR_INTRODUCTION : BANK_INTRODUCTION
    },
    things: [],
    idleText: 'Die Kurstafel zeigt die Zinsen; am Schalter siehst du dein Konto, am Beratungstisch gibt es Beratung.',
    greetsAtService: true,
    goToServiceLabel: () => 'Zum Schalter gehen',
    tableService: false,
    loaded: true,
    onLearned: () => { void loadStatus() },
    renderOffer: ctx => {
      if (atAdviceTable(ctx)) {
        const advisor = advisorOf(ctx)
        const creditGate = ctx.gates.find(g => g.id === 'bank-credit')
        return <div className="menu">
          <small>BERATUNG</small>
          {customer ? <ul className="advice">{bankAdvice(customer).map(line => <li key={line}>{line}</li>)}</ul> : <p>Die Beratungsmappe wird geholt …</p>}
          {advisor
            ? ctx.selected?.id === advisor.resident.id ? null : <button className="open-school" onClick={() => ctx.talkTo(advisor.resident)}>Beratungsgespräch beginnen</button>
            : <p className="hint">Gerade sitzt niemand von der Beratung am Tisch; die Mappe kannst du selbst lesen.</p>}
          {creditGate && !creditGate.open && creditGate.moduleId && <button className="open-school" onClick={() => ctx.openLearning('bank-credit')}>Kreditfreigabe lernen: „{creditGate.moduleTitle}“</button>}
        </div>
      }
      if (!ctx.nearService) return <p className="hint">Konto, Einlagen und Kredit gibt es am Schalter, Beratung am Beratungstisch.</p>
      return <div className="menu">
        <small>KURSTAFEL</small>
        {status ? <dl className="notice">
          <dt>Einlagen</dt><dd>{Math.round(Number(status.depositRate) * 10000) / 100} % je Tag</dd>
          <dt>Kredit</dt><dd>{Math.round(Number(status.loanRate) * 10000) / 100} % je Tag</dd>
          <dt>Dein Guthaben hier</dt><dd>{Number(status.deposit ?? 0)} Cr</dd>
          <dt>Dein Kredit</dt><dd>{Number(status.loan ?? 0)} Cr</dd>
          <dt>Kreditrahmen</dt><dd>{Number(status.creditLimit ?? 0)} Cr</dd>
        </dl> : <p>Die Kurstafel wird geholt …</p>}
        <small>SCHALTER</small>
        <button className="open-school" onClick={onOpenDesk}>Schalter öffnen – einzahlen, abheben, Kredit</button>
      </div>
    },
  }

  return <>
    <WalkableInterior entityId={entityId} buildingName={buildingName} companion={companion} onClose={onClose} fitting={fitting} learnRequest={learnRequest} onContext={ctx => { ctxRef.current = ctx }} />
    <style jsx global>{`.walkable-interior .menu .advice{margin:6px 0 8px;padding-left:16px;font-size:11px;line-height:1.5;color:#cbd6d2}.walkable-interior .menu .advice li{margin:2px 0}`}</style>
  </>
}
