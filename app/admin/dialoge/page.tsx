'use client'

// app/admin/dialoge/page.tsx
// NOXIA-PRIVACY-0004 (05.11.2026): Gesprächsauswertung ohne Mitlesen.
// Kennzahlen ab fünf Spielern je Zelle, Wortlaut nur von Admin-Testkonten und
// aus Meldungen, die Spieler selbst geschickt haben.

import Link from 'next/link'
import {useCallback,useEffect,useState} from 'react'
import {getToken} from '@/lib/supabase/auth'
import type {ConversationInsights,InsightGroup,ExcerptLine} from '@/lib/game/conversationInsights'

type TestTurn = {id:number;created_at:string;npc_name:string|null;npc_role:string|null;location_name:string|null;player_text:string|null;npc_reply:string|null;topic:string|null;outcome:string|null;world_action:string|null;wish_kind:string|null;turn_index:number|null}
type Report = {id:number;origin:'player'|'filter';signals:string[];created_at:string;expires_at:string;source:'npc'|'room';reason:string;comment:string|null;npc_name:string|null;room_key:string|null;location_name:string|null;excerpt:ExcerptLine[];status:'open'|'done'}
type Response = {
 days:number;minGroup:number;retention:{rawTextDays:number;reportDays:number}
 insights:ConversationInsights;testInsights:{turns:number}
 traces:{stage:string;status:string;count:number}[]
 testTurns:TestTurn[];reports:Report[]
 safety:{signal:string;npc:number;room:number}[]
 learning:{claims:number;npcs:number;sources:number|null}
 aiReviews:{total:number;byVerdict:{key:string;count:number}[];byCategory:{key:string;count:number}[];byLanguage:{key:string;count:number}[]}
}

const REASON:Record<string,string>={error:'Fehler',harassment:'Belästigung',feedback:'Rückmeldung',other:'Sonstiges',safety:'Schutzfilter'}
const SIGNAL:Record<string,string>={suspect:'Verdacht (gesichert)',watch:'Beobachtung',contact:'Kontaktdaten',offline:'„in echt“',meetup:'Treffen/Zeit',real_goods:'reale Ware',money:'Geldweg',violence:'Gewalt',school:'Schule',minor_cue:'Hinweis auf Minderjährige',secrecy:'Geheimhaltung',sexual:'sexueller Bezug',abuse_material:'Missbrauchsdarstellung',obfuscated_contact:'getarnte Kontaktdaten',real_currency:'reale Währung',quantity:'Menge mit Einheit',trade_shape:'Handelsmuster',unscreened_language:'nicht abgedeckte Sprache'}
const VERDICT:Record<string,string>={game:'Spiel',unclear:'unklar',real_world:'reale Welt (gesichert ab 60 %)',error:'Fehler'}
const pct=(n:number)=>Math.round(n*100)+' %'

