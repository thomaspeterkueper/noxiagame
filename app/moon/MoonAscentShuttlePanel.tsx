'use client'

import { useEffect, useState } from 'react'
import { getToken } from '@/lib/supabase/auth'

type ShuttlePayload={
  shuttle?:{
    ship?:{id:string;name:string;ship_type_id:string;location:string;status:string;cargo_max:number}
    vehicle?:{id:string;frame_id:string;label:string;status:string;current_node_inventory_id:string|null}
    article?:{
      engineering_frame_id:string
      engineering_authority_ref:string
      state_status:string
      actual_start_mass_kg:number|null
      crew_cargo_mission_equipment_kg:number|null
      usable_ascent_propellant_kg:number|null
      crew_mass_resolved:boolean
      cargo_mass_resolved:boolean
      mission_equipment_mass_resolved:boolean
      target_plane_resolved:boolean
    }
    inventory?:{id:string;label:string;capacity:number|null;totalAmount?:number;items?:Array<{resource:string;label?:string;unit?:string;amount:number;available?:number}>}
    surfacePort?:{id:string;label:string;capacity:number|null;totalAmount?:number;items?:Array<{resource:string;label?:string;unit?:string;amount:number;available?:number}>}
    orbitalInterface?:{id:string;label:string;capacity:number|null;totalAmount?:number;items?:Array<{resource:string;label?:string;unit?:string;amount:number;available?:number}>}
  }|null
  error?:string
}
type AscentPayload={mission?:{id:string;phase:string;status:string}|null;orbitalPresence?:{orbit_node_slug?:string;body_slug?:string}|null;executionReady?:boolean;error?:string}
type DockPort={id:string;label:string;status:string;reservedForVesselId?:string|null;occupiedByVesselId?:string|null;cargoEnabled?:boolean}
type DockConnection={id:string;port_id:string;status:string}
type ReadinessPayload={
  ok?:boolean
  assessment?:{ready?:boolean;blockers?:string[]}
  evidence?:Record<string,string>
  engineeringAssessment?:{result?:string;details?:string[]}|null
  crew?:{boarded?:boolean;role?:string|null}
  cargo?:{empty?:boolean;rationale?:string}
  error?:string
}

