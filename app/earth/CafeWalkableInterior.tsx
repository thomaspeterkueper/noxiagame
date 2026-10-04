'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { NpcFigure, NpcVisualStyles } from '@/lib/grid/NpcVisual'
import type { ColonyResident } from '@/lib/store/colonyStateStore'

type Props = {
  entityId: string
  buildingName: string
  onClose: () => void
}

type Point = { x:number; y:number }
type Furniture = { id:string; kind:'table'|'counter'|'chair'; x:number; y:number; w:number; h:number }

const W=760,H=470
const START={x:90,y:390}
const SPEED=12
const PLAYER_R=10

const furniture:Furniture[]=[
  {id:'counter',kind:'counter',x:525,y:70,w:175,h:58},
  {id:'table-1',kind:'table',x:210,y:135,w:72,h:48},
  {id:'table-2',kind:'table',x:365,y:145,w:72,h:48},
  {id:'table-3',kind:'table',x:250,y:275,w:72,h:48},
  {id:'table-4',kind:'table',x:410,y:285,w:72,h:48},
  {id:'chair-1',kind:'chair',x:193,y:115,w:18,h:18},
  {id:'chair-2',kind:'chair',x:280,y:160,w:18,h:18},
  {id:'chair-3',kind:'chair',x:348,y:124,w:18,h:18},
  {id:'chair-4',kind:'chair',x:438,y:170,w:18,h:18},
  {id:'chair-5',kind:'chair',x:230,y:250,w:18,h:18},
  {id:'chair-6',kind:'chair',x:330,y:300,w:18,h:18},
  {id:'chair-7',kind:'chair',x:390,y:260,w:18,h:18},
  {id:'chair-8',kind:'chair',x:490,y:305,w:18,h:18},
]

function blocked(p:Point){
  if(p.x<35||p.x>W-35||p.y<42||p.y>H-34)return true
  return furniture.some(item=>p.x+PLAYER_R>item.x&&p.x-PLAYER_R<item.x+item.w&&p.y+PLAYER_R>item.y&&p.y-PLAYER_R<item.y+item.h)
}

