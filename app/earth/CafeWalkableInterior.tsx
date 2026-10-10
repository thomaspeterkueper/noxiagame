'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { NpcFigure, NpcVisualStyles } from '@/lib/grid/NpcVisual'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { SOCIAL_INFRASTRUCTURE } from '@/lib/game/settlements/tiers'
import {
  VENUE_PLAYER_RADIUS,
  isVenueBlocked,
  placeVenueFigures,
  venueConversationFacts,
  venueLayoutForBuildingType,
  venueService,
  type VenueFigure,
} from '@/lib/game/hospitality/venues'

// Begehbarer Innenraum für Café, Bar und Restaurant. Aufbau, Plätze und
// Gesprächswissen kommen aus lib/game/hospitality/venues.ts; diese Datei
// zeichnet nur und führt das Gespräch über /api/game/npc-conversation.
type Props = {
  entityId: string
  /** Gebäudetyp (cafe, bar, restaurant). Unbekannt oder leer: Café. */
  buildingTypeId?: string
  buildingName: string
  companion?: ColonyResident | null
  onClose: () => void
}

type Point = { x:number; y:number }
type ShownFigure = { figure:VenueFigure; resident:ColonyResident }

const SPEED=12

type MenuItem = { itemCode:string; label:string; priceCredits:number; affordable:boolean }
type Menu = { credits:number; items:MenuItem[] }

