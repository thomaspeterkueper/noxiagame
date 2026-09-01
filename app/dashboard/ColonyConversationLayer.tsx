'use client'

import { useEffect, useMemo, useState } from 'react'
import { awarenessConversationForResident } from '@/lib/game/npcAwarenessConversation'
import { virtualDayProgress } from '@/lib/game/npcDailyRoutine'
import { simulateNpcSpatialState } from '@/lib/game/npcSpatialSimulation'
import { getStreetTiles } from '@/lib/game/streetTiles'
import { sourceForAwarenessItem, type WorldAwarenessItem } from '@/lib/game/worldAwareness'
import { worldDistance } from '@/lib/game/interactions'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { useColonyInteractionStore } from '@/lib/store/colonyInteractionStore'
import { getSessionInfo } from '@/lib/supabase/auth'

type TileEntity = { id:string; entity_id:string; entity_type:string; tile_row:number; tile_col:number; profile_id:string|null }
type ChatEntry = { role:'user'|'assistant'; content:string }
type Props = { locationSlug:string; population:number; entities:TileEntity[]; pending:unknown[]; userId:string; residents:ColonyResident[] }

const COLS=32, ROWS=24, MAX_PLAYER_CHARS=80, PLAYER_JOIN_DISTANCE=1.25

function residentRole(resident:ColonyResident){
  return resident.assignments.find(assignment=>assignment.type==='work')?.roleCode ?? resident.activityState ?? 'general'
}

