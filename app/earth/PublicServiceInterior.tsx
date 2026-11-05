'use client'

// app/earth/PublicServiceInterior.tsx
// Polizeiwache, Feuerwache, Arztpraxis, Krankenhaus als begehbare Räume des
// allgemeinen Innenraum-Motors (Thomas, 05.11.2026: „ja, mache das“).
// Dienstpersonal steht immer da (Wache, Feuerwehr, Krankenhaus rund um die Uhr,
// Praxis zu Sprechzeiten). Wer laut Simulation gerade dort ist, ist auch drinnen.
// Angebote: Anzeige, Fundsache, Verlust, Mitmachen bei der Freiwilligen Feuerwehr,
// Termin, Besuch – gespeichert über /api/game/services (service_cases); das Personal
// weiß davon. Echte Notfälle: Das Personal verweist auf 110, 112 und 116 117.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import WalkableInterior, { type InteriorContext, type InteriorFitting } from '@/app/interiors/WalkableInterior'
import { SERVICE_LABEL, SERVICE_LAYOUTS, SERVICE_OFFERS, SERVICE_STAFF, CASE_LABEL, serviceIntroduction, serviceOpen, serviceStaffFacts, type ServiceCaseKind, type ServiceKind, type ServiceOffer } from '@/lib/game/services/publicServices'
import { baseInteriorFacts, withExtraFacts } from '@/lib/game/interiors/baseFacts'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ColonyResident } from '@/lib/store/colonyStateStore'

type Props = {
  kind: ServiceKind
  /** OSM-Kennung oder eigene Kennung des Hauses – Raum, Anwesenheit, Fälle. */
  placeRef: string
  name: string
  /** Bewohner, die laut Simulation gerade hier sind (Besucher, Patienten). */
  present?: readonly ColonyResident[]
  companion?: ColonyResident | null
  companionHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  onClose: () => void
}

type Case = { kind: ServiceCaseKind; text: string; at: string }

/** Dienstpersonal als Figur: feste Kennung je Haus und Aufgabe, die Gesprächs-API legt die Person an. */
function staffResidents(kind: ServiceKind, placeRef: string, entityId: string): ColonyResident[] {
  return SERVICE_STAFF[kind].map((s, i) => ({
    id: `landmark-staff:${placeRef}:${s.key}`,
    displayName: s.role,
    identityState: 'unknown',
    observableDescription: s.description,
    appearance: { genderPresentation: /frau|ärztin|pflegerin|polizistin|wartin|angestellte/i.test(s.role + s.description) ? 'feminine' : 'masculine', bodyFrame: i % 2 ? 'broad' : 'average', skinToneCode: `skin_${1 + ((placeRef.length + i * 3) % 6)}`, hairStyleCode: ['short', 'bun', 'curly', 'long'][(placeRef.length + i) % 4], hairColorCode: ['dark', 'brown', 'light', 'grey'][(placeRef.length + i * 2) % 4], facialHairCode: 'none', visibleAgeBand: 'adult', clothingProfile: { work: s.roleCode } },
    birthYear: null,
    activityState: 'working',
    lastAction: null,
    assignments: [{ type: 'work', roleCode: s.roleCode, tileEntityId: entityId }],
    needs: [],
    skills: [],
  }))
}

