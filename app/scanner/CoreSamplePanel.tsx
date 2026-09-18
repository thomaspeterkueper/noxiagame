'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type CoreJob = {
  id:string
  latitude_deg:number
  longitude_deg:number
  status:'running'|'completed'|'failed'
  energy_cost:number
  component_cost:number
  started_at:string
  completes_at:string
  completed_at?:string|null
  result?:{
    empty?:boolean
    resource_type?:string
    abundance?:number
    abundance_tier?:string
    distance_m?:number
    confidence?:string
    error?:string
  }|null
}

type CoreState = {
  owned:boolean
  cost:{energy:number;components:number}
  durationSeconds:number
  sampleRadiusM:number
  jobs:CoreJob[]
  error?:string
}

async function authHeaders():Promise<Record<string,string>> {
  const sb=createClient()
  const {data:{session}}=await sb.auth.getSession()
  return session?{Authorization:`Bearer ${session.access_token}`}:{ }
}

const RESOURCE_LABEL:Record<string,string>={
  gold:'Gold',copper_ore:'Kupfer',iron_ore:'Eisen',rare_earth:'Seltene Erden',silica_quartz:'Quarz/Silika',uranium:'Uran',
  sand_gravel:'Sand/Kies',limestone:'Kalkstein',salt:'Salz',groundwater:'Grundwasser',titanium:'Titan',zirconium:'Zirkonium',
  bauxite:'Bauxit',zinc:'Zink',lead:'Blei',nickel:'Nickel',cobalt:'Kobalt',lithium:'Lithium',gypsum:'Gips',phosphate:'Phosphat',
}

