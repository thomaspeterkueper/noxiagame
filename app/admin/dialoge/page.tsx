'use client'

import Link from 'next/link'
import {useCallback,useEffect,useState} from 'react'
import {getToken} from '@/lib/supabase/auth'

type CausalStep = {correlation_id:string;stage:string;status:string;detail:Record<string,unknown>;created_at:string}
type Turn = {
 correlation_id:string|null;causal_trace:CausalStep[];
 id:number;created_at:string;player_profile_id:string;npc_person_id:string|null;
 npc_name:string|null;npc_role:string|null;location_name:string|null;
 player_text:string|null;npc_reply:string|null;topic:string|null;
 outcome:string|null;world_action:string|null;wish_kind:string|null;
 wish_object:string|null;wish_npc_denied:boolean|null;headline:string|null;
 turn_index:number|null;opening:boolean|null
}
type Response = {rows:Turn[];enabled:boolean;note:string;truncated?:boolean}

export default function ConversationReviewPage(){
 const [data,setData]=useState<Response|null>(null)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 const [npcId,setNpcId]=useState('')
 const load=useCallback(async()=>{
   setLoading(true);setError('')
   try{
     const token=await getToken()
     if(!token)throw Error('Bitte mit berechtigtem Admin-Spielerkonto anmelden.')
     const q=npcId.trim()?'?npcId='+encodeURIComponent(npcId.trim()):''
     const r=await fetch('/api/admin/conversation-audit'+q,{
       headers:{Authorization:'Bearer '+token},cache:'no-store'})
     const j=await r.json().catch(()=>({}))
     if(!r.ok)throw Error(j.error??'Daten nicht erreichbar')
     setData(j as Response)
   }catch(e){setError(String(e))}
   finally{setLoading(false)}
 },[npcId])
 useEffect(()=>{void load()},[load])
 return <main className="min-h-screen bg-[#f6f4ee] p-6 text-[#1d2a30]">
  <div className="mx-auto max-w-5xl">
   <Link href="/admin" className="text-sm font-semibold text-[#1f4f54]">← Adminbereich</Link>
   <h1 className="mt-4 text-3xl font-bold">Gesprächs- & Entscheidungsdiagnostik</h1>
   <p className="my-3 text-sm text-[#5d6b70]">
     Wörtliche Spieler-NPC-Dialoge erscheinen ausschließlich bei aktiver freiwilliger Einwilligung,
     nur für Gesprächseinträge nach deren Beginn. Jeder Textabruf wird protokolliert.
   </p>
   <p className="mb-4 text-sm">Informationen zur Testprotokollierung: <Link className="underline" href="/testbetrieb">Testbetrieb &amp; Datenschutz</Link>.</p>
   <form onSubmit={e=>{e.preventDefault();void load()}} className="mb-5 flex flex-wrap items-end gap-3">
    <label className="text-sm">NPC-ID (optional)
     <input className="mt-1 block w-80 max-w-full rounded border p-2" value={npcId} onChange={e=>setNpcId(e.target.value)} placeholder="Alle NPCs"/>
    </label>
    <button type="submit" disabled={loading} className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50">{loading?'Lädt …':'Aktualisieren'}</button>
   </form>
   {error&&<p role="alert" className="rounded border border-red-300 bg-red-50 p-3">{error}</p>}
   {data&&<>
    <p className="mb-4 text-xs text-[#5d6b70]">{data.note} · Diagnosefunktion: {data.enabled ? "freigeschaltet" : "noch gesperrt"}</p>
    {data.truncated&&<p role="status">Weitere Einträge sind vorhanden; die Anzeige ist begrenzt.</p>}
    <section aria-label="Freigegebene Gesprächseinträge" className="space-y-4">
    {data.rows.length===0&&<p className="rounded border bg-white p-4">Keine aktuell verfügbaren Testgesprächsprotokolle.</p>}
    {data.rows.map(row=><article key={row.id} className="rounded-xl border bg-white p-5">
      <header className="mb-3">
       <h2 className="font-semibold">{row.npc_name??'NPC'} <span className="font-normal text-[#5d6b70]">· {row.npc_role??'Rolle unbekannt'}</span></h2>
       <p className="text-xs text-[#5d6b70]">{new Date(row.created_at).toLocaleString('de-DE')} · {row.location_name??'Ort unbekannt'} · Turn {row.turn_index??'–'} · Log #{row.id}</p>
      </header>
      <div className="space-y-2">
       <div className="rounded bg-[#f6f4ee] p-3"><strong className="text-xs">Spieler</strong><p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.player_text||'—'}</p></div>
       <div className="rounded bg-[#e8f2ef] p-3"><strong className="text-xs">NPC</strong><p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.npc_reply||'—'}</p></div>
      </div>
      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
       <div><dt className="font-semibold">Erkanntes Thema</dt><dd>{row.topic??'Nicht erfasst'}</dd></div>
       <div><dt className="font-semibold">Gesprächsausgang</dt><dd>{row.outcome??'Nicht erfasst'}</dd></div>
       <div><dt className="font-semibold">Wunsch / Signal</dt><dd>{[row.wish_kind,row.wish_object].filter(Boolean).join(' · ')||'Kein Signal'}</dd></div>
       <div><dt className="font-semibold">Protokollierte Weltaktion</dt><dd>{row.world_action??'Keine'}</dd></div>
      </dl>
      <section className="mt-4 rounded-lg border bg-[#f8f7f2] p-3">
        <h3 className="text-sm font-semibold">Entscheidungs- und Wirkungskette</h3>
        <p className="mt-1 break-all text-xs text-[#5d6b70]">Korrelations-ID: {row.correlation_id??'Älteres Gespräch – noch nicht erfasst'}</p>
        {row.causal_trace?.length ? <ol className="mt-3 space-y-2">
          {row.causal_trace.map((event,i)=><li className="rounded border-l-4 border-[#8ca9a0] bg-white px-3 py-2 text-xs" key={event.stage+'-'+i}>
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{event.stage.replaceAll('_',' ')}</strong>
              <span>{event.status==='succeeded'?'Gespeichert':event.status==='failed'?'Fehlgeschlagen':event.status==='proposed'?'Nur vorgeschlagen':event.status==='not_confirmed'?'Nicht bestätigt':'Beobachtet'}</span>
            </div>
            <p className="mt-1 break-words text-[#5d6b70]">{Object.entries(event.detail??{}).map(([k,v])=>k+': '+String(v)).join(' · ')}</p>
          </li>)}
        </ol>:<p className="mt-2 text-xs text-[#5d6b70]">Für dieses Gespräch liegt noch keine Kausalspur vor.</p>}
        <p className="mt-3 text-xs text-[#5d6b70]">Eine an den Client gesendete Weltaktion gilt erst nach einer eigenständigen Ausführungsbestätigung als durchgeführt. Aktuell protokollieren wir Vorschläge und persistierte serverseitige Gedächtnis-/Wissensänderungen.</p>
      </section>
    </article>)}
    </section>
   </>}
  </div>
 </main>
}
