'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type Place = {id:string;name:string;slug:string;population:number|null;population_max:number|null;is_supplied:boolean|null;simulate_tick:boolean|null;location_type:string|null}
type Event = {id:string;event_type:string;occurred_at:string;location_id:string|null}
type Data = {measured_at:string;metrics:{npcs:number;locations:number;ships:number;population_total:number;events_24h:number;last_tick:{tick_number:number;tick_type:string;created_at:string}|null};places:Place[];recent_events:Event[];note:string}
const fmt=(v:string)=>new Date(v).toLocaleString('de-DE')
export default function WorldMonitorPage(){
  const [data,setData]=useState<Data|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const load=useCallback(async()=>{
    setBusy(true);setError('')
    try{
      const token=await getToken()
      if(!token)throw Error('Bitte mit einem Admin-Spielerkonto anmelden.')
      const res=await fetch('/api/admin/world',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      const json=await res.json().catch(()=>({}))
      if(!res.ok)throw Error(String(json.error??'Weltdaten nicht erreichbar'))
      setData(json)
    }catch(e){setError(String(e))}
    finally{setBusy(false)}
  },[])
  useEffect(()=>{void load()},[load])
  return <main className="min-h-screen bg-[#f6f4ee] px-4 py-8 text-[#1d2a30]">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="text-sm font-semibold text-[#1f4f54]">← Adminbereich</Link>
      <header className="my-5 flex flex-wrap justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Welt- & Simulationsmonitor</h1><p className="mt-2 text-sm text-[#63737a]">Bestandszahlen und letzte Ereignisse · nur lesend</p></div>
        <button onClick={()=>void load()} disabled={busy} className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50">{busy?'Lädt …':'Aktualisieren'}</button>
      </header>
      {error&&<p role="alert" className="mb-5 rounded border border-red-300 bg-red-50 p-3">{error}</p>}
      {data&&<>
        <section aria-label="Weltkennzahlen" className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {([['NPC-Personen',data.metrics.npcs],['Standorte (geladen)',data.metrics.locations],['Raumschiffe',data.metrics.ships],['Standortbevölkerung',data.metrics.population_total],['Ereignisse · 24 Std.',data.metrics.events_24h],['Letzter Simulationstakt',data.metrics.last_tick?.tick_number??'—']] as const).map(([name,val])=>
            <article key={name} className="rounded-xl border bg-white p-4"><p className="text-xs text-[#63737a]">{name}</p><p className="mt-1 text-3xl font-bold tabular-nums">{val}</p></article>
          )}
        </section>
        <p className="my-4 text-xs text-[#63737a]">Messung: {fmt(data.measured_at)} · Letzter Takt: {data.metrics.last_tick?fmt(data.metrics.last_tick.created_at):'nicht erfasst'}. {data.note}</p>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Standorte & Versorgung</h2>
            <div className="max-h-[60vh] overflow-auto"><table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th className="py-2">Ort</th><th>Bevölkerung</th><th>Versorgung</th><th>Takt</th></tr></thead>
              <tbody>{data.places.map(p=><tr key={p.id} className="border-b">
                <td className="py-2">{p.name}</td><td>{p.population??'—'} / {p.population_max??'—'}</td>
                <td>{p.is_supplied===null?'—':p.is_supplied?'Ja':'Nein'}</td><td>{p.simulate_tick?'Aktiv':'Aus'}</td>
              </tr>)}</tbody>
            </table></div>
          </section>
          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Letzte Welt-Ereignisse</h2>
            {data.recent_events.length===0?<p className="text-sm text-[#63737a]">Keine Ereignisse erfasst.</p>:
              <div className="max-h-[60vh] overflow-auto">{data.recent_events.map(e=><div className="border-b py-2 text-sm" key={e.id}><strong>{e.event_type}</strong><p className="text-xs text-[#63737a]">{fmt(e.occurred_at)}</p></div>)}</div>}
          </section>
        </div>
      </>}
    </div>
  </main>
}
