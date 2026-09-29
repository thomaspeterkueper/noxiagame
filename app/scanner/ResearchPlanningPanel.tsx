'use client'
import{useState}from'react'
import{createClient}from'@/lib/supabase/client'

type Question={id:string;title:string;question:string;learningPathId:string;requirement:{observable:string;environment:string;minRangeMeters?:number}}
type Plan={question:Question;sufficientInstrumentIds:string[];nearestCandidates:{instrumentId:string;gaps:string[]}[];gap:{missingDimensions:string[];candidateInstrumentTypes:string[]}|null}
const GAP:Record<string,string>={observable:'Messgröße',environment:'Messumgebung',range:'Reichweite',uncertainty:'Unsicherheit',detection_limit:'Nachweisgrenze',spatial_resolution:'räumliche Auflösung',temporal_resolution:'zeitliche Auflösung'}
async function headers(){const sb=createClient(),{data:{session}}=await sb.auth.getSession();return session?{Authorization:`Bearer ${session.access_token}`}:{}}

export default function ResearchPlanningPanel({location,questions,onUseInstrument}:{location:string;questions:Question[];onUseInstrument:(id:string)=>void}){
 const[selected,setSelected]=useState(questions[0]?.id??''),[plan,setPlan]=useState<Plan|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const q=questions.find(x=>x.id===selected)
 async function assess(){if(!selected)return;setBusy(true);setError('');try{const h=await headers(),r=await fetch(`/api/game/scanner?location=${encodeURIComponent(location)}&researchQuestion=${encodeURIComponent(selected)}`,{headers:h}),d=await r.json();if(!r.ok)throw new Error(d.error||'research_plan_failed');setPlan(d.researchPlan??null)}catch(e){setError(e instanceof Error?e.message:'research_plan_failed')}finally{setBusy(false)}}
 if(!questions.length)return null
 return <section style={{marginBottom:14,border:'1px solid #4b465f',borderRadius:12,background:'#100f1bcc',padding:13}}>
  <div style={{fontSize:10,letterSpacing:'.14em',color:'#b6a7dc'}}>WISSENSCHAFTLICHE MESSPLANUNG</div>
  <h2 style={{fontSize:15,margin:'4px 0 5px'}}>Von der Frage zur Messung</h2>
  <div style={{fontSize:11,color:'#9690aa',maxWidth:850}}>Formuliere zuerst, was beobachtet werden soll. NOXIA prüft dann die tatsächlich vorhandenen Instrumente. Eine technische Lücke wird nur angezeigt, wenn kein vorhandenes Instrument die Anforderung erfüllt.</div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
   <select value={selected} onChange={e=>{setSelected(e.target.value);setPlan(null)}} style={{flex:'1 1 330px',background:'#121725',color:'#eef0f5',border:'1px solid #514b69',borderRadius:8,padding:'8px 10px'}}>{questions.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>
   <button onClick={assess} disabled={busy} style={{padding:'8px 13px',border:'1px solid #776b9d',borderRadius:8,background:'#2b2444',color:'#fff',fontWeight:700}}>{busy?'PRÜFE …':'MESSPLAN PRÜFEN'}</button>
  </div>
  {q&&<div style={{fontSize:11,color:'#b5b0c3',marginTop:8}}><b>Forschungsfrage:</b> {q.question}<br/><span style={{color:'#817b91'}}>Anforderung: {q.requirement.observable} · {q.requirement.environment}{q.requirement.minRangeMeters?` · ≥ ${q.requirement.minRangeMeters} m`:''}</span></div>}
  {plan&&!plan.gap&&<div style={{marginTop:10,padding:10,border:'1px solid #416853',borderRadius:8,background:'#0e2118'}}><b style={{fontSize:11,color:'#9dd3ae'}}>Messung mit vorhandener Technik möglich</b><div style={{fontSize:11,color:'#91a99a',marginTop:3}}>Geeignet: {plan.sufficientInstrumentIds.join(' · ')}</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:7}}>{plan.sufficientInstrumentIds.map(id=><button key={id} onClick={()=>onUseInstrument(id)} style={{fontSize:10,padding:'5px 8px',border:'1px solid #4b765e',borderRadius:6,background:'#173224',color:'#dcebe1'}}>Für nächsten Scan verwenden: {id}</button>)}</div></div>}
  {plan?.gap&&<div style={{marginTop:10,padding:10,border:'1px solid #755b39',borderRadius:8,background:'#261b0e'}}><b style={{fontSize:11,color:'#e0bd7c'}}>Echte Instrumentlücke erkannt</b><div style={{fontSize:11,color:'#bca989',marginTop:3}}>Fehlende Fähigkeit: {plan.gap.missingDimensions.map(x=>GAP[x]??x).join(' · ')}</div>{plan.nearestCandidates.length>0&&<div style={{fontSize:10,color:'#968872',marginTop:4}}>Nächste vorhandene Kandidaten: {plan.nearestCandidates.map(x=>`${x.instrumentId} (${x.gaps.map(g=>GAP[g]??g).join(', ')})`).join(' · ')}</div>}<div style={{fontSize:10,color:'#a99676',marginTop:5}}>Diese Lücke darf ein Instrument-Entwicklungsziel auslösen; Ground Truth wird dadurch nicht freigeschaltet.</div></div>}
  {error&&<div style={{fontSize:10,color:'#e7a9a1',marginTop:7}}>{error}</div>}
  <div style={{marginTop:9,fontSize:10,color:'#8d86a0'}}>SSF-Lernpfad: <code>{q?.learningPathId}</code> · Messung, Unsicherheit, negative Evidenz und Instrumentwahl. Der Pfad ist die Wissensbrücke; er vergibt keine verborgenen Weltwerte.</div>
 </section>
}