export default function MoonAscentShuttlePanel(){
  const [shuttle,setShuttle]=useState<ShuttlePayload['shuttle']>(null)
  const [readiness,setReadiness]=useState<ReadinessPayload|null>(null)
  const [ascent,setAscent]=useState<AscentPayload|null>(null)
  const [ports,setPorts]=useState<DockPort[]>([])
  const [connection,setConnection]=useState<DockConnection|null>(null)
  const [busy,setBusy]=useState(false)
  const [cargoResource,setCargoResource]=useState('metal')
  const [cargoAmount,setCargoAmount]=useState(1)
  const [message,setMessage]=useState<string|null>(null)

  async function authHeaders(){
    const token=await getToken()
    if(!token) throw new Error('Nicht angemeldet')
    return {Authorization:`Bearer ${token}`}
  }

  async function load(){
    try{
      const headers=await authHeaders()
      const r=await fetch('/api/game/moon/ascent-shuttle',{headers,cache:'no-store'})
      const p=await r.json() as ShuttlePayload
      if(!r.ok) throw new Error(p.error??'Shuttle konnte nicht geladen werden')
      setShuttle(p.shuttle??null)
      const shipId=p.shuttle?.ship?.id
      if(shipId){
        const [rr,ar,pr,cr]=await Promise.all([
          fetch('/api/game/ascent/readiness',{
            method:'POST',headers:{...headers,'Content-Type':'application/json'},
            body:JSON.stringify({shipId,departureSurfaceSlug:'moon',targetOrbitNodeSlug:'moon-llo-100'}),
            cache:'no-store',
          }),
          fetch('/api/game/ascent?shipId='+encodeURIComponent(shipId),{headers,cache:'no-store'}),
          fetch('/api/game/docking?stationSlug=moon',{headers,cache:'no-store'}),
          fetch('/api/game/docking?shipId='+encodeURIComponent(shipId),{headers,cache:'no-store'}),
        ])
        setReadiness(await rr.json() as ReadinessPayload)
        setAscent(await ar.json() as AscentPayload)
        setPorts(((await pr.json()) as {ports?:DockPort[]}).ports??[])
        setConnection(((await cr.json()) as {connection?:DockConnection|null}).connection??null)
      }else{
        setReadiness(null);setAscent(null);setPorts([]);setConnection(null)
      }
    }catch(error){setMessage(error instanceof Error?error.message:String(error))}
  }

  useEffect(()=>{void load()},[])

  async function action(kind:'provision'|'board'|'stage'|'load'|'unload'){
    setBusy(true);setMessage(null)
    try{
      const headers=await authHeaders()
      const shipId=shuttle?.ship?.id
      const url=kind==='board'?'/api/game/ascent/crew':'/api/game/moon/ascent-shuttle'
      const body=kind==='provision'
        ? {action:'provision'}
        : kind==='board'
          ? {action:'board-self',shipId}
          : kind==='stage'
            ? {action:'stage-surface-port',portInventoryId:shuttle?.surfacePort?.id}
            : {action:'surface-transfer',portInventoryId:shuttle?.surfacePort?.id,resource:cargoResource,amount:cargoAmount,direction:kind==='load'?'port-to-shuttle':'shuttle-to-port'}
      const r=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)})
      const p=await r.json() as {ok?:boolean;error?:string}
      if(!r.ok||!p.ok) throw new Error(p.error??'Aktion fehlgeschlagen')
      setMessage(
        kind==='provision'?'Lunar Ascent Shuttle Mk.I wurde als reales Flight Article angelegt.'
          : kind==='board'?'Du bist als Commander/Pilot an Bord.'
            : kind==='stage'?'Shuttle wurde physisch am Shuttle-Port bereitgestellt.'
              : kind==='load'?'Cargo wurde explizit vom Shuttle-Port ins Shuttle übertragen.'
                :'Cargo wurde explizit zurück ins Shuttle-Port-Lager übertragen.'
      )
      await load()
    }catch(error){setMessage(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }

  async function operation(url:string,body:Record<string,unknown>,success:string){
    setBusy(true);setMessage(null)
    try{
      const h=await authHeaders()
      const r=await fetch(url,{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify(body)})
      const p=await r.json() as {ok?:boolean;error?:string;code?:string}
      if(!r.ok||!p.ok) throw new Error(p.error??p.code??'Aktion fehlgeschlagen')
      setMessage(success);await load()
    }catch(error){setMessage(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }

  const article=shuttle?.article
  const stagedAtPort=Boolean(shuttle?.surfacePort?.id&&shuttle?.vehicle?.current_node_inventory_id===shuttle.surfacePort.id)
  const portItems=shuttle?.surfacePort?.items??[]
  const shipItems=shuttle?.inventory?.items??[]
  const portAvailable=Number(portItems.find(item=>item.resource===cargoResource)?.available??0)
  const shipAvailable=Number(shipItems.find(item=>item.resource===cargoResource)?.available??0)
  const evidence=readiness?.evidence??{}
  const moonA1=ports.find(port=>port.id==='moon-a1')
  const shipId=shuttle?.ship?.id
  const orbitalArrived=Boolean(ascent?.orbitalPresence)
  const reservedByThis=Boolean(shipId&&moonA1?.reservedForVesselId===shipId)
  const occupiedByThis=Boolean(shipId&&(moonA1?.occupiedByVesselId===shipId||connection?.port_id==='moon-a1'))
  const unresolved=[
    article?.actual_start_mass_kg==null?'Startmasse':null,
    article?.crew_cargo_mission_equipment_kg==null?'Crew/Cargo/Equipment-Masse':null,
    article?.usable_ascent_propellant_kg==null?'nutzbarer Aufstiegstreibstoff':null,
    article&&!article.target_plane_resolved?'Zielbahnebene':null,
  ].filter(Boolean)

  return <section className="ascent">
    <header><div><small>MOON ASCENT · ENG-LUNAR-ASCENT-r1</small><h2>Lunar Ascent Shuttle</h2></div><button onClick={()=>void load()} disabled={busy}>Aktualisieren</button></header>
    {!shuttle?<div className="provision"><div><strong>ENG-SCV-0002 noch nicht instanziiert</strong><p>Erzeugt genau ein reales Shuttle samt Ship-Cargo und Flight Article. Unbekannte physische Missionswerte bleiben bewusst unresolved.</p></div><button className="primary" onClick={()=>void action('provision')} disabled={busy}>{busy?'…':'Shuttle provisionieren'}</button></div>:<>
      <div className="grid">
        <div><b>{shuttle.ship?.name}</b><span>{shuttle.ship?.location?.toUpperCase()} · {shuttle.ship?.status}</span></div>
        <div><b>{article?.engineering_frame_id}</b><span>{article?.engineering_authority_ref}</span></div>
        <div><b>{readiness?.assessment?.ready?'STARTBEREIT':'FAIL-CLOSED'}</b><span>100 km LLO · moon-llo-100</span></div>
        <div><b>{readiness?.crew?.boarded?'Crew an Bord':'Crew nicht an Bord'}</b><span>{readiness?.crew?.role??'—'}</span></div>
      </div>
      {!readiness?.crew?.boarded&&<button onClick={()=>void action('board')} disabled={busy}>Als Commander an Bord gehen</button>}
      <div className="handover">
        <div><b>Surface Handover</b><span>{shuttle.surfacePort?.label??'Shuttle-Port-Lager unresolved'} · {stagedAtPort?'Shuttle bereitgestellt':'Shuttle nicht am Port'}</span></div>
        {!stagedAtPort&&shuttle.surfacePort?.id&&<button onClick={()=>void action('stage')} disabled={busy}>Shuttle am Port bereitstellen</button>}
        <select value={cargoResource} onChange={e=>setCargoResource(e.currentTarget.value)}><option value="metal">Metall</option><option value="water">Wasser</option><option value="energy">Energie</option><option value="components">Bauteile</option></select>
        <input type="number" min={1} value={cargoAmount} onChange={e=>setCargoAmount(Math.max(1,Math.floor(Number(e.currentTarget.value)||1)))}/>
        <button onClick={()=>void action('load')} disabled={busy||!stagedAtPort||portAvailable<cargoAmount}>Port → Shuttle ({portAvailable})</button>
        <button onClick={()=>void action('unload')} disabled={busy||!stagedAtPort||shipAvailable<cargoAmount}>Shuttle → Port ({shipAvailable})</button>
      </div>
      <div className="orbital">
        <div><b>Ascent / Lunar Orbital Interface</b><span>{ascent?.mission?.phase??(orbitalArrived?'orbital-arrival':'surface')} · moon-a1: {occupiedByThis?'docked':reservedByThis?'reserved':moonA1?.status??'unresolved'}</span></div>
        {readiness?.assessment?.ready&&!ascent?.mission&&shipId&&<button className="primary" onClick={()=>void operation('/api/game/ascent',{action:'authorize',shipId,departureSurfaceSlug:'moon',targetOrbitNodeSlug:'moon-llo-100'},'Ascent wurde autorisiert.')} disabled={busy}>Ascent autorisieren</button>}
        {ascent?.executionReady&&shipId&&<button className="primary" onClick={()=>void operation('/api/game/ascent',{action:'advance',shipId},'Ascent wurde um eine serverautorisierte Phase fortgesetzt.')} disabled={busy}>Nächste Ascent-Phase</button>}
        {orbitalArrived&&!reservedByThis&&!occupiedByThis&&shipId&&<button onClick={()=>void operation('/api/game/docking',{action:'reserve',shipId,portId:'moon-a1'},'moon-a1 wurde reserviert.')} disabled={busy||moonA1?.status!=='available'}>moon-a1 reservieren</button>}
        {reservedByThis&&!occupiedByThis&&shipId&&<button onClick={()=>void operation('/api/game/docking',{action:'dock',shipId,portId:'moon-a1'},'Shuttle ist physisch an moon-a1 angedockt.')} disabled={busy}>Andocken</button>}
        {occupiedByThis&&connection&&shuttle?.inventory?.id&&shuttle?.orbitalInterface?.id&&<button onClick={()=>void operation('/api/game/logistics/handover',{action:'transfer-connected',connectionId:connection.id,sourceInventoryId:shuttle.inventory!.id,targetInventoryId:shuttle.orbitalInterface!.id,resource:cargoResource,amount:cargoAmount},'Cargo wurde über die aktive Docking-Verbindung ins Lunar Orbital Interface übertragen.')} disabled={busy||shipAvailable<cargoAmount}>Shuttle → Orbital Depot ({shipAvailable})</button>}
      </div>
      <div className="facts">
        <span>Startmasse: {article?.actual_start_mass_kg??'unresolved'} kg</span>
        <span>Crew/Cargo/Equipment: {article?.crew_cargo_mission_equipment_kg??'unresolved'} kg</span>
        <span>Propellant: {article?.usable_ascent_propellant_kg??'unresolved'} kg</span>
        <span>Cargo: {readiness?.cargo?.empty?'leer / 0 kg':'nicht leer'} · Ship {shuttle.inventory?.totalAmount??0} / Port {shuttle.surfacePort?.totalAmount??0}</span>
      </div>
      {unresolved.length>0&&<div className="warning"><b>Physischer Missionszustand fehlt</b><span>{unresolved.join(' · ')}</span><p>Engineering ist freigegeben; NOXIA erfindet diese Werte nicht. Erst ein konkreter Mass-/Propellant-/Plane-Resolver darf den Flight Article auf startbereit setzen.</p></div>}
      <div className="evidence">{Object.entries(evidence).map(([key,value])=><span key={key} data-state={value}>{key}: {value}</span>)}</div>
    </>}
    {message&&<p className="message">{message}</p>}
    <style jsx>{`
      .ascent{max-width:1400px;margin:0 auto 18px;background:#0d161d;border:1px solid #2d3d48;border-radius:16px;padding:16px;color:#e7edf0;font-family:system-ui,sans-serif}
      header,.provision{display:flex;justify-content:space-between;gap:16px;align-items:center}small{color:#c8a75a;font-size:10px;letter-spacing:.15em;font-weight:800}h2{margin:2px 0;font:400 24px Georgia,serif}
      button{border:1px solid #465b66;background:#13222a;color:#dbe5e9;padding:8px 12px;border-radius:8px;cursor:pointer}.primary{background:#5d4d2b;border-color:#8b7340;color:#f4dfaa}button:disabled{opacity:.45}
      .provision{margin-top:12px;padding:12px;background:#151f24;border:1px dashed #45545d;border-radius:10px}.provision p,.warning p{margin:4px 0 0;color:#929fa6;font-size:11px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.grid div,.facts{background:#101e26;border:1px solid #2a3c46;border-radius:9px;padding:9px}.grid b{display:block;font-size:12px}.grid span,.facts span{font-size:10px;color:#93a2aa}
      .facts{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px}.orbital{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:10px 0;padding:10px;background:#121b24;border:1px solid #2d4355;border-radius:9px}.orbital div{display:grid;margin-right:auto}.orbital b{font-size:11px}.orbital span{font-size:10px;color:#93a2aa}.handover{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:10px 0;padding:10px;background:#101e26;border:1px solid #2a3c46;border-radius:9px}.handover div{display:grid;margin-right:auto}.handover b{font-size:11px}.handover span{font-size:10px;color:#93a2aa}.handover select,.handover input{background:#091117;color:#e8edf0;border:1px solid #344852;border-radius:7px;padding:7px}.handover input{width:70px}.warning{margin-top:10px;padding:10px;border:1px solid #665938;background:#221f16;border-radius:9px}.warning span{display:block;color:#d7bd7a;font-size:11px;margin-top:4px}
      .evidence{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.evidence span{font:10px monospace;padding:3px 6px;border:1px solid #40505a;border-radius:12px}.evidence span[data-state="ready"]{color:#83c99a;border-color:#315a4a}.evidence span[data-state="blocked"]{color:#e38b83;border-color:#684247}.message{color:#cbd8de;font-size:11px}
      @media(max-width:800px){.grid{grid-template-columns:1fr 1fr}.provision{align-items:start;flex-direction:column}}
    `}</style>
  </section>
}