export default function PublicServiceInterior({ kind, placeRef, name, present = [], companion = null, companionHistory = [], onClose }: Props) {
  const layout = SERVICE_LAYOUTS[kind]
  const entityId = 'svc:' + placeRef
  const ctxRef = useRef<InteriorContext | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [incidents, setIncidents] = useState<string[]>([])
  const [form, setForm] = useState<ServiceOffer | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const open = serviceOpen(kind, new Date())

  const load = useCallback(async () => {
    try {
      const { token } = await getSessionInfo()
      if (!token) return
      const r = await fetch(`/api/game/services?place=${encodeURIComponent(placeRef)}&service=${kind}`, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setCases(Array.isArray(d.cases) ? d.cases : []); setIncidents(Array.isArray(d.incidents) ? d.incidents : []) }
    } catch { /* ohne Verbindung weiß das Personal nur, was es sieht */ }
  }, [placeRef, kind])
  useEffect(() => { void load() }, [load])

  const staff = useMemo(() => open ? staffResidents(kind, placeRef, entityId) : [], [open, kind, placeRef, entityId])
  const extra = useMemo(() => [...staff, ...present.filter(p => !staff.some(s => s.id === p.id))], [staff, present])
  const staffInfo = (id: string) => SERVICE_STAFF[kind].find(s => id === `landmark-staff:${placeRef}:${s.key}`) ?? null

  async function submit(offer: ServiceOffer, ctx: InteriorContext) {
    if (!offer.caseKind) return
    setBusy(true)
    try {
      const { token } = await getSessionInfo()
      if (!token) return
      const r = await fetch('/api/game/services', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ place: placeRef, service: kind, kind: offer.caseKind, text }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { ctx.setStatus(String(d.error ?? 'Nicht aufgenommen.')); return }
      setCases(c => [d.case, ...c].slice(0, 5))
      setForm(null); setText('')
      ctx.setStatus({ anzeige: 'Die Anzeige ist aufgenommen.', fundsache: 'Die Fundsache ist abgegeben.', verloren: 'Die Verlustmeldung ist aufgenommen.', ff_mitmachen: 'Die Wehr hat dich vorgemerkt – Übungsabend ist einmal die Woche.', termin: 'Du bist angemeldet; nimm im Wartezimmer Platz.', besuch: 'Die Information schaut nach, wen du besuchen möchtest.' }[offer.caseKind])
      if (offer.caseKind === 'termin') { const seat = layout.spots.find(s => s.id === 'wait-1'); if (seat) ctx.walkTo(seat) }
    } catch { ctx.setStatus('Keine Verbindung.') } finally { setBusy(false) }
  }

  const fitting: InteriorFitting = {
    kind, layout, noun: layout.noun, locative: layout.locative, sectionLabel: SERVICE_LABEL[kind],
    service: figures => figures.some(f => f.roomRole === 'staff') ? 'staffed' : 'closed',
    closedText: () => kind === 'doctors' ? { headline: 'GESCHLOSSEN', detail: 'Sprechstunde werktags 8–12 und 14–18 Uhr. Im Notfall außerhalb der Sprechzeiten: ärztlicher Bereitschaftsdienst – im Spiel wie im echten Leben 116 117, bei Lebensgefahr 112.' } : null,
    furnitureLabel: k => k === 'counter' ? (kind === 'police' ? 'WACHE' : kind === 'doctors' ? 'EMPFANG' : 'INFORMATION') : k === 'board' ? (kind === 'police' ? 'HINWEISE' : kind === 'fire_station' ? 'ÜBUNGSPLAN' : 'STATIONEN') : k === 'vehicle' ? 'LÖSCHFAHRZEUG' : k === 'bed' ? null : null,
    decor: { plants: [[130, 112]], rug: { x: 140, y: 270, w: 140, h: 70 } },
    visits: [],
    extraResidents: extra,
    facts: (self, ctx) => {
      const base = baseInteriorFacts({ layout, buildingName: name, self, figures: ctx.figures, playerPos: ctx.pos, playerSeat: ctx.seat, staffRoleText: `Du arbeitest hier ${layout.locative}` })
      const info = staffInfo(self.id)
      if (self.roomRole !== 'staff' || !info) return withExtraFacts(base, [kind === 'hospital' || kind === 'doctors' ? 'Du wartest hier selbst; über andere Patienten weißt du nichts' : 'Du bist selbst nur zu Besuch hier'])
      return withExtraFacts(base, serviceStaffFacts(kind, info, { incidents, ownCases: cases.map(c => ({ kind: c.kind, text: c.text })) }))
    },
    placeKnowledge: [],
    hearsay: () => [],
    introduction: self => self.roomRole === 'staff' && staffInfo(self.id) ? serviceIntroduction(kind) : undefined,
    things: [],
    idleText: { police: 'Am Wachtisch nimmt die Polizei Anzeigen auf; Fundsachen gibt es auch hier.', fire_station: 'Im Schulungsraum hängt der Übungsplan; in der Halle steht das Löschfahrzeug.', doctors: 'Am Empfang meldest du dich an, dann wartest du im Wartezimmer.', hospital: 'An der Information erfährst du, wo wer liegt, und die Besuchszeiten.' }[kind],
    greetsAtService: true,
    goToServiceLabel: () => ({ police: 'Zum Wachtisch gehen', fire_station: 'In den Schulungsraum', doctors: 'Zum Empfang gehen', hospital: 'Zur Information gehen' }[kind]),
    tableService: false,
    loaded: true,
    renderOffer: ctx => {
      const offers = SERVICE_OFFERS[kind]
      return <div className="menu">
        <small>{SERVICE_LABEL[kind]}</small>
        {!ctx.nearService && <p className="hint">{fitting.idleText}</p>}
        {ctx.nearService && !form && offers.map(o => <button key={o.id} className="open-school" disabled={busy} onClick={() => { if (o.caseKind === 'ff_mitmachen' || o.caseKind === 'termin') { setText(''); void submit(o, ctx) } else { setForm(o); setText('') } }}>{o.label}</button>)}
        {ctx.nearService && form && <div className="case-form">
          <p className="hint">{form.hint}</p>
          <textarea value={text} maxLength={300} rows={3} onChange={e => setText(e.target.value)} placeholder="Kurz beschreiben …" />
          <div className="moves"><button disabled={busy || text.trim().length < 3} onClick={() => void submit(form, ctx)}>{busy ? '…' : 'Abgeben'}</button><button disabled={busy} onClick={() => setForm(null)}>Abbrechen</button></div>
        </div>}
        {cases.length > 0 && <>
          <small>DEINE ANGABEN HIER</small>
          {cases.slice(0, 3).map((c, i) => <p key={i} className="hint">{CASE_LABEL[c.kind]}{c.text ? ': „' + c.text.slice(0, 80) + '“' : ''}</p>)}
        </>}
        <p className="hint real">Im echten Notfall: 110 Polizei · 112 Feuerwehr und Rettungsdienst · 116 117 ärztlicher Bereitschaftsdienst.</p>
      </div>
    },
  }

  return <>
    <WalkableInterior entityId={entityId} buildingName={name} companion={companion} companionHistory={companionHistory} onClose={onClose} fitting={fitting} onContext={ctx => { ctxRef.current = ctx }} />
    <style jsx global>{`
      .walkable-interior .case-form textarea{width:100%;box-sizing:border-box;margin-top:6px;background:#061012;color:#eef;border:1px solid #40595a;border-radius:4px;padding:6px;font:12px inherit;resize:vertical}
      .walkable-interior .hint.real{margin-top:10px;font-size:10px;color:#9fb5b0}
      .walkable-interior .f.vehicle{background:linear-gradient(180deg,#d8352a 0 62%,#9a2017 62%);border-radius:10px 22px 8px 8px;box-shadow:inset 0 -14px 0 #2a2a2a55,0 6px 10px #0006}
      .walkable-interior .f.vehicle:before{content:'';position:absolute;left:12px;top:10px;width:46px;height:30px;border-radius:4px;background:#bfe4f2;opacity:.85}
      .walkable-interior .f.vehicle:after{content:'';position:absolute;left:18px;right:18px;bottom:-8px;height:16px;background:radial-gradient(circle at 12% 50%,#1b1b1b 0 9px,transparent 10px),radial-gradient(circle at 88% 50%,#1b1b1b 0 9px,transparent 10px)}
      .walkable-interior .f.bed{background:#e9eef0;border-radius:6px;box-shadow:inset 18px 0 0 #fff,inset 0 -6px 0 #9fb5c4,0 3px 5px #0005}
      .walkable-interior .f.locker{background:repeating-linear-gradient(90deg,#5f6f7f 0 28px,#4a5866 28px 30px);border-radius:3px}
    `}</style>
  </>
}