export default function CafeWalkableInterior({entityId,buildingTypeId,buildingName,companion=null,onClose}:Props){
  const layout=useMemo(()=>venueLayoutForBuildingType(buildingTypeId),[buildingTypeId])
  const arrivalPoint=SOCIAL_INFRASTRUCTURE[layout.kind]?.arrivalPoint===true
  const[pos,setPos]=useState<Point>(layout.start)
  const[residents,setResidents]=useState<ColonyResident[]>([])
  const[selected,setSelected]=useState<ColonyResident|null>(null)
  const[message,setMessage]=useState('')
  const[history,setHistory]=useState<Array<{role:'user'|'assistant';content:string}>>([])
  const[sending,setSending]=useState(false)
  const[status,setStatus]=useState('')
  const[loaded,setLoaded]=useState(false)
  const[menu,setMenu]=useState<Menu|null>(null)
  const[menuOpen,setMenuOpen]=useState(false)
  const[ordering,setOrdering]=useState<string|null>(null)
  const[orders,setOrders]=useState<string[]>([])
  // Eine Kennung je Bestellversuch. Bleibt bei einem Netzfehler stehen, damit
  // die Wiederholung dieselbe Bestellung ist und nicht doppelt gebucht wird.
  const pendingRequest=useRef<{itemCode:string;requestId:string}|null>(null)

  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const{token}=await getSessionInfo()
        const response=await fetch('/api/game/population?tileEntityId='+encodeURIComponent(entityId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const data=await response.json()
        if(live&&response.ok){
          const loaded=Array.isArray(data.residents)?data.residents:[]
          setResidents(companion&&!loaded.some((item:ColonyResident)=>item.id===companion.id)?[companion,...loaded]:loaded)
        }
      }catch{if(live)setResidents([])}
      if(live)setLoaded(true)
    })()
    return()=>{live=false}
  },[entityId,companion?.id])

  // Karte laden. Sie sagt je Posten, ob der Gast ihn bezahlen kann.
  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const{token}=await getSessionInfo()
        const response=await fetch('/api/game/hospitality/order?tileEntityId='+encodeURIComponent(entityId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const data=await response.json()
        if(live&&response.ok&&Array.isArray(data.items))setMenu({credits:Number(data.credits??0),items:data.items})
      }catch{/* ohne Karte bleibt das Lokal ohne Ausschank */}
    })()
    return()=>{live=false}
  },[entityId])

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return
      const k=event.key.toLowerCase()
      if(k==='escape'){onClose();return}
      if(!['w','a','s','d'].includes(k))return
      event.preventDefault()
      setPos(current=>{
        const next={
          x:current.x+(k==='d'?SPEED:k==='a'?-SPEED:0),
          y:current.y+(k==='s'?SPEED:k==='w'?-SPEED:0),
        }
        return isVenueBlocked(layout,next,VENUE_PLAYER_RADIUS)?current:next
      })
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[onClose,layout])

  // Wer wo steht: Personal an Tresen/Empfang, Begleitung beim Eingang, Gäste
  // an freien Plätzen. Wer in einem nicht einsehbaren Raum ist, wird nicht gezeigt.
  const figures=useMemo(()=>{
    return placeVenueFigures(layout,residents.map(r=>({
      id:r.id,
      worksHere:r.assignments.some(a=>a.type==='work'&&a.tileEntityId===entityId),
      isCompanion:Boolean(companion&&r.id===companion.id),
      presenceRoomId:r.interiorPresence?.roomId??null,
    })))
  },[layout,residents,entityId,companion?.id])
  // Ohne Personal: Café läuft als Automatencafé, Bar und Restaurant sind zu.
  const service=venueService(layout,figures)
  const closed=loaded&&service==='closed'
  const hasMenu=Boolean(menu?.items.length)&&service!=='closed'
  const shown=useMemo<ShownFigure[]>(()=>{
    const byId=new Map(residents.map(r=>[r.id,r]))
    if(service==='closed')return[]
    return figures.filter(f=>f.visibleToPlayer).flatMap(figure=>{
      const resident=byId.get(figure.id)
      return resident?[{figure,resident}]:[]
    })
  },[figures,residents,service])

  const nearestNpc=useMemo(()=>shown.map(item=>({...item,d:Math.hypot(item.figure.spot.x-pos.x,item.figure.spot.y-pos.y)})).sort((a,b)=>a.d-b.d)[0]??null,[shown,pos])
  const nearService=Math.hypot(pos.x-layout.servicePoint.x,pos.y-layout.servicePoint.y)<60
  const nearExit=Math.hypot(pos.x-layout.exit.x,pos.y-layout.exit.y)<48
  const counter=layout.furniture.find(item=>item.kind==='counter')
  const kitchen=layout.furniture.find(item=>item.kind==='kitchen')
  const desk=layout.furniture.find(item=>item.kind==='desk')

  async function order(item:MenuItem){
    if(ordering||!item.affordable||closed)return
    const pending=pendingRequest.current?.itemCode===item.itemCode?pendingRequest.current:{itemCode:item.itemCode,requestId:crypto.randomUUID()}
    pendingRequest.current=pending
    setOrdering(item.itemCode)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/hospitality/order',{
        method:'POST',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({tileEntityId:entityId,itemCode:item.itemCode,requestId:pending.requestId}),
      })
      const data=await response.json().catch(()=>({}))
      // Eine Antwort des Servers ist endgültig – ob gebucht oder abgelehnt.
      if(response.status<500)pendingRequest.current=null
      if(response.ok&&data.ok){
        const credits=Number(data.credits??0)
        setMenu(current=>current?{credits,items:current.items.map(entry=>({...entry,affordable:credits>=entry.priceCredits}))}:current)
        if(!data.duplicate)setOrders(current=>[...current,item.label].slice(-6))
        setStatus(item.label+' bestellt – '+item.priceCredits+' Credits bezahlt. Du hast noch '+credits+' Credits.')
      }else{
        setStatus(String(data.error??'Die Bestellung konnte nicht gebucht werden. Es wurde nichts abgebucht.'))
        if(data.code==='NOXIA_CREDITS_INSUFFICIENT')setMenu(current=>current?{...current,items:current.items.map(entry=>entry.itemCode===item.itemCode?{...entry,affordable:false}:entry)}:current)
      }
    }catch{
      setStatus('Keine Verbindung. Ob gebucht wurde, ist offen – noch einmal bestellen bucht nicht doppelt.')
    }finally{setOrdering(null)}
  }

  async function talk(){
    if(!selected||!message.trim()||sending)return
    // Die Figur bekommt nur mit, was sie von ihrem Platz aus wissen kann.
    const self=figures.find(f=>f.id===selected.id)
    if(!self)return
    const text=message.trim().slice(0,80)
    setSending(true)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/npc-conversation',{
        method:'POST',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({
          player:text,
          npcId:selected.id,
          npcName:selected.displayName,
          npcRole:selected.assignments.find(a=>a.type==='work')?.roleCode??selected.activityState,
          headline:'Gespräch '+layout.locative+' '+buildingName,
          source:'NOXIA '+layout.kind+' interior',
          locationName:buildingName,
          localFacts:venueConversationFacts({layout,buildingName,self,figures,playerPos:pos,arrivalPoint,menu:hasMenu?menu?.items:[],playerOrders:orders}),
          history,
        }),
      })
      const data=await response.json().catch(()=>({}))
      const reply=response.ok&&data.reply?String(data.reply):'Die Person antwortet gerade nicht.'
      setHistory(current=>[...current,{role:'user' as const,content:text},{role:'assistant' as const,content:reply}].slice(-10))
      setMessage('')
    }finally{setSending(false)}
  }

  return <div className="cafe-interior">
    <NpcVisualStyles/>
    <header><div><small>INNENRAUM · {layout.noun.toUpperCase()}</small><b>{buildingName}</b><span>WASD bewegen · NPC anklicken · ESC verlassen</span></div><button onClick={onClose}>← Verlassen</button></header>
    <main>
      <div className={'room '+layout.kind}>
        {layout.windows.map((win,index)=><div key={index} className="window" style={{left:win.x,width:win.w}}/>)}
        <div className="door"><span>AUSGANG</span></div>
        {layout.furniture.map(item=><div key={item.id} className={'f '+item.kind} style={{left:item.x,top:item.y,width:item.w,height:item.h}}/>)}
        {counter&&<div className="label" style={{left:counter.x+counter.w/2,top:counter.y+counter.h/2}}>{loaded&&service==='self-service'?'AUTOMAT':'TRESEN'}</div>}
        {kitchen&&<div className="label" style={{left:kitchen.x+kitchen.w/2,top:kitchen.y+kitchen.h/2}}>KÜCHE</div>}
        {desk&&<div className="label" style={{left:desk.x+desk.w/2,top:desk.y+desk.h/2}}>EMPFANG</div>}
        {shown.map(({figure,resident})=>{
          const near=Math.hypot(figure.spot.x-pos.x,figure.spot.y-pos.y)<70
          return <div key={resident.id} className="npc" style={{left:figure.spot.x-12,top:figure.spot.y-34}}>
            <NpcFigure id={resident.id} name={resident.displayName} role={resident.activityState} appearance={resident.appearance} showLabel={selected?.id===resident.id||near} showRoleLabel={resident.identityState==='known'} selected={selected?.id===resident.id} onClick={()=>{setSelected(resident);setHistory([])}}/>
          </div>
        })}
        {closed&&<div className="closed"><b>GESCHLOSSEN</b><span>Hier arbeitet gerade niemand.</span></div>}
        <div className="player" style={{left:pos.x-10,top:pos.y-24}}><i/><span>Du</span></div>
        {nearService&&!closed&&<button className="context" style={{left:layout.servicePoint.x-34,top:layout.servicePoint.y+14}} onClick={()=>{setMenuOpen(true);setSelected(null);if(!hasMenu)setStatus('Hier gibt es noch keine Karte.')}}>{service==='self-service'?'AM AUTOMATEN':layout.servicePoint.label}</button>}
        {(nearExit||closed)&&<button className="context exit" style={{left:42,top:420}} onClick={onClose}>{layout.noun.toUpperCase()} VERLASSEN</button>}
      </div>
      <aside>
        <small>{layout.noun.toUpperCase()} · LOKAL</small>
        <h3>{selected?.displayName??(menuOpen&&hasMenu?'Karte':'Gastraum')}</h3>
        {!selected&&closed&&<p>Dieses Lokal ist geschlossen: Hier arbeitet gerade niemand. Ohne Personal gibt es weder Ausschank noch Gäste.</p>}
        {!selected&&!closed&&!(menuOpen&&hasMenu)&&<p>Du kannst dich frei im Raum bewegen. Personen im Raum wissen nur, was sie von ihrem Platz aus sehen und was du ihnen erzählst.{loaded&&service==='self-service'?' Hier bedient kein Personal – bestellt wird am Automaten.':''}</p>}
        {!selected&&menuOpen&&hasMenu&&menu&&<div className="menu">
          <p>Du hast {menu.credits} Credits.</p>
          {menu.items.map(item=><button key={item.itemCode} disabled={!item.affordable||!nearService||ordering!==null} onClick={()=>void order(item)}>
            <span>{item.label}</span><b>{item.priceCredits} Cr</b>
            {!item.affordable&&<small>Dafür reichen deine Credits nicht.</small>}
          </button>)}
          {!nearService&&<p>Zum Bestellen musst du {service==='self-service'?'am Automaten':layout.servicePoint.locative} stehen.</p>}
        </div>}
        {selected&&<>
          <div className="history">{history.map((entry,index)=><p key={index}><b>{entry.role==='user'?'Du':selected.displayName}:</b> „{entry.content}“</p>)}</div>
          <div className="chat"><input value={message} maxLength={80} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void talk()}} placeholder="Kurze Antwort …"/><button disabled={sending||!message.trim()} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div>
        </>}
        {status&&<div className="status">{status}</div>}
        {nearestNpc&&<div className="near">Nächste Person: {nearestNpc.resident.displayName} · {nearestNpc.figure.spot.label}</div>}
      </aside>
    </main>
    <style jsx>{`
      .cafe-interior{position:fixed;inset:44px 0 0;z-index:2600;background:#0d1718;color:#eef2ed;font-family:system-ui}.cafe-interior header{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#10272a;border-bottom:1px solid #476263}.cafe-interior header small,.cafe-interior header b,.cafe-interior header span{display:block}.cafe-interior header small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}.cafe-interior header b{margin-top:2px}.cafe-interior header span{font-size:9px;color:#91a7a7}.cafe-interior header button{border:1px solid #5a7472;background:#17383a;color:#eef2ed;border-radius:6px;padding:7px 10px;cursor:pointer}.cafe-interior main{display:grid;grid-template-columns:minmax(0,1fr) 320px;height:calc(100% - 54px)}.room{position:relative;width:min(100%,760px);height:470px;margin:28px auto;background:linear-gradient(var(--wall) 0 18%,var(--rail) 18% 20%,var(--floor) 20% 100%);border:12px solid #5c4431;box-shadow:0 18px 50px #0008;overflow:hidden}.room.cafe{--wall:#d4c59f;--rail:#b88d5f;--floor:#d9c9a7}.room.bar{--wall:#4a3a44;--rail:#2e222b;--floor:#6b5560}.room.restaurant{--wall:#c9b8a8;--rail:#8a5a48;--floor:#e2d6c6}.room:after{content:'';position:absolute;inset:20% 0 0;background-image:linear-gradient(#8f775f22 1px,transparent 1px),linear-gradient(90deg,#8f775f22 1px,transparent 1px);background-size:32px 32px;pointer-events:none}.window{position:absolute;top:24px;height:44px;background:#87b8c8;border:8px solid #684c35}.room.bar .window{background:#3b5870}.door{position:absolute;left:45px;bottom:0;width:86px;height:55px;background:#3d2e25;border:5px solid #6a4d37;color:#e4d4aa;font:700 8px monospace;display:grid;place-items:center}.f{position:absolute;z-index:2}.table{background:#704c30;border:4px solid #4e3525;border-radius:50%}.high-table{background:#3a2a22;border:4px solid #c9a35a;border-radius:50%}.chair{background:#5c4230;border:2px solid #412e22;border-radius:4px}.stool{background:#8a3b34;border:2px solid #3d1b18;border-radius:50%}.counter{background:#67432b;border:5px solid #40291e;border-radius:5px}.shelf{background:#3f2a1e;border:2px solid #c9a35a55;border-radius:2px}.desk{background:#67432b;border:4px solid #40291e;border-radius:4px}.wall{background:#5c4431}.pass{background:#d8c9a8;border:3px solid #40291e;z-index:3}.kitchen{background:repeating-linear-gradient(45deg,#9aa3a3 0 8px,#8b9494 8px 16px);z-index:1}.closed{position:absolute;inset:0;z-index:15;background:#0b1214cc;display:grid;place-content:center;justify-items:center;gap:6px;color:#ead3a4}.closed b{font:800 20px monospace;letter-spacing:.2em}.closed span{font-size:11px;color:#b9cbc6}.menu button{display:grid;grid-template-columns:1fr auto;gap:2px 10px;width:100%;margin-top:6px;padding:8px 10px;text-align:left;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;cursor:pointer;font-size:12px}.menu button b{color:#f1d57a}.menu button small{grid-column:1/-1;color:#d9a48a;font-size:10px}.menu button:disabled{cursor:not-allowed;background:#102526;border-color:#2d4445;color:#7f9591}.menu button:disabled b{color:#7f9591}.label{position:absolute;z-index:3;transform:translate(-50%,-50%);color:#ead3a4;font:800 8px monospace;letter-spacing:.08em;pointer-events:none;text-shadow:0 1px 2px #000a}.npc{position:absolute;z-index:8}.player{position:absolute;z-index:10;width:20px;height:28px}.player i{display:block;width:14px;height:22px;margin:auto;background:#d7ad3c;border:2px solid #5c481c;border-radius:8px 8px 4px 4px}.player span{position:absolute;top:-15px;left:50%;transform:translateX(-50%);background:#13262b;border:1px solid #d7ad3c;border-radius:4px;padding:1px 4px;font:700 8px monospace}.context{position:absolute;z-index:20;border:1px solid #d0b66a;background:#153438;color:#f4e8c4;border-radius:5px;padding:5px 7px;font:800 8px monospace;cursor:pointer}.context.exit{background:#3a2b24}.cafe-interior aside{padding:16px;background:#091719;border-left:1px solid #40595a;overflow:auto}.cafe-interior aside small{color:#d9bb6a;font:800 8px monospace;letter-spacing:.12em}.cafe-interior aside h3{margin:4px 0 10px}.cafe-interior aside p{font-size:11px;line-height:1.45;color:#cbd6d2}.history p{border-top:1px solid #2d4445;padding-top:7px}.chat{display:flex;gap:6px;margin-top:10px}.chat input{flex:1;min-width:0;background:#061012;color:#eef;border:1px solid #40595a;border-radius:5px;padding:7px}.chat button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:0 9px}.status,.near{margin-top:10px;padding:8px;border:1px solid #485f5d;border-radius:6px;background:#102526;font-size:10px;color:#b9cbc6}.near{color:#92aaa5}@media(max-width:900px){.cafe-interior main{grid-template-columns:1fr}.cafe-interior aside{position:absolute;right:10px;bottom:10px;width:min(320px,80vw);max-height:40vh;border:1px solid #40595a;border-radius:8px}}
    `}</style>
  </div>
}