export default function CafeWalkableInterior({entityId,buildingName,onClose}:Props){
  const[pos,setPos]=useState<Point>(START)
  const[residents,setResidents]=useState<ColonyResident[]>([])
  const[selected,setSelected]=useState<ColonyResident|null>(null)
  const[message,setMessage]=useState('')
  const[history,setHistory]=useState<Array<{role:'user'|'assistant';content:string}>>([])
  const[sending,setSending]=useState(false)
  const[status,setStatus]=useState('')

  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const{token}=await getSessionInfo()
        const response=await fetch('/api/game/population?tileEntityId='+encodeURIComponent(entityId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const data=await response.json()
        if(live&&response.ok)setResidents(Array.isArray(data.residents)?data.residents:[])
      }catch{if(live)setResidents([])}
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
        return blocked(next)?current:next
      })
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[onClose])

  const npcPositions=useMemo(()=>residents.slice(0,10).map((resident,index)=>({
    resident,
    x:160+(index%4)*125,
    y:110+Math.floor(index/4)*145,
  })),[residents])

  const nearestNpc=useMemo(()=>npcPositions.map(item=>({...item,d:Math.hypot(item.x-pos.x,item.y-pos.y)})).sort((a,b)=>a.d-b.d)[0]??null,[npcPositions,pos])
  const nearCounter=Math.hypot(pos.x-610,pos.y-145)<72
  const nearExit=Math.hypot(pos.x-90,pos.y-410)<48

  async function talk(){
    if(!selected||!message.trim()||sending)return
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
          headline:'Gespräch im '+buildingName,
          source:'NOXIA café interior',
          locationName:buildingName,
          localFacts:[
            'Ihr befindet euch im Café '+buildingName,
            'Im Innenraum gibt es einen Gastraum, mehrere Tische und einen Tresen',
            'Der Ausgang liegt beim Eingang des Cafés',
          ],
          history,
        }),
      })
      const data=await response.json().catch(()=>({}))
      const reply=response.ok&&data.reply?String(data.reply):'Die Person antwortet gerade nicht.'
      setHistory(current=>[...current,{role:'user',content:text},{role:'assistant',content:reply}].slice(-10))
      setMessage('')
    }finally{setSending(false)}
  }

  return <div className="cafe-interior">
    <NpcVisualStyles/>
    <header><div><small>INNENRAUM · CAFÉ</small><b>{buildingName}</b><span>WASD bewegen · NPC anklicken · ESC verlassen</span></div><button onClick={onClose}>← Verlassen</button></header>
    <main>
      <div className="room">
        <div className="window w1"/><div className="window w2"/>
        <div className="door"><span>AUSGANG</span></div>
        {furniture.map(item=><div key={item.id} className={'f '+item.kind} style={{left:item.x,top:item.y,width:item.w,height:item.h}}/>)}
        <div className="counter-label">TRESEN</div>
        {npcPositions.map(item=><div key={item.resident.id} className="npc" style={{left:item.x-12,top:item.y-34}}>
          <NpcFigure id={item.resident.id} name={item.resident.displayName} role={item.resident.activityState} appearance={item.resident.appearance} showLabel={selected?.id===item.resident.id||Math.hypot(item.x-pos.x,item.y-pos.y)<70} showRoleLabel={item.resident.identityState==='known'} selected={selected?.id===item.resident.id} onClick={()=>{setSelected(item.resident);setHistory([])}}/>
        </div>)}
        <div className="player" style={{left:pos.x-10,top:pos.y-24}}><i/><span>Du</span></div>
        {nearCounter&&<button className="context" style={{left:535,top:142}} onClick={()=>setStatus('Du wartest am Tresen. Bestellungen werden als nächster Hospitality-Schritt an die Ökonomie angebunden.')}>AM TRESEN</button>}
        {nearExit&&<button className="context exit" style={{left:42,top:420}} onClick={onClose}>CAFÉ VERLASSEN</button>}
      </div>
      <aside>
        <small>CAFÉ · LOKAL</small>
        <h3>{selected?.displayName??'Gastraum'}</h3>
        {!selected&&<p>Du kannst dich frei zwischen Eingang, Tischen und Tresen bewegen. Personen im Raum sind echte Bewohner dieses Gebäude-Kontexts, sofern dafür Präsenzdaten vorliegen.</p>}
        {selected&&<>
          <div className="history">{history.map((entry,index)=><p key={index}><b>{entry.role==='user'?'Du':selected.displayName}:</b> „{entry.content}“</p>)}</div>
          <div className="chat"><input value={message} maxLength={80} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void talk()}} placeholder="Kurze Antwort …"/><button disabled={sending||!message.trim()} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div>
        </>}
        {status&&<div className="status">{status}</div>}
        {nearestNpc&&<div className="near">Nächste Person: {nearestNpc.resident.displayName} · {Math.round(nearestNpc.d)} px</div>}
      </aside>
    </main>
    <style jsx>{`
      .cafe-interior{position:fixed;inset:44px 0 0;z-index:2600;background:#0d1718;color:#eef2ed;font-family:system-ui}.cafe-interior header{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#10272a;border-bottom:1px solid #476263}.cafe-interior header small,.cafe-interior header b,.cafe-interior header span{display:block}.cafe-interior header small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}.cafe-interior header b{margin-top:2px}.cafe-interior header span{font-size:9px;color:#91a7a7}.cafe-interior header button{border:1px solid #5a7472;background:#17383a;color:#eef2ed;border-radius:6px;padding:7px 10px;cursor:pointer}.cafe-interior main{display:grid;grid-template-columns:minmax(0,1fr) 320px;height:calc(100% - 54px)}.room{position:relative;width:min(100%,760px);height:470px;margin:28px auto;background:linear-gradient(#d4c59f 0 18%,#b88d5f 18% 20%,#d9c9a7 20% 100%);border:12px solid #5c4431;box-shadow:0 18px 50px #0008;overflow:hidden}.room:after{content:'';position:absolute;inset:20% 0 0;background-image:linear-gradient(#8f775f22 1px,transparent 1px),linear-gradient(90deg,#8f775f22 1px,transparent 1px);background-size:32px 32px;pointer-events:none}.window{position:absolute;top:24px;width:100px;height:44px;background:#87b8c8;border:8px solid #684c35}.w1{left:155px}.w2{left:330px}.door{position:absolute;left:45px;bottom:0;width:86px;height:55px;background:#3d2e25;border:5px solid #6a4d37;color:#e4d4aa;font:700 8px monospace;display:grid;place-items:center}.f{position:absolute;z-index:2}.table{background:#704c30;border:4px solid #4e3525;border-radius:50%}.chair{background:#5c4230;border:2px solid #412e22;border-radius:4px}.counter{background:#67432b;border:5px solid #40291e;border-radius:5px}.counter-label{position:absolute;right:60px;top:84px;z-index:3;color:#ead3a4;font:800 9px monospace}.npc{position:absolute;z-index:8}.player{position:absolute;z-index:10;width:20px;height:28px}.player i{display:block;width:14px;height:22px;margin:auto;background:#d7ad3c;border:2px solid #5c481c;border-radius:8px 8px 4px 4px}.player span{position:absolute;top:-15px;left:50%;transform:translateX(-50%);background:#13262b;border:1px solid #d7ad3c;border-radius:4px;padding:1px 4px;font:700 8px monospace}.context{position:absolute;z-index:20;border:1px solid #d0b66a;background:#153438;color:#f4e8c4;border-radius:5px;padding:5px 7px;font:800 8px monospace;cursor:pointer}.context.exit{background:#3a2b24}.cafe-interior aside{padding:16px;background:#091719;border-left:1px solid #40595a;overflow:auto}.cafe-interior aside small{color:#d9bb6a;font:800 8px monospace;letter-spacing:.12em}.cafe-interior aside h3{margin:4px 0 10px}.cafe-interior aside p{font-size:11px;line-height:1.45;color:#cbd6d2}.history p{border-top:1px solid #2d4445;padding-top:7px}.chat{display:flex;gap:6px;margin-top:10px}.chat input{flex:1;min-width:0;background:#061012;color:#eef;border:1px solid #40595a;border-radius:5px;padding:7px}.chat button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:0 9px}.status,.near{margin-top:10px;padding:8px;border:1px solid #485f5d;border-radius:6px;background:#102526;font-size:10px;color:#b9cbc6}.near{color:#92aaa5}@media(max-width:900px){.cafe-interior main{grid-template-columns:1fr}.cafe-interior aside{position:absolute;right:10px;bottom:10px;width:min(320px,80vw);max-height:40vh;border:1px solid #40595a;border-radius:8px}}
    `}</style>
  </div>
}
