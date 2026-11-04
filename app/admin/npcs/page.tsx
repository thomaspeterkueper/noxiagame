'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type Person = {id:string;display_name:string;bio_short:string|null;public_role:string|null;simulation_tier:string|null;activity_state:string|null;last_action:string|null;last_tick:number|null}
type Entry = Record<string, unknown>
type Detail = {person:Person;health:Entry|null;affect:Entry|null;cognition:Entry|null;needs:Entry[];relationships:Entry[];memories:Entry[];conversations:Entry[];events:Entry[];partial:boolean}
const value = (v:unknown) => v === null || v === undefined ? 'Nicht erfasst' : String(v)
const blocks: Array<{title:string;key:keyof Detail;columns:string[]}> = [
  {title:'Bedürfnisse',key:'needs',columns:['need_code','satisfaction']},
  {title:'Beziehungen',key:'relationships',columns:['relationship_type','familiarity','trust','affinity','encounter_count_total']},
  {title:'Gedächtnis (Metadaten)',key:'memories',columns:['memory_kind','salience','valence','tick']},
  {title:'Gespräche (ohne private Wortlaute)',key:'conversations',columns:['created_at','topic','outcome','location_name']},
  {title:'Ereignisse',key:'events',columns:['occurred_at','event_type']},
]
export default function NpcAdminPage() {
  const [people,setPeople]=useState<Person[]>([])
  const [total,setTotal]=useState<number|null>(null)
  const [detail,setDetail]=useState<Detail|null>(null)
  const [query,setQuery]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  async function request(path:string) {
    const token=await getToken()
    if(!token) throw new Error('Bitte mit einem berechtigten Spielerkonto anmelden.')
    const res=await fetch(path,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    const json=await res.json().catch(()=>({}))
    if(!res.ok) throw new Error(String(json.error??'Daten nicht verfügbar'))
    return json
  }
  useEffect(()=>{let live=true;void request('/api/admin/npcs').then(r=>{
    if(live){setPeople(r.people??[]);setTotal(r.total??null)}
  }).catch(e=>{if(live)setError(String(e))}).finally(()=>{if(live)setLoading(false)})
  return()=>{live=false}},[])
  async function show(id:string){
    setDetail(null);setError('')
    try{setDetail(await request('/api/admin/npcs?id='+encodeURIComponent(id)))}catch(e){setError(String(e))}
  }
  const shown=people.filter(p=>(p.display_name+' '+(p.public_role??'')).toLowerCase().includes(query.toLowerCase()))
  return <main className="min-h-screen bg-[#f6f4ee] p-5 text-[#1d2a30]">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="text-sm font-semibold text-[#1f4f54]">← Adminbereich</Link>
      <h1 className="mt-4 text-3xl font-bold">NPC-Observatorium</h1>
      <p className="mt-2 text-sm text-[#5d6b70]">Reale gespeicherte Simulationsdaten, ausschließlich lesend. Keine erfundenen Messwerte.</p>
      {error&&<p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm">{error}</p>}
      {loading?<p className="mt-5">Lädt NPCs …</p>:<div className="mt-6 grid gap-5 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
        <section className="rounded-xl border bg-white p-4">
          <label className="text-sm font-semibold" htmlFor="npc-search">NPC suchen</label>
          <input id="npc-search" value={query} onChange={e=>setQuery(e.target.value)}
            className="my-3 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Name oder Tätigkeit"/>
          <p className="mb-3 text-xs text-[#5d6b70]">{shown.length} angezeigt · {people.length} geladen{total!==null?' von '+total:''}</p>
          <div className="max-h-[65vh] space-y-2 overflow-y-auto">
            {shown.map(p=><button key={p.id} type="button" onClick={()=>void show(p.id)}
              className="block w-full rounded-lg border p-3 text-left hover:bg-[#e8f2ef]">
              <strong className="block text-sm">{p.display_name}</strong>
              <span className="text-xs text-[#5d6b70]">{p.public_role??p.activity_state??'Keine Rolle gespeichert'}</span>
            </button>)}
          </div>
        </section>
        <section className="min-w-0 rounded-xl border bg-white p-5">
          {!detail?<p className="text-sm text-[#5d6b70]">Eine Figur auswählen, um ihren Zustand und ihre Entwicklung zu untersuchen.</p>:<>
            <h2 className="text-2xl font-bold">{detail.person.display_name}</h2>
            <p className="mt-1 text-sm text-[#5d6b70]">{detail.person.public_role??'Keine Rolle'} · {detail.person.simulation_tier??'Keine Simulationsstufe'}</p>
            <p className="my-4">{detail.person.bio_short??'Noch keine Biografie erfasst.'}</p>
            {detail.partial&&<p className="my-3 text-sm text-amber-900">Einzelne Datenquellen konnten nicht geladen werden.</p>}
            <div className="grid gap-3 sm:grid-cols-3">
              {([{title:'Gesundheit',data:detail.health,fields:['wellbeing','condition_code','severity']},{title:'Emotionen',data:detail.affect,fields:['joy','fear','anger','sadness','mood','pain']},{title:'Kognition',data:detail.cognition,fields:['mode','compute_tier','trigger_score']}] as const).map(card=><article key={card.title} className="rounded-lg bg-[#f6f4ee] p-3">
                <h3 className="mb-2 font-semibold">{card.title}</h3>
                {card.data?card.fields.map(k=><p key={k} className="text-xs"><span className="font-semibold">{k}:</span> {value(card.data?.[k])}</p>):<p className="text-xs">Nicht erfasst</p>}
              </article>)}
            </div>
            {blocks.map(b=><section key={b.title} className="mt-6">
              <h3 className="mb-2 font-semibold">{b.title}</h3>
              {Array.isArray(detail[b.key])&&(detail[b.key] as Entry[]).length>0?
                <div className="max-h-56 overflow-auto rounded-lg border">
                  {(detail[b.key] as Entry[]).map((entry,i)=><div className="border-b p-2 text-xs" key={String(entry.id??i)}>
                    {b.columns.map(k=><span className="mr-3 inline-block" key={k}><b>{k}</b>: {value(entry[k])}</span>)}
                  </div>)}
                </div>:<p className="text-sm text-[#5d6b70]">Keine Daten gespeichert.</p>}
            </section>)}
            <p className="mt-6 text-xs text-[#5d6b70]">Gedächtnis: nur Metadaten, keine privaten Gesprächsinhalte. Verbindungsgraph und Hormonmodell werden erst mit nachweisbaren Messdaten erweitert.</p>
          </>}
        </section>
      </div>}
    </div>
  </main>
}