export default function ColonyConversationLayer({locationSlug,population,entities,pending,userId,residents}:Props){
  const playerPosition=useColonyInteractionStore(state=>state.playerPosition)
  const[items,setItems]=useState<WorldAwarenessItem[]>([])
  const[open,setOpen]=useState(false)
  const[tick,setTick]=useState(0)
  const[joining,setJoining]=useState(false)
  const[message,setMessage]=useState('')
  const[history,setHistory]=useState<ChatEntry[]>([])
  const[sending,setSending]=useState(false)
  const[chatError,setChatError]=useState('')

  useEffect(()=>{
    let live=true
    fetch('/api/game/world-awareness')
      .then(response=>response.ok?response.json():{items:[]})
      .then(data=>{if(live)setItems(Array.isArray(data.items)?data.items:[])})
      .catch(()=>{if(live)setItems([])})
    return()=>{live=false}
  },[locationSlug])

  useEffect(()=>{const timer=setInterval(()=>setTick(value=>value+1),450);return()=>clearInterval(timer)},[])

  const buildings=useMemo(()=>entities.filter(entity=>entity.entity_type==='building'),[entities])
  const streets=useMemo(()=>getStreetTiles(locationSlug,population,entities,pending,userId,COLS,ROWS),[locationSlug,population,entities,pending,userId])
  const dayProgress=virtualDayProgress(tick)
  const positions=useMemo(()=>simulateNpcSpatialState({residents,buildings,streets,dayProgress}),[residents,buildings,streets,dayProgress])

  const scene=useMemo(()=>{
    if(items.length<1)return null
    const candidates=positions.filter(position=>!position.routine.moving&&(position.routine.activity==='meal'||position.routine.activity==='community'))
    let best:{first:typeof candidates[number];second:typeof candidates[number];score:number}|null=null

    for(let i=0;i<candidates.length;i+=1){
      for(let j=i+1;j<candidates.length;j+=1){
        const first=candidates[i],second=candidates[j]
        const pairDistance=worldDistance(first,second)
        if(pairDistance>.65)continue
        const playerDistance=playerPosition?Math.min(worldDistance(first,playerPosition),worldDistance(second,playerPosition)):Infinity
        const score=pairDistance+(first.routine.socialGroup===second.routine.socialGroup?-.25:0)+(playerDistance<=PLAYER_JOIN_DISTANCE?-.2:0)
        if(!best||score<best.score)best={first,second,score}
      }
    }

    if(!best)return null
    const dayKey=new Date().toISOString().slice(0,10)
    const conversation=awarenessConversationForResident(best.first.resident.id,residentRole(best.first.resident),items,dayKey)
    if(!conversation)return null
    const playerDistance=playerPosition?Math.min(worldDistance(best.first,playerPosition),worldDistance(best.second,playerPosition)):Infinity

    return{
      first:best.first.resident,
      second:best.second.resident,
      conversation,
      source:sourceForAwarenessItem(conversation.item),
      sameGroup:best.first.routine.socialGroup===best.second.routine.socialGroup,
      playerNearby:playerDistance<=PLAYER_JOIN_DISTANCE,
    }
  },[positions,items,playerPosition])

  useEffect(()=>{
    if(!scene){setOpen(false);setJoining(false);setHistory([]);return}
    setHistory([]);setJoining(false);setChatError('')
  },[scene?.first.id,scene?.second.id,scene?.conversation.item.id])

  async function sendMessage(){
    if(!scene||!scene.playerNearby||sending)return
    const player=message.trim().slice(0,MAX_PLAYER_CHARS)
    if(!player)return
    setSending(true)
    setChatError('')
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/npc-conversation',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          player,
          npcName:scene.first.displayName,
          npcRole:residentRole(scene.first),
          headline:scene.conversation.item.title,
          source:scene.source?.name??scene.conversation.item.sourceId,
          history,
        }),
      })
      const data=await response.json().catch(()=>({}))
      if(!response.ok||!data.reply)throw new Error(data.error||'conversation_failed')
      setHistory(current=>[...current,{role:'user' as const,content:player},{role:'assistant' as const,content:String(data.reply)}].slice(-6))
      setMessage('')
    }catch(error){
      const code=error instanceof Error?error.message:''
      setChatError(code==='conversation_provider_unavailable'?'DeepSeek ist noch nicht konfiguriert.':code==='unauthorized'?'Sitzung abgelaufen.':'Gespräch derzeit nicht erreichbar.')
    }finally{setSending(false)}
  }

  if(!scene)return null

  return <div style={{position:'absolute',zIndex:118,left:16,bottom:70,width:open?370:285,fontFamily:'system-ui',color:'#e8f0f5'}}>
    <button onClick={()=>setOpen(value=>!value)} style={{width:'100%',textAlign:'left',border:'1px solid #45657c',borderRadius:open?'9px 9px 0 0':9,background:'#091925ee',color:'#e8f0f5',padding:'9px 11px',cursor:'pointer'}}>
      <small style={{color:'#79a6c7',letterSpacing:'.1em'}}>{scene.playerNearby?'GESPRÄCH IN HÖRWEITE · ERDE':'GESPRÄCH IN DER NÄHE · ERDE'}</small><br/>
      <b>{scene.first.displayName} + {scene.second.displayName}</b>
      <div style={{marginTop:2,color:'#8fa3b1',fontSize:9}}>{scene.sameGroup?'gleicher Sozialkreis · ':''}{scene.playerNearby?'du kannst dich einmischen':'räumliche Begegnung'}</div>
    </button>
    {open&&<div style={{border:'1px solid #45657c',borderTop:0,borderRadius:'0 0 9px 9px',background:'#071421f2',padding:11,fontSize:12,lineHeight:1.5}}>
      <p style={{margin:'0 0 8px'}}><b>{scene.first.displayName}:</b> „{scene.conversation.opener}“</p>
      <p style={{margin:'0 0 9px',color:'#c8d5dd'}}><b>{scene.second.displayName}:</b> „{scene.conversation.followUp}“</p>
      {history.map((entry,index)=><p key={`${entry.role}-${index}`} style={{margin:'6px 0',color:entry.role==='assistant'?'#d9e6ec':'#f1d57a'}}><b>{entry.role==='assistant'?scene.first.displayName:'Du'}:</b> „{entry.content}“</p>)}
      {scene.playerNearby&&!joining&&<button onClick={()=>setJoining(true)} style={{width:'100%',margin:'7px 0',padding:'8px 10px',border:'1px solid #3976a5',borderRadius:6,background:'#0a3150',color:'#fff',fontWeight:800,cursor:'pointer'}}>ANSPRECHEN</button>}
      {scene.playerNearby&&joining&&<div style={{marginTop:8}}>
        <div style={{display:'flex',gap:6}}>
          <input value={message} maxLength={MAX_PLAYER_CHARS} onChange={event=>setMessage(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void sendMessage()}} placeholder="Kurze Antwort …" disabled={sending} style={{flex:1,minWidth:0,padding:'8px 9px',border:'1px solid #45657c',borderRadius:6,background:'#06111a',color:'#eef5f8'}}/>
          <button onClick={()=>void sendMessage()} disabled={sending||!message.trim()} style={{border:'1px solid #3976a5',borderRadius:6,background:'#0a3150',color:'#fff',padding:'0 10px',cursor:sending?'wait':'pointer'}}>{sending?'…':'Senden'}</button>
        </div>
        <div style={{marginTop:3,textAlign:'right',color:message.length>=70?'#f1d57a':'#738795',fontSize:9}}>{message.length}/{MAX_PLAYER_CHARS}</div>
        {chatError&&<div style={{marginTop:5,color:'#e29a86',fontSize:10}}>{chatError}</div>}
      </div>}
      <div style={{marginTop:8,color:'#8fa3b1',fontSize:10}}>Reale Meldung: {scene.source?.name??scene.conversation.item.sourceId}. Die Reaktionen der Bewohner sind fiktional.</div>
      <a href={scene.conversation.item.url} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:7,color:'#f1d57a',fontSize:10}}>Originalquelle öffnen ↗</a>
    </div>}
  </div>
}