export default function CoreSamplePanel({location}:{location:string}) {
  const [visible,setVisible]=useState(false)
  const [state,setState]=useState<CoreState|null>(null)
  const [lat,setLat]=useState('')
  const [lon,setLon]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  const load=useCallback(async()=>{
    try {
      const headers=await authHeaders()
      const [scannerRes,coreRes]=await Promise.all([
        fetch(`/api/game/scanner?location=${encodeURIComponent(location)}`,{headers}),
        fetch(`/api/game/core-sample?location=${encodeURIComponent(location)}`,{headers}),
      ])
      const scanner=await scannerRes.json()
      if (scanner.mode!=='resource') { setVisible(false); return }
      setVisible(true)
      if (!coreRes.ok) throw new Error((await coreRes.json()).error||'core_sample_load_failed')
      const data:CoreState=await coreRes.json()
      setState(data)
      if (!lat && Number.isFinite(scanner.scanner?.lat)) setLat(Number(scanner.scanner.lat).toFixed(5))
      if (!lon && Number.isFinite(scanner.scanner?.lon)) setLon(Number(scanner.scanner.lon).toFixed(5))
    } catch(e) {
      setError(e instanceof Error?e.message:'core_sample_load_failed')
    }
  },[location,lat,lon])

  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    if (!visible || !(state?.jobs??[]).some(j=>j.status==='running')) return
    const timer=window.setInterval(()=>void load(),15000)
    return()=>window.clearInterval(timer)
  },[visible,state?.jobs,load])

  async function start() {
    setBusy(true);setError('')
    try {
      const headers=await authHeaders()
      const res=await fetch('/api/game/core-sample',{
        method:'POST',headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({location,lat:Number(lat),lon:Number(lon)}),
      })
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'core_sample_start_failed')
      await load()
    } catch(e) { setError(e instanceof Error?e.message:'core_sample_start_failed') }
    finally { setBusy(false) }
  }

  if(!visible) return null
  const running=state?.jobs?.some(j=>j.status==='running')??false

  return <section style={{maxWidth:1180,margin:'14px auto 24px',padding:'0 18px',color:'#e9f1f4',fontFamily:'system-ui'}}>
    <div style={{border:'1px solid #5b5130',borderRadius:12,background:'#16140dcc',padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div><div style={{fontSize:11,letterSpacing:'.14em',color:'#d0b75e'}}>GEZIELTE PROSPEKTION</div><h2 style={{fontSize:17,margin:'4px 0'}}>Bohrkernanalyse</h2><div style={{fontSize:11,color:'#9aa7ad',maxWidth:720}}>Kein Radius-Scan: Eine reale Zielkoordinate wird beprobt. Die Probe kostet Material und Energie, benötigt Zeit und liefert erst nach Abschluss ein hochauflösendes Laborergebnis. Ein leerer Bohrkern ist ebenfalls ein gültiges Ergebnis.</div></div>
        <div style={{fontSize:11,color:'#c9b66b',textAlign:'right'}}>5 m Probe · {Math.round((state?.durationSeconds??900)/60)} min<br/>{state?.cost.energy??25} Energie · {state?.cost.components??1} Komponente</div>
      </div>
      {!state?.owned?<div style={{marginTop:12,padding:10,border:'1px solid #4b4540',borderRadius:8,color:'#9c9995'}}>Bohrkernanalyse ist noch nicht verfügbar. Das Instrument muss erst erworben oder freigeschaltet werden.</div>:<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr)) auto',gap:8,marginTop:12,alignItems:'end'}}>
          <label style={{fontSize:11,color:'#9caeb6'}}>Breitengrad<input value={lat} onChange={e=>setLat(e.target.value)} inputMode="decimal" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:4,padding:'8px 9px',borderRadius:7,border:'1px solid #4e513f',background:'#0d1417',color:'#edf2f3'}}/></label>
          <label style={{fontSize:11,color:'#9caeb6'}}>Längengrad<input value={lon} onChange={e=>setLon(e.target.value)} inputMode="decimal" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:4,padding:'8px 9px',borderRadius:7,border:'1px solid #4e513f',background:'#0d1417',color:'#edf2f3'}}/></label>
          <button onClick={start} disabled={busy||running||!lat||!lon} style={{padding:'9px 14px',border:'1px solid #aa9143',borderRadius:8,background:busy||running?'#48442f':'#755d12',color:'#fff',fontWeight:700}}>{busy?'STARTE …':running?'BOHRUNG LÄUFT':'BOHRUNG STARTEN'}</button>
        </div>
      </>}
      {error&&<div style={{marginTop:10,color:'#e9aaa1',fontSize:11}}>Bohrkern: {error}</div>}
      {!!state?.jobs?.length&&<div style={{marginTop:14,display:'grid',gap:7}}>{state.jobs.map(job=><div key={job.id} style={{padding:'9px 10px',border:'1px solid #343b3d',borderRadius:8,background:'#0b1114'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><b style={{fontSize:11}}>{job.status==='running'?'Bohrung läuft':job.status==='failed'?'Bohrung fehlgeschlagen':job.result?.empty?'Kein Vorkommen in der Probe':`Probe: ${RESOURCE_LABEL[job.result?.resource_type??'']??job.result?.resource_type??'ausgewertet'}`}</b><span style={{fontSize:10,color:'#83949b'}}>{Number(job.latitude_deg).toFixed(5)} / {Number(job.longitude_deg).toFixed(5)}</span></div>{job.status==='running'&&<div style={{fontSize:10,color:'#bfae70',marginTop:4}}>Auswertung ab {new Date(job.completes_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</div>}{job.status==='completed'&&!job.result?.empty&&<div style={{fontSize:10,color:'#9eb1b9',marginTop:4}}>Konzentration: {job.result?.abundance_tier??'—'} · direkte Probe · Evidenz hoch</div>}{job.status==='completed'&&job.result?.empty&&<div style={{fontSize:10,color:'#83949b',marginTop:4}}>Innerhalb des 5-m-Probenbereichs wurde kein modelliertes Rohstoffvorkommen getroffen.</div>}{job.status==='failed'&&<div style={{fontSize:10,color:'#d4938b',marginTop:4}}>{job.result?.error??'unbekannter Fehler'}</div>}</div>)}</div>}
    </div>
  </section>
}