function Table({title,group,label}:{title:string;group:InsightGroup;label:string}){
 return <section className="rounded-xl border bg-white p-4">
  <h3 className="font-semibold">{title}</h3>
  {group.cells.length===0
   ?<p className="mt-2 text-sm text-[#5d6b70]">Noch zu wenig Daten.</p>
   :<table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-[#5d6b70]"><th>{label}</th><th className="text-right">Wortm.</th><th className="text-right">Spieler</th><th className="text-right">beendet</th><th className="text-right">Fehler</th></tr></thead>
    <tbody>{group.cells.slice(0,15).map(c=><tr key={c.key} className="border-t"><td className="py-1 pr-2 break-words">{c.key}</td><td className="text-right">{c.turns}</td><td className="text-right">{c.players}</td><td className="text-right">{pct(c.endedShare)}</td><td className="text-right">{pct(c.errorShare)}</td></tr>)}</tbody></table>}
  {group.hidden>0&&<p className="mt-2 text-xs text-[#5d6b70]">{group.hidden} {group.hidden===1?'Eintrag':'Einträge'} mit weniger Spielern ausgeblendet.</p>}
 </section>
}


function ReportCard({r,onStatus}:{r:Report;onStatus:(id:number,status:'open'|'done')=>void}){
 return <article className={'rounded-xl border bg-white p-5'+(r.status==='done'?' opacity-60':'')}>
  <header className="flex flex-wrap items-start justify-between gap-2">
   <div><h3 className="font-semibold">{REASON[r.reason]??r.reason} · {r.source==='npc'?(r.npc_name??'NPC'):'Raum-Chat'}</h3>
    <p className="text-xs text-[#5d6b70]">{new Date(r.created_at).toLocaleString('de-DE')} · {r.location_name??r.room_key??'Ort unbekannt'} · löscht sich am {new Date(r.expires_at).toLocaleDateString('de-DE')}</p></div>
   <button onClick={()=>onStatus(r.id,r.status==='done'?'open':'done')} className="rounded border px-3 py-1 text-xs">{r.status==='done'?'Wieder öffnen':'Erledigt'}</button>
  </header>
  {r.signals?.length>0&&<p className="mt-2 text-xs"><strong>Merkmale:</strong> {r.signals.map(x=>SIGNAL[x]??x).join(' · ')}</p>}
  {r.comment&&<p className="mt-2 rounded bg-[#fff8e6] p-2 text-sm"><strong className="text-xs">{r.origin==='filter'?'Grund:':'Kommentar:'}</strong> {r.comment}</p>}
  <div className="mt-3 space-y-1">{r.excerpt.map((l,k)=><p key={k} className="text-sm"><strong>{l.speaker}:</strong> <span className="whitespace-pre-wrap break-words">{l.text}</span></p>)}</div>
 </article>
}

export default function ConversationInsightsPage(){
 const [data,setData]=useState<Response|null>(null)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 const [days,setDays]=useState(30)
 const call=useCallback(async(init?:RequestInit)=>{
   const token=await getToken()
   if(!token)throw Error('Bitte mit berechtigtem Admin-Spielerkonto anmelden.')
   const r=await fetch('/api/admin/conversation-insights'+(init?'':'?days='+days),{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store'})
   const j=await r.json().catch(()=>({}))
   if(!r.ok)throw Error(j.error??'Daten nicht erreichbar')
   return j
 },[days])
 const load=useCallback(async()=>{
   setLoading(true);setError('')
   try{setData(await call() as Response)}catch(e){setError(String(e))}finally{setLoading(false)}
 },[call])
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Laden beim Öffnen und bei Zeitraumwechsel
 useEffect(()=>{void load()},[load])
 async function setStatus(id:number,status:'open'|'done'){
   try{await call({method:'POST',body:JSON.stringify({reportId:id,status})});await load()}catch(e){setError(String(e))}
 }
 const i=data?.insights
 return <main className="min-h-screen bg-[#f6f4ee] p-6 text-[#1d2a30]">
  <div className="mx-auto max-w-5xl">
   <Link href="/admin" className="text-sm font-semibold text-[#1f4f54]">← Adminbereich</Link>
   <h1 className="mt-4 text-3xl font-bold">Gesprächsauswertung</h1>
   <p className="my-3 text-sm text-[#5d6b70]">
     Gespräche von Spielern werden nur automatisch ausgewertet – kein Mensch liest mit. Hier erscheinen Kennzahlen ab {data?.minGroup??5} verschiedenen Spielern je Eintrag.
     Wortlaut gibt es nur von Admin-Testkonten und aus Meldungen, die Spieler selbst geschickt haben. Der Wortlaut aller übrigen Gespräche wird nach {data?.retention.rawTextDays??14} Tagen gelöscht.
   </p>
   <form onSubmit={e=>{e.preventDefault();void load()}} className="mb-5 flex flex-wrap items-end gap-3">
    <label className="text-sm">Zeitraum
     <select className="mt-1 block rounded border p-2" value={days} onChange={e=>setDays(Number(e.target.value))}>
      {[7,14,30,90,180].map(d=><option key={d} value={d}>letzte {d} Tage</option>)}
     </select>
    </label>
    <button type="submit" disabled={loading} className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50">{loading?'Lädt …':'Aktualisieren'}</button>
   </form>
   {error&&<p role="alert" className="rounded border border-red-300 bg-red-50 p-3">{error}</p>}
   {data&&i&&<div className="space-y-8">
    <section>
     <h2 className="text-xl font-semibold">Spielergespräche</h2>
     <p className="mt-1 text-sm">{i.totals.turns} Wortmeldungen · {i.totals.conversationsStarted} Gesprächseröffnungen · {i.totals.players===null?`weniger als ${data.minGroup} Spieler`:`${i.totals.players} Spieler`}</p>
     <div className="mt-3 grid gap-4 md:grid-cols-2">
      <Table title="Themen" group={i.byTopic} label="Thema"/>
      <Table title="Figuren" group={i.byNpc} label="NPC"/>
      <Table title="Orte" group={i.byLocation} label="Ort"/>
      <Table title="Gesprächsausgang" group={i.byOutcome} label="Ausgang"/>
      <Table title="Weltaktionen" group={i.byWorldAction} label="Aktion"/>
      <Table title="Erkannte Wünsche" group={i.byWish} label="Art"/>
      <Table title="Verlauf je Tag" group={i.byDay} label="Tag"/>
      <section className="rounded-xl border bg-white p-4">
       <h3 className="font-semibold">Entscheidungs- und Wirkungskette</h3>
       {data.traces.length===0?<p className="mt-2 text-sm text-[#5d6b70]">Keine Kausalspuren im Zeitraum.</p>:
       <table className="mt-2 w-full text-sm"><tbody>{data.traces.slice(0,20).map(t=><tr key={t.stage+t.status} className="border-t"><td className="py-1">{t.stage.replaceAll('_',' ')}</td><td>{t.status}</td><td className="text-right">{t.count}</td></tr>)}</tbody></table>}
      </section>
     </div>
    </section>

    <section>
     <h2 className="text-xl font-semibold">Schutzfilter</h2>
     <p className="mt-1 text-sm text-[#5d6b70]">Automatischer Filter gegen Absprachen von Straftaten in der realen Welt. Spiel bleibt Spiel – Schmuggel auf dem Mars ist kein Treffer. Nur bei kombinierten Merkmalen wird ein Ausschnitt gesichert und hier lesbar. Abrufe werden protokolliert.</p>
     <div className="mt-3 grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border bg-white p-4">
       <h3 className="font-semibold">Merkmale im Zeitraum</h3>
       {data.safety.length===0?<p className="mt-2 text-sm text-[#5d6b70]">Keine.</p>:
       <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-[#5d6b70]"><th>Merkmal</th><th className="text-right">NPC</th><th className="text-right">Raum</th></tr></thead>
        <tbody>{data.safety.map(x=><tr key={x.signal} className="border-t"><td className="py-1">{SIGNAL[x.signal]??x.signal}</td><td className="text-right">{x.npc}</td><td className="text-right">{x.room}</td></tr>)}</tbody></table>}
      </section>
      <section className="rounded-xl border bg-white p-4">
       <h3 className="font-semibold">KI-Prüfung (Stufe 2)</h3>
       <p className="mt-1 text-xs text-[#5d6b70]">Nur auffällige Fenster – Codewörter, Handelsmuster mit echter Währung, nicht abgedeckte Sprachen. Gespeichert wird nur das Ergebnis.</p>
       {data.aiReviews.total===0?<p className="mt-2 text-sm text-[#5d6b70]">Keine Prüfungen im Zeitraum.</p>:<>
        <p className="mt-2 text-sm">{data.aiReviews.total} Prüfungen: {data.aiReviews.byVerdict.map(v=>`${VERDICT[v.key]??v.key} ${v.count}`).join(' · ')}</p>
        {data.aiReviews.byCategory.length>0&&<p className="mt-1 text-sm">Bereiche: {data.aiReviews.byCategory.map(v=>`${v.key} ${v.count}`).join(' · ')}</p>}
        <p className="mt-1 text-sm">Sprachen: {data.aiReviews.byLanguage.map(v=>`${v.key} ${v.count}`).join(' · ')}</p>
       </>}
      </section>
      <section className="rounded-xl border bg-white p-4">
       <h3 className="font-semibold">Was Figuren gelernt haben</h3>
       <p className="mt-2 text-sm">{data.learning.claims} Aussagen über die Welt bei {data.learning.npcs} Figuren · {data.learning.sources===null?`weniger als ${data.minGroup} Quellen`:`${data.learning.sources} Spieler als Quelle`}</p>
       <p className="mt-1 text-xs text-[#5d6b70]">Weitererzählt wird gewichtet: von mehreren Spielern unabhängig gesagt = „man erzählt sich“ (bis 180 Tage), von einem = unbestätigt (bis 30 Tage).</p>
      </section>
     </div>
     {data.reports.filter(r=>r.origin==='filter').length>0&&<div className="mt-4 space-y-4">{data.reports.filter(r=>r.origin==='filter').map(r=><ReportCard key={r.id} r={r} onStatus={setStatus}/>)}</div>}
    </section>

    <section>
     <h2 className="text-xl font-semibold">Gemeldete Gespräche</h2>
     <p className="mt-1 text-sm text-[#5d6b70]">Spieler haben diese Ausschnitte ausdrücklich zum Lesen freigegeben. Sie werden nach {data.retention.reportDays} Tagen gelöscht. Jeder Abruf wird protokolliert.</p>
     {data.reports.filter(r=>r.origin!=='filter').length===0?<p className="mt-3 rounded border bg-white p-4">Keine Meldungen.</p>:
     <div className="mt-3 space-y-4">{data.reports.filter(r=>r.origin!=='filter').map(r=><ReportCard key={r.id} r={r} onStatus={setStatus}/>)}</div>}
    </section>

    <section>
     <h2 className="text-xl font-semibold">Admin-Testkonten</h2>
     <p className="mt-1 text-sm text-[#5d6b70]">Gespräche der Konten im Adminbereich – zum Prüfen von NPC-Verhalten. Wer NPCs testen will, spielt selbst mit einem Admin-Konto.</p>
     {data.testTurns.length===0?<p className="mt-3 rounded border bg-white p-4">Keine Testgespräche.</p>:
     <div className="mt-3 space-y-3">{data.testTurns.map(t=><article key={t.id} className="rounded-xl border bg-white p-4">
      <p className="text-xs text-[#5d6b70]">{new Date(t.created_at).toLocaleString('de-DE')} · {t.npc_name??'NPC'} ({t.npc_role??'–'}) · {t.location_name??'–'} · {t.topic??'–'} · {t.outcome??'–'}{t.world_action?' · '+t.world_action:''}</p>
      <p className="mt-2 text-sm"><strong>Test:</strong> <span className="whitespace-pre-wrap break-words">{t.player_text||'—'}</span></p>
      <p className="mt-1 text-sm"><strong>NPC:</strong> <span className="whitespace-pre-wrap break-words">{t.npc_reply||'—'}</span></p>
     </article>)}</div>}
    </section>
   </div>}
  </div>
 </main>
}
