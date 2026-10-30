'use client'
import { useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'

type Person = {id:string;display_name:string;public_role?:string|null;bio_short?:string|null;simulation_tier?:string;activity_state?:string;last_action?:string}
type Detail = {person:Person;health?:{wellbeing:number;condition_code:string|null;severity:number}|null;
 needs:{need_code:string;satisfaction:number}[];events:{id:string;event_type:string;occurred_at:string}[];
 conversations:{created_at:string;location_name:string|null;topic:string|null;outcome:string;world_action:string|null}[];unavailable:string[];note:string}
type InsightMetric = { count: number | null; quality: 'recorded' | 'unavailable' }
type InsightOverview = {
 asOf: string; since: string;
 metrics: { conversations7d: InsightMetric; memoryPairsTotal: InsightMetric; socialEvents7d: InsightMetric; insightCandidatesTotal: InsightMetric };
 latestReview: { day: string; playerTurns: number; players: number; npcs: number; npcEncounters: number } | null;
 reviewQuality: 'recorded' | 'none' | 'unavailable'; note: string;
}
const INSIGHT_METRICS: Array<[keyof InsightOverview['metrics'], string]> = [
 ['conversations7d', 'Gesprächseinträge · 7 Tage'],
 ['socialEvents7d', 'Soziale Ereignisse · 7 Tage'],
 ['memoryPairsTotal', 'Gespeicherte NPC-Spieler-Erinnerungen · gesamt'],
 ['insightCandidatesTotal', 'Erkenntniskandidaten · gesamt'],
]
export default function NpcObservatory() {
 const [people,setPeople]=useState<Person[]>([])
 const [detail,setDetail]=useState<Detail|null>(null)
 const [query,setQuery]=useState('')
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const [overview,setOverview]=useState<InsightOverview|null>(null)
 const [overviewError,setOverviewError]=useState('')
 useEffect(()=>{let active=true; (async()=>{
  try {const {token}=await getSessionInfo();const r=await fetch('/api/admin/npcs',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   if(!r.ok)throw Error('NPC-Übersicht nicht verfügbar oder kein Adminzugang')
   const j=await r.json();if(active)setPeople(j.people??[])
  }catch(e){if(active)setError(String(e))}
  finally{if(active)setLoading(false)}
 })();return()=>{active=false}},[])
 useEffect(()=>{let active=true; (async()=>{
  try {
   const {token}=await getSessionInfo()
   const r=await fetch('/api/admin/npcs/insights',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   if(!r.ok)throw Error('Erkenntnisübersicht nicht verfügbar oder kein Adminzugang')
   const j=await r.json() as InsightOverview
   if(active)setOverview(j)
  }catch{if(active)setOverviewError('Erkenntnisübersicht derzeit nicht verfügbar')}
 })();return()=>{active=false}},[])
 async function select(id:string) {
  setError('');setDetail(null)
  try {const {token}=await getSessionInfo();const r=await fetch('/api/admin/npcs?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   if(!r.ok)throw Error('NPC-Details nicht verfügbar')
   setDetail(await r.json())
  }catch(e){setError(String(e))}
 }
 const visible=people.filter(p=>(p.display_name+' '+(p.public_role??'')).toLowerCase().includes(query.toLowerCase()))
 return <main style={{background:'#07111b',color:'#e6eef4',minHeight:'100vh',padding:24,fontFamily:'system-ui'}}>
  <a href="/dashboard" style={{color:'#91d6e6'}}>← Zurück zur Welt</a>
  <h1>NPC-Observatorium</h1>
  <p>Adminansicht · Simulationszustände und dokumentierte Ereignisse · ausschließlich lesend</p>
  {overviewError&&<p role="status">{overviewError}</p>}
  {overview&&<section aria-label="Erkenntnisse aus dem Spiel" style={{padding:16,margin:'18px 0',border:'1px solid #375162',borderRadius:8}}>
   <h2>Gespräche, Begegnungen und Erkenntnisse</h2>
   <p>Stand: {new Date(overview.asOf).toLocaleString('de-DE')} · 7-Tage-Fenster ab {new Date(overview.since).toLocaleString('de-DE')}</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:12}}>{INSIGHT_METRICS.map(([key,label])=><div key={key} style={{padding:12,background:'#172c3b',borderRadius:6,minWidth:160}}>
    <strong style={{display:'block',fontSize:24}}>{overview.metrics[key].quality==='recorded'?overview.metrics[key].count:'–'}</strong>
    <span>{label}</span>
    {overview.metrics[key].quality==='unavailable'&&<small style={{display:'block'}}>Quelle nicht verfügbar</small>}
   </div>)}</div>
   {overview.latestReview?<p>Letzte Gesprächsauswertung: {overview.latestReview.day} · {overview.latestReview.playerTurns} Spielerbeiträge · {overview.latestReview.npcEncounters} NPC-Begegnungen</p>
    :<p>{overview.reviewQuality==='none'?'Noch keine Gesprächsauswertung gespeichert.':'Gesprächsauswertung derzeit nicht verfügbar.'}</p>}
   <p style={{opacity:.8}}>{overview.note}</p>
  </section>}
  {error&&<p role="alert" style={{color:'#ffb3a8'}}>{error}</p>}
  {loading?<p>Lade Personen …</p>:<div style={{display:'grid',gridTemplateColumns:'minmax(200px,1fr) minmax(300px,2fr)',gap:18}}>
   <section><label htmlFor="npc-search">NPC suchen</label><input id="npc-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name oder Beruf" style={{display:'block',padding:10,width:'95%'}}/>
    <p>{visible.length} von {people.length} geladenen Personen (max. 100)</p>
    <div style={{maxHeight:'70vh',overflow:'auto'}}>{visible.map(p=><button key={p.id} onClick={()=>select(p.id)} style={{display:'block',width:'100%',textAlign:'left',padding:12,margin:'4px 0',background:'#172c3b',color:'#e6eef4',border:'1px solid #375162',borderRadius:6,cursor:'pointer'}}>{p.display_name}<small style={{display:'block'}}>{p.public_role??p.activity_state??'Rolle nicht hinterlegt'}</small></button>)}</div>
   </section>
   <section aria-live="polite">{!detail?<p>Wähle eine Person für Biografie, Gespräche und Ereignisse.</p>:<>
    <h2>{detail.person.display_name}</h2><p>{detail.person.public_role??'Keine öffentliche Rolle'}</p>
    <p>{detail.person.bio_short??'Keine Biografie hinterlegt'}</p>
    <h3>Körperlicher Zustand</h3><p>{detail.health?('Wohlbefinden: '+detail.health.wellbeing+' · Zustand: '+(detail.health.condition_code??'kein Code')+' · Schwere: '+detail.health.severity):'Kein gespeicherter Gesundheitszustand'}</p>
    <h3>Bedürfnisse</h3>{detail.needs.length?<ul>{detail.needs.map(n=><li key={n.need_code}>{n.need_code}: {n.satisfaction}</li>)}</ul>:<p>Keine Werte hinterlegt</p>}
    <h3>Letzte Gespräche (Metadaten)</h3>{detail.conversations.length?<ul>{detail.conversations.map((c,i)=><li key={i}>{new Date(c.created_at).toLocaleString('de-DE')} · {c.topic??'Thema unbekannt'} · {c.outcome} · {c.location_name??'Ort unbekannt'}</li>)}</ul>:<p>Keine protokollierten Gespräche</p>}
    <h3>Lebensereignisse</h3>{detail.events.length?<ul>{detail.events.map(e=><li key={e.id}>{new Date(e.occurred_at).toLocaleString('de-DE')} · {e.event_type}</li>)}</ul>:<p>Keine protokollierten Ereignisse</p>}
    <h3>Weitere Perspektiven</h3><p>Hormone, detailliertes Langzeitgedächtnis und Beziehungsgraph: noch nicht angeschlossen; keine fiktiven Messwerte.</p>
   </>}</section>
  </div>}
 </main>
}
