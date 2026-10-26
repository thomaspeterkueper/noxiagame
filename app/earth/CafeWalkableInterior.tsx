'use client'

// app/earth/CafeWalkableInterior.tsx
// Aktualisiert: 26.10.2026 — Porträt der angeklickten Person oben in der Seitenleiste (NpcPortrait wie in der Koloniesicht); Rolle nur bei bekannter Person
// Version:      1.1.0

import HospitalityItemIcon from './HospitalityItemIcon'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import { venueIntroduction } from '@/lib/game/hospitality/introductions'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { NpcFigure, NpcVisualStyles } from '@/lib/grid/NpcVisual'
import { PersonPortrait } from '@/lib/grid/PersonPortrait'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { useGameStore } from '@/lib/store/gameStore'
import { SOCIAL_INFRASTRUCTURE } from '@/lib/game/settlements/tiers'
import {
  VENUE_PLAYER_RADIUS,
  isVenueBlocked,
  guestMoment,
  isAtServicePoint,
  placeVenueFigures,
  venueConversationFacts,
  venueLayoutForBuildingType,
  hasUpperFloor,
  venueClosedReason,
  venueHoursText,
  venueHoursFor,
  clockLabel,
  venueService,
  venuePath,
  freeSeats,
  nearestFreeSeat,
  seatForGuest,
  tableServicePhase,
  tableServiceSpot,
  type VenueSpot,
  type VenueRooms,
  ROOM_ITEM_CODE,
  canBookRoom,
  roomsFree,
  withUpperFloor,
  venueSizeForArea,
  venueLayoutForSize,
  type VenueUpperFloor,
  type GuestMoment,
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
type ShownFigure = { figure:VenueFigure; resident:ColonyResident; moment:GuestMoment|null }
// Ein echter Kauf eines Bewohners in diesem Lokal; alter Stand zum Zeitpunkt des Abrufs.
type Visit = { resident:ColonyResident; ageSeconds:number; fetchedAt:number; label:string }

const SPEED=12
// Dekor je Lokalart – nur Bild, keine Kollision, keine Plätze.
const DECOR:Record<string,{plants:Array<[number,number]>;rug:{x:number;y:number;w:number;h:number}|null}>={
  cafe:{plants:[[130,112],[700,400],[470,410]],rug:{x:150,y:125,w:300,h:235}},
  bar:{plants:[[130,112],[470,420]],rug:{x:170,y:110,w:250,h:220}},
  restaurant:{plants:[[130,112],[540,400]],rug:null},
  hotel:{plants:[[130,112],[700,400],[330,112]],rug:{x:150,y:280,w:300,h:110}},
}
// Sekunden, bis am Tisch Bestelltes gebracht wird.
const BRING_S=9

type MenuItem = { itemCode:string; label:string; priceCredits:number; affordable:boolean }
type Menu = { credits:number; items:MenuItem[] }
// Eine Bestellung dieses Besuchs. forId: wem sie ausgegeben wurde (null = für sich selbst).
// at: Zeitpunkt der Bestellung; tableService: am Tisch bestellt, das Personal bringt es.
type PlacedOrder = { key:string; itemCode:string; label:string; forId:string|null; at:number; tableService:boolean }

export default function CafeWalkableInterior({entityId,buildingTypeId,buildingName,companion=null,onClose}:Props){
  // Zustand des Lokals: Koloniestunde, Obergeschoss, was das Personal mitbekommen hat.
  const[hour,setHour]=useState<number|null>(null)
  const[upper,setUpper]=useState<VenueUpperFloor|null>(null)
  const[heard,setHeard]=useState<string[]>([])
  const[rooms,setRooms]=useState<VenueRooms|null>(null)
  const[areaM2,setAreaM2]=useState<number|null>(null)
  const layout=useMemo(()=>{const base=venueLayoutForSize(venueLayoutForBuildingType(buildingTypeId),venueSizeForArea(areaM2));return hasUpperFloor(upper)?withUpperFloor(base):base},[buildingTypeId,upper,areaM2])
  const arrivalPoint=SOCIAL_INFRASTRUCTURE[layout.kind]?.arrivalPoint===true
  const[pos,setPos]=useState<Point>(layout.start)
  const[residents,setResidents]=useState<ColonyResident[]>([])
  const[selected,setSelected]=useState<ColonyResident|null>(null)
  const[message,setMessage]=useState('')
  const[historyState,setHistory]=useState<Array<{role:'user'|'assistant';content:string}>>([])
  const[sending,setSending]=useState(false)
  const[status,setStatus]=useState('')
  const[loaded,setLoaded]=useState(false)
  const[menu,setMenu]=useState<Menu|null>(null)
  const[menuOpen,setMenuOpen]=useState(false)
  const[menuState,setMenuState]=useState<'loading'|'ready'|'failed'>('loading')
  const[placeKnowledge,setPlaceKnowledge]=useState<string[]>([])
  const[visits,setVisits]=useState<Visit[]>([])
  const[nowMs,setNowMs]=useState(()=>Date.now())
  const[ordering,setOrdering]=useState<string|null>(null)
  const[orders,setOrders]=useState<PlacedOrder[]>([])
  // Für wen bestellt wird: für sich selbst oder für die angesprochene Person.
  const[treat,setTreat]=useState(false)
  // Eine Kennung je Bestellversuch. Bleibt bei einem Netzfehler stehen, damit
  // die Wiederholung dieselbe Bestellung ist und nicht doppelt gebucht wird.
  // Sitzt der Spieler? Dann sein Platz und seit wann.
  const[seat,setSeat]=useState<VenueSpot|null>(null)
  const[satAt,setSatAt]=useState(0)
  // Laufender Weg (Klick auf Platz oder „Zum Tresen“); WASD bricht ihn ab.
  const walk=useRef<ReturnType<typeof setInterval>|null>(null)
  const posRef=useRef<Point>(layout.start)
  const greeted=useRef(false)
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

  // Ortswissen laden: was Ansässige über die Gegend wissen (reale Geographie
  // und NOXIA-Einrichtungen am Ort). Ohne Antwort wissen sie eben nichts.
  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const{token}=await getSessionInfo()
        const response=await fetch('/api/game/hospitality/place?tileEntityId='+encodeURIComponent(entityId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const data=await response.json()
        if(live&&response.ok&&Array.isArray(data.facts))setPlaceKnowledge(data.facts.map(String))
      }catch{/* kein Ortswissen */}
    })()
    return()=>{live=false}
  },[entityId])

  // Gäste: Bewohner, die hier in der letzten Stunde wirklich gekauft haben.
  // Jede Minute neu abgefragt; dazwischen läuft nur die Uhr weiter.
  useEffect(()=>{
    let live=true
    const load=async()=>{
      try{
        const{token}=await getSessionInfo()
        const response=await fetch('/api/game/hospitality/guests?tileEntityId='+encodeURIComponent(entityId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const data=await response.json()
        if(live&&response.ok&&Array.isArray(data.guests)){
          const fetchedAt=Date.now()
          setHour(typeof data.hour==='number'?data.hour:null)
          setUpper(data.upper&&typeof data.upper==='object'?{homes:Number(data.upper.homes??0),guestRooms:Number(data.upper.guestRooms??0)}:null)
          setHeard(Array.isArray(data.heard)?data.heard.map(String):[])
          setAreaM2(typeof data.areaM2==='number'&&data.areaM2>0?data.areaM2:null)
          setRooms(data.rooms&&typeof data.rooms==='object'?{capacity:Number(data.rooms.capacity??0),occupied:Number(data.rooms.occupied??0),mineForS:data.rooms.mineForS==null?null:Number(data.rooms.mineForS)}:null)
          setVisits(data.guests.map((guest:any)=>({resident:guest.resident as ColonyResident,ageSeconds:Number(guest.ageSeconds??0),fetchedAt,label:String(guest.label??'Bestellung')})))
        }
      }catch{/* ohne Antwort bleibt der Raum, wie er ist */}
    }
    void load()
    const refresh=setInterval(()=>void load(),60_000)
    const clock=setInterval(()=>setNowMs(Date.now()),400)
    return()=>{live=false;clearInterval(refresh);clearInterval(clock)}
  },[entityId])

  // Karte laden. Sie sagt je Posten, ob der Gast ihn bezahlen kann.
  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const{token}=await getSessionInfo()
        const response=await fetch('/api/game/hospitality/order?tileEntityId='+encodeURIComponent(entityId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const data=await response.json()
        if(!live)return
        if(response.ok&&Array.isArray(data.items)){setMenu({credits:Number(data.credits??0),items:data.items});setMenuState('ready')}
        else setMenuState('failed')
      }catch{if(live)setMenuState('failed')}
    })()
    return()=>{live=false}
  },[entityId])

  function stopWalk(){if(walk.current){clearInterval(walk.current);walk.current=null}}
  useEffect(()=>{posRef.current=pos},[pos])
  useEffect(()=>()=>stopWalk(),[])
  // Geht den Weg um die Möbel herum ab, Schritt für Schritt.
  function walkTo(target:Point,onArrive?:()=>void){
    stopWalk();setSeat(null)
    const path=venuePath(layout,posRef.current,target)
    let index=1
    walk.current=setInterval(()=>{
      const here=posRef.current,goal=path[index]
      if(!goal){stopWalk();onArrive?.();return}
      const dx=goal.x-here.x,dy=goal.y-here.y,d=Math.hypot(dx,dy)
      if(d<=7){index++;posRef.current={x:goal.x,y:goal.y};setPos(posRef.current);return}
      posRef.current={x:here.x+dx/d*7,y:here.y+dy/d*7};setPos(posRef.current)
    },40)
  }
  function sitAt(spot:VenueSpot){walkTo(spot,()=>{setSeat(spot);setSatAt(Date.now())})}

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return
      const k=event.key.toLowerCase()
      if(k==='escape'){onClose();return}
      if(!['w','a','s','d'].includes(k))return
      event.preventDefault()
      stopWalk();setSeat(null)
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
  // Alle Personen im Raum: wer hierher gehört, plus wer gerade als Gast da ist.
  const worksHere=(r:ColonyResident)=>r.assignments.some(a=>a.type==='work'&&a.tileEntityId===entityId)
  const everyone=useMemo(()=>{
    const known=new Set(residents.map(r=>r.id))
    return[...residents,...visits.filter(visit=>!known.has(visit.resident.id)).map(visit=>visit.resident)]
  },[residents,visits])
  const{figures,moments,joined}=useMemo(()=>{
    const ageOf=new Map(visits.map(visit=>[visit.resident.id,visit.ageSeconds+(nowMs-visit.fetchedAt)/1000]))
    const placed=placeVenueFigures(layout,everyone.map(r=>({
      id:r.id,
      worksHere:worksHere(r),
      isCompanion:Boolean(companion&&r.id===companion.id),
      presenceRoomId:r.interiorPresence?.roomId??null,
    })))
    const moments=new Map<string,GuestMoment>()
    let joined:string|null=null
    const playerSeat=seat?{seat,seatedForS:(nowMs-satAt)/1000}:null
    const figures:VenueFigure[]=[]
    let queue=1
    for(const figure of placed){
      const age=ageOf.get(figure.id)
      // Personal bleibt Personal, auch wenn es selbst etwas gekauft hat.
      if(age===undefined||figure.roomRole==='staff'||!figure.visibleToPlayer){figures.push(figure);continue}
      const place=seatForGuest(layout,figure.spot,figure.id,age,playerSeat,placed)
      const moment=guestMoment(layout,place.seat,age)
      if(place.joined&&(moment.phase==='to-seat'||moment.phase==='seated'))joined=figure.id
      // Wer gegangen ist, ist nicht mehr im Raum – außer er gehört ohnehin hierher.
      if(moment.phase==='gone'){if(residents.some(r=>r.id===figure.id))figures.push(figure);continue}
      // Wer gleichzeitig bestellt, steht hintereinander an.
      const point=moment.phase==='ordering'?{x:moment.point.x-queue++*16,y:moment.point.y+4}:moment.point
      moments.set(figure.id,moment)
      figures.push({...figure,spot:{...moment.spot,x:point.x,y:point.y}})
    }
    return{figures,moments,joined}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[layout,everyone,visits,nowMs,entityId,companion?.id,residents,seat,satAt])
  // Ohne Personal: Café läuft als Automatencafé, Bar und Restaurant sind zu.
  // Das Startcafé geht nach der Uhr des Spielers (23–6 Uhr zu), alle anderen Lokale nach Koloniezeit.
  const hours=venueHoursFor(layout.kind,arrivalPoint)
  const playerHour=hours.clock==='player'?new Date(nowMs).getHours():hour
  const service=venueService(layout,figures,playerHour,hours)
  const closedReason=venueClosedReason(layout,figures,playerHour,hours)
  // Wer sitzt, wird bedient: Jemand vom Personal kommt an den Tisch.
  const seatedForS=seat?(nowMs-satAt)/1000:0
  const tablePhase=seat?tableServicePhase(seatedForS,layout.kind,service):'none'
  const waiterId=useMemo(()=>{
    if(!seat||tablePhase==='none'||tablePhase==='gone')return null
    return figures.filter(f=>f.roomRole==='staff'&&f.visibleToPlayer).map(f=>({id:f.id,d:Math.hypot(f.spot.x-seat.x,f.spot.y-seat.y)})).sort((a,b)=>a.d-b.d)[0]?.id??null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[seat?.id,tablePhase,figures.length])
  const served=useMemo(()=>waiterId&&seat?figures.map(f=>f.id===waiterId?{...f,spot:tableServiceSpot(layout,seat,tablePhase,seatedForS,f.spot)}:f):figures,[figures,waiterId,seat,tablePhase,seatedForS,layout])
  const atTable=tablePhase==='at-table'
  const closed=loaded&&service==='closed'
  const hasMenu=Boolean(menu?.items.length)&&service!=='closed'
  const shown=useMemo<ShownFigure[]>(()=>{
    const byId=new Map(everyone.map(r=>[r.id,r]))
    if(service==='closed')return[]
    return served.filter(f=>f.visibleToPlayer).flatMap(figure=>{
      const resident=byId.get(figure.id)
      return resident?[{figure,resident,moment:moments.get(figure.id)??null}]:[]
    })
  },[served,moments,everyone,service])

  const nearestNpc=useMemo(()=>shown.map(item=>({...item,d:Math.hypot(item.figure.spot.x-pos.x,item.figure.spot.y-pos.y)})).sort((a,b)=>a.d-b.d)[0]??null,[shown,pos])
  const nearService=isAtServicePoint(layout,pos)||atTable
  const showMenu=!closed&&(nearService||menuOpen)
  const nearExit=Math.hypot(pos.x-layout.exit.x,pos.y-layout.exit.y)<48
  const counter=layout.furniture.find(item=>item.kind==='counter')
  const kitchen=layout.furniture.find(item=>item.kind==='kitchen')
  const desk=layout.furniture.find(item=>item.kind==='desk')

  async function order(item:MenuItem){
    if(ordering||!item.affordable||closed)return
    const recipient=treat&&selected&&shown.some(entry=>entry.resident.id===selected.id)?selected:null
    const pending=pendingRequest.current?.itemCode===item.itemCode?pendingRequest.current:{itemCode:item.itemCode,requestId:crypto.randomUUID()}
    pendingRequest.current=pending
    setOrdering(item.itemCode)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/hospitality/order',{
        method:'POST',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({tileEntityId:entityId,itemCode:item.itemCode,requestId:pending.requestId,recipientPersonId:recipient?.id??null}),
      })
      const data=await response.json().catch(()=>({}))
      // Eine Antwort des Servers ist endgültig – ob gebucht oder abgelehnt.
      if(response.status<500)pendingRequest.current=null
      if(response.ok&&data.ok){
        const credits=Number(data.credits??0)
        setMenu(current=>current?{credits,items:current.items.map(entry=>({...entry,affordable:credits>=entry.priceCredits}))}:current)
        if(item.itemCode===ROOM_ITEM_CODE){
          // Ein Zimmer steht nicht auf dem Tresen: Es ist ab jetzt deins, eine Nacht lang.
          if(!data.duplicate)setRooms(current=>current?{...current,occupied:current.occupied+1,mineForS:24*3600}:current)
        }else if(!data.duplicate)setOrders(current=>[...current,{key:pending.requestId,itemCode:item.itemCode,label:item.label,forId:recipient?.id??null,at:Date.now(),tableService:atTable&&!isAtServicePoint(layout,pos)}].slice(-8))
        // Die Kopfzeile des Spiels zeigt denselben Kontostand.
        useGameStore.setState({credits})
        setStatus((item.itemCode===ROOM_ITEM_CODE?'Zimmer für eine Nacht gebucht':recipient?item.label+' für '+personSceneLabel(recipient)+' bestellt':atTable&&!isAtServicePoint(layout,pos)?item.label+' bestellt, wird gleich gebracht':item.label+' bestellt')+' – '+item.priceCredits+' Credits bezahlt. Du hast noch '+credits+' Credits.')
      }else{
        setStatus(String(data.error??'Die Bestellung konnte nicht gebucht werden. Es wurde nichts abgebucht.'))
        if(data.code==='NOXIA_CREDITS_INSUFFICIENT')setMenu(current=>current?{...current,items:current.items.map(entry=>entry.itemCode===item.itemCode?{...entry,affordable:false}:entry)}:current)
      }
    }catch{
      setStatus('Keine Verbindung. Ob gebucht wurde, ist offen – noch einmal bestellen bucht nicht doppelt.')
    }finally{setOrdering(null)}
  }

  const talk=()=>converse(selected,false)
  // opening: Die Figur spricht den Spieler von sich aus an.
  async function converse(selected:ColonyResident|null,opening:boolean){
    if(!selected||(!opening&&!message.trim())||sending)return
    // Die Figur bekommt nur mit, was sie von ihrem Platz aus wissen kann.
    const self=served.find(f=>f.id===selected.id)
    if(!self)return
    const text=opening?'':message.trim().slice(0,80)
    const history=opening?[]:historyState
    setSending(true)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/npc-conversation',{
        method:'POST',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({
          player:text,
          opening,
          npcId:selected.id,
          npcName:selected.displayName,
          npcRole:selected.assignments.find(a=>a.type==='work')?.roleCode??selected.activityState,
          headline:'Gespräch '+layout.locative+' '+buildingName,
          source:'NOXIA '+layout.kind+' interior',
          locationName:buildingName,
          localFacts:venueConversationFacts({layout,buildingName,self,figures:served,servingPlayer:self.id===waiterId&&atTable,playerPos:pos,playerSeat:seat,joinedPlayer:joined===self.id,arrivalPoint,menu:hasMenu?menu?.items:[],playerOrders:orders.filter(entry=>entry.forId!==self.id).map(entry=>entry.label),giftsToSelf:orders.filter(entry=>entry.forId===self.id).map(entry=>entry.label),ownOrder:moments.has(self.id)?visits.find(visit=>visit.resident.id===self.id)?.label??null:null,hour:playerHour,hours,upper,rooms}),
          placeKnowledge,
          // Mitbekommenes hat nur, wer hier arbeitet und den ganzen Tag zuhört.
          hearsay:self.roomRole==='staff'?heard:[],
          // Jedes Haus führt Neue auf seine Art ein – nur wer hier arbeitet.
          introduction:self.roomRole==='staff'?venueIntroduction(layout.kind,upper?.guestRooms??0):undefined,
          history,
        }),
      })
      const data=await response.json().catch(()=>({}))
      if(opening){
        // Eine misslungene Eröffnung bleibt still – der Spieler kann selbst anfangen.
        if(response.ok&&data.reply)setHistory([{role:'assistant' as const,content:String(data.reply)}])
        return
      }
      const reply=response.ok&&data.reply?String(data.reply):'Die Person antwortet gerade nicht.'
      setHistory(current=>[...current,{role:'user' as const,content:text},{role:'assistant' as const,content:reply}].slice(-10))
      setMessage('')
    }finally{setSending(false)}
  }

  // Am Tresen spricht das Personal den Gast von sich aus an – einmal je Besuch,
  // und nur, wenn nicht schon ein Gespräch läuft.
  useEffect(()=>{
    if(!nearService||service!=='staffed'||greeted.current||sending)return
    const host=shown.filter(item=>item.figure.roomRole==='staff').map(item=>({...item,d:Math.hypot(item.figure.spot.x-pos.x,item.figure.spot.y-pos.y)})).sort((a,b)=>a.d-b.d)[0]
    if(!host)return
    greeted.current=true
    if(selected?.id===host.resident.id&&historyState.length)return
    setSelected(host.resident);setHistory([]);setTreat(false)
    void converse(host.resident,true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[nearService,service,shown.length])
  // Setzt sich jemand dazu, wird er zum Gegenüber – das Gespräch beginnt der Spieler.
  useEffect(()=>{
    if(!joined)return
    const guest=everyone.find(r=>r.id===joined)
    if(!guest)return
    setStatus(personSceneLabel(guest)+' setzt sich zu dir an den Tisch.')
    if(!selected||!historyState.length){setSelected(guest);setHistory([]);setTreat(false)}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[joined])
  const openSeats=closed?[]:freeSeats(layout,figures,seat?[seat.id]:[])
  const nextSeat=closed||seat?null:nearestFreeSeat(layout,figures,pos)
  const waiterName=waiterId?(()=>{const w=everyone.find(r=>r.id===waiterId);return w?personSceneLabel(w):null})():null
  useEffect(()=>{if(atTable&&waiterName)setStatus(waiterName+' kommt an deinen Tisch und nimmt die Bestellung auf.')},[atTable,waiterName])

  return <div className="cafe-interior">
    <NpcVisualStyles/>
    <header><div><small>INNENRAUM · {layout.noun.toUpperCase()}</small><b>{buildingName}</b><span>WASD bewegen · Platz anklicken zum Hinsetzen · NPC anklicken · ESC verlassen{playerHour!==null?' · '+(hours.clock==='player'?'Ortszeit ':'Koloniezeit ')+playerHour+' Uhr · geöffnet '+venueHoursText(layout.kind,hours):''}</span></div><button onClick={onClose}>← Verlassen</button></header>
    <main>
      <div className={'room '+layout.kind}>
        {layout.windows.map((win,index)=><div key={index} className="window" style={{left:win.x,width:win.w}}><i/><em/></div>)}
        <div className="door"><small>AUSGANG</small></div>
        {DECOR[layout.kind]?.rug&&<div className="rug" style={{left:DECOR[layout.kind].rug!.x,top:DECOR[layout.kind].rug!.y,width:DECOR[layout.kind].rug!.w,height:DECOR[layout.kind].rug!.h}}/>}
        {layout.furniture.filter(item=>item.kind==='table'||item.kind==='high-table').map(item=><div key={'lamp:'+item.id} className="lamp" style={{left:item.x+item.w/2-70,top:item.y+item.h/2-70}}/>)}
        {layout.furniture.map(item=><div key={item.id} className={'f '+item.kind} style={{left:item.x,top:item.y,width:item.w,height:item.h}}>{item.kind==='counter'&&<><i className="machine"/><i className="vitrine"><HospitalityItemIcon code="cake" size={14}/><HospitalityItemIcon code="snack" size={14}/></i></>}</div>)}
        {(DECOR[layout.kind]?.plants??[]).map(([x,y],index)=><div key={'plant:'+index} className="plant" style={{left:x-14,top:y-26}}><i/><b/></div>)}
        {counter&&<div className="label" style={{left:counter.x+counter.w/2,top:counter.y+counter.h/2}}>{loaded&&service==='self-service'?'AUTOMAT':'TRESEN'}</div>}
        {kitchen&&<div className="label" style={{left:kitchen.x+kitchen.w/2,top:kitchen.y+kitchen.h/2}}>KÜCHE</div>}
        {desk&&<div className="label" style={{left:desk.x+desk.w/2,top:desk.y+desk.h/2}}>EMPFANG</div>}
        {shown.map(({figure,resident,moment})=>{
          const near=Math.hypot(figure.spot.x-pos.x,figure.spot.y-pos.y)<70
          return <div key={resident.id} className="npc" style={{left:figure.spot.x-12,top:figure.spot.y-34}}>
            <NpcFigure id={resident.id} name={personSceneLabel(resident)} role={resident.activityState} appearance={resident.appearance} moving={moment?.phase==='to-seat'||moment?.phase==='leaving'} showLabel={selected?.id===resident.id||near} showRoleLabel={resident.identityState==='known'} selected={selected?.id===resident.id} onClick={()=>{setSelected(resident);setHistory([]);setTreat(false)}}/>
          </div>
        })}
        {shown.filter(item=>item.moment?.served).map(item=><div key={'served:'+item.resident.id} className="item" style={{left:item.figure.spot.x+9,top:item.figure.spot.y-11}} title={visits.find(visit=>visit.resident.id===item.resident.id)?.label}>🍽️</div>)}
        {closed&&<div className="closed"><b>GESCHLOSSEN</b><span>{closedReason==='hours'?'Öffnet um '+hours.open+' Uhr '+clockLabel(hours)+'.'+(arrivalPoint?' Bis dahin gibt es Wasser und Ration in der Hafenkantine.':''):'Hier arbeitet gerade niemand.'}</span></div>}
        {(()=>{const stairs=layout.furniture.find(item=>item.kind==='stairs');if(!stairs)return null;const label=hasUpperFloor(upper)?(upper.guestRooms>0?'ZIMMER ↑':'PRIVAT ↑'):layout.kind==='hotel'?'ZIMMER ↑':null;return label?<div className="label" style={{left:stairs.x+stairs.w/2,top:stairs.y+stairs.h/2}}>{label}</div>:null})()}
        {orders.map((entry,index)=>{
          // Was bestellt wurde, steht sichtbar da: vor der Person, der es gilt; sonst beim Spieler –
          // am Tisch, wenn er sitzt, in der Hand, wenn er geht. Am Tisch Bestelltes bringt das Personal nach kurzer Zeit.
          const target=entry.forId?shown.find(item=>item.resident.id===entry.forId)?.figure.spot:null
          const same=orders.slice(0,index).filter(other=>other.forId===entry.forId).length
          if(!target&&entry.tableService&&nowMs-entry.at<BRING_S*1000)return null
          const at=target?{x:target.x+16+same*12,y:target.y+(target.kind==='staff'?14:-4)}:seat?{x:seat.x+14+same*12,y:seat.y-6}:{x:pos.x+14+same*12,y:pos.y-14}
          return <div key={entry.key} className="item" style={{left:at.x-9,top:at.y-9}} title={entry.label}><HospitalityItemIcon code={entry.itemCode} size={18} title={entry.label}/></div>
        })}
        {openSeats.map(spot=><button key={spot.id} className="seat-hit" style={{left:spot.x-11,top:spot.y-11}} title={'Hier hinsetzen – '+spot.label} aria-label={'Hinsetzen '+spot.label} onClick={()=>sitAt(spot)}/>)}
        <div className={'player'+(seat?' sitting':'')} style={{left:pos.x-10,top:pos.y-24}}><i/><span>Du</span></div>
        {nearService&&!closed&&<div className="context hint" style={{left:layout.servicePoint.x-34,top:layout.servicePoint.y+14}}>{service==='self-service'?'AM AUTOMATEN':layout.servicePoint.label} · KARTE RECHTS</div>}
        {(nearExit||closed)&&<button className="context exit" style={{left:42,top:420}} onClick={onClose}>{layout.noun.toUpperCase()} VERLASSEN</button>}
      </div>
      <aside>
        <small>{layout.noun.toUpperCase()} · LOKAL</small>
        {selected?<div className="portrait"><PersonPortrait id={selected.id} role={selected.assignments.find(item=>item.type==='work')?.roleCode??selected.activityState} appearance={selected.appearance} size={64} title={personSceneLabel(selected)}/><div><h3>{personSceneLabel(selected)}</h3>{selected.identityState==='known'&&<small>{selected.assignments.find(item=>item.type==='work')?.roleCode??selected.activityState}</small>}</div></div>:<h3>Gastraum</h3>}
        {selected&&selected.identityState!=='known'&&selected.observableDescription&&selected.observableDescription!==personSceneLabel(selected)&&<p className="desc">{selected.observableDescription}</p>}
        {!selected&&closed&&<p>{closedReason==='hours'?'Dieses Lokal hat gerade geschlossen. Geöffnet ist '+venueHoursText(layout.kind,hours)+' '+clockLabel(hours)+'; jetzt ist es '+playerHour+' Uhr.'+(arrivalPoint?' Bis dahin gibt es Wasser und Ration in der Hafenkantine.':''):'Dieses Lokal ist geschlossen: Hier arbeitet gerade niemand. Ohne Personal gibt es weder Ausschank noch Gäste.'}</p>}
        {!selected&&!closed&&!showMenu&&<p>Du kannst dich frei im Raum bewegen. Personen im Raum wissen nur, was sie von ihrem Platz aus sehen und was du ihnen erzählst.{loaded&&service==='self-service'?' Hier bedient kein Personal – bestellt wird am Automaten.':''}</p>}
        {selected&&<>
          <div className="history">{historyState.map((entry,index)=><p key={index}><b>{entry.role==='user'?'Du':personSceneLabel(selected)}:</b> „{entry.content}“</p>)}</div>
          <div className="chat"><input value={message} maxLength={80} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void talk()}} placeholder="Kurze Antwort …"/><button disabled={sending||!message.trim()} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div>
        </>}
        {!closed&&<div className="moves">
          {!nearService&&<button onClick={()=>walkTo(layout.servicePoint)}>{service==='self-service'?'Zum Automaten gehen':'Zum Tresen gehen'}</button>}
          {seat?<button onClick={()=>setSeat(null)}>Aufstehen</button>:nextSeat&&<button onClick={()=>sitAt(nextSeat)}>An einen Tisch setzen</button>}
        </div>}
        {showMenu&&<div className="menu">
          <small>KARTE</small>
          {menuState==='loading'&&<p>Die Karte wird geholt …</p>}
          {menuState==='failed'&&<p>Die Karte konnte nicht geladen werden. Verlasse das Lokal und komm noch einmal herein.</p>}
          {menuState==='ready'&&!hasMenu&&<p>Hier gibt es noch keine Karte.</p>}
          {hasMenu&&menu&&<>
          <p>Du hast {menu.credits} Credits.</p>
          {selected&&shown.some(entry=>entry.resident.id===selected.id)&&<div className="for">
            <button className={treat?'':'on'} onClick={()=>setTreat(false)}>Für mich</button>
            <button className={treat?'on':''} onClick={()=>setTreat(true)}>Für {personSceneLabel(selected)}</button>
          </div>}
          <div className="tiles">{menu.items.filter(item=>item.itemCode!==ROOM_ITEM_CODE).map(item=><button key={item.itemCode} className="tile" disabled={!item.affordable||!nearService||ordering!==null} onClick={()=>void order(item)} title={item.affordable?item.label:'Dafür reichen deine Credits nicht.'}>
            <HospitalityItemIcon code={item.itemCode} size={44} title={item.label}/>
            <span>{item.label}</span><b>{item.priceCredits} Cr</b>
            {!item.affordable&&<small>zu teuer</small>}
          </button>)}</div>
          {(()=>{const room=menu.items.find(item=>item.itemCode===ROOM_ITEM_CODE);if(!room)return null;const free=rooms?roomsFree(rooms):0;return <div className="rooms">
            <small>ZIMMER</small>
            {rooms?.mineForS!=null?<p>Du hast hier ein Zimmer, noch etwa {Math.max(1,Math.round(rooms.mineForS/3600))} Stunden.</p>:<p>{rooms?rooms.capacity+' Zimmer, '+free+' frei.':'Ob ein Zimmer frei ist, weiß gerade niemand.'}</p>}
            <button className="tile" disabled={!room.affordable||!nearService||ordering!==null||!canBookRoom(rooms)} onClick={()=>{setTreat(false);void order(room)}} title={room.affordable?'Zimmer für eine Nacht':'Dafür reichen deine Credits nicht.'}>
              <HospitalityItemIcon code={ROOM_ITEM_CODE} size={40} title="Zimmer"/>
              <span>Zimmer für eine Nacht</span><b>{room.priceCredits} Cr</b>
              {!room.affordable&&<small>zu teuer</small>}
            </button>
          </div>})()}
          {!nearService&&<p>{seat&&tablePhase!=='none'&&tablePhase!=='gone'?'Jemand vom Personal kommt gleich an deinen Tisch.':seat&&service==='staffed'&&layout.kind!=='hotel'?'Bleib sitzen – gleich kommt jemand an den Tisch.':'Zum Bestellen musst du '+(service==='self-service'?'am Automaten':layout.servicePoint.locative)+' stehen.'}</p>}
          </>}
        </div>}
        {status&&<div className="status">{status}</div>}
        {nearestNpc&&<div className="near">Nächste Person: {personSceneLabel(nearestNpc.resident)} · {nearestNpc.figure.spot.label}</div>}
      </aside>
    </main>
    <style jsx>{`
      .cafe-interior{position:fixed;inset:44px 0 0;z-index:2600;background:#0d1718;color:#eef2ed;font-family:system-ui}.cafe-interior header{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#10272a;border-bottom:1px solid #476263}.cafe-interior header small,.cafe-interior header b,.cafe-interior header span{display:block}.cafe-interior header small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}.cafe-interior header b{margin-top:2px}.cafe-interior header span{font-size:9px;color:#91a7a7}.cafe-interior header button{border:1px solid #5a7472;background:#17383a;color:#eef2ed;border-radius:6px;padding:7px 10px;cursor:pointer}.cafe-interior main{display:grid;grid-template-columns:minmax(0,1fr) 320px;height:calc(100% - 54px)}.room{position:relative;width:min(100%,760px);height:470px;margin:28px auto;background:linear-gradient(var(--wall) 0 12%,var(--panel) 12% 19%,var(--rail) 19% 20%,var(--floor) 20% 100%);border:12px solid #5c4431;box-shadow:0 18px 50px #0008,inset 0 0 120px #00000055;overflow:hidden}.room.cafe{--wall:#e9d9b8;--panel:#b98b5d;--rail:#7a5436;--floor:#c08a56;--plank:#a9733f;--top:#e5c79a}.room.bar{--wall:#4a3340;--panel:#3a2229;--rail:#1f1316;--floor:#5a3b2a;--plank:#4a2f20;--top:#8a6a4c}
.room.hotel{--wall:#e6dccb;--panel:#c9b291;--rail:#8d6e4e;--floor:#d6cdbd;--plank:#c4b6a0;--top:#efe6d6}.room.restaurant{--wall:#efe3d3;--panel:#8a4a3e;--rail:#5e3027;--floor:#b9875a;--plank:#a3703f;--top:#ead3b0}.room:after{content:'';position:absolute;inset:20% 0 0;background-image:linear-gradient(var(--plank) 1px,transparent 1px),linear-gradient(90deg,#0000001a 1px,transparent 1px);background-size:100% 18px,160px 18px;background-position:0 0,40px 0;opacity:.55;pointer-events:none}
.room:before{content:'';position:absolute;inset:12% 0 81%;background:repeating-linear-gradient(90deg,transparent 0 34px,#0000001c 34px 36px);pointer-events:none}.window{position:absolute;top:14px;height:44px;background:linear-gradient(#9fd0e6,#d9ecf3 70%,#b8d9a3);border:6px solid #6d4f37;box-shadow:inset 0 0 10px #ffffff88,0 6px 0 -2px #5a3f2b}
.window i{position:absolute;inset:0;background:linear-gradient(#6d4f37,#6d4f37) center/100% 3px no-repeat,linear-gradient(#6d4f37,#6d4f37) center/3px 100% no-repeat}
.window em{position:absolute;left:-6px;right:-6px;bottom:-12px;height:6px;background:#8c6a48;border-radius:0 0 3px 3px}.room.bar .window{background:linear-gradient(#1d2b45,#3b5870 70%,#2a3a3a)}.door{position:absolute;left:45px;bottom:0;width:86px;height:55px;background:linear-gradient(90deg,#4a382c,#5c463a 50%,#4a382c);border:5px solid #6a4d37;border-bottom:0;display:grid;place-items:start center}
.door:after{content:'';position:absolute;right:12px;top:26px;width:6px;height:6px;border-radius:50%;background:#d8b35a}
.door small{margin-top:-18px;padding:1px 5px;background:#1d6b3a;color:#dff5e3;font:700 6px monospace;letter-spacing:.1em;border-radius:2px}.f{position:absolute;z-index:2}.table{background:radial-gradient(circle at 40% 35%,var(--top),#b07a48 70%,#7a4d2c);border:3px solid #4e3525;border-radius:50%;box-shadow:0 4px 0 #3a2518,0 8px 10px #0005}
.table:after{content:'';position:absolute;left:50%;top:50%;width:9px;height:9px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 40% 40%,#f6f1e4,#cdd6c4);box-shadow:0 -5px 0 -1px #c84d4d,0 1px 2px #0006}
.room.restaurant .table:after{background:#fff;box-shadow:0 -6px 0 -1px #e8b84a,0 1px 2px #0006}.high-table{background:#3a2a22;border:4px solid #c9a35a;border-radius:50%}.chair{background:linear-gradient(#8b5a3a,#6e4529);border:2px solid #3b281c;border-radius:6px 6px 3px 3px;box-shadow:inset 0 3px 0 #a26f47,0 2px 0 #2a1a12}
.room.bar .chair{background:linear-gradient(#7a2f2a,#5a221e);box-shadow:inset 0 3px 0 #9a3f38,0 2px 0 #2a1a12}.stool{background:#8a3b34;border:2px solid #3d1b18;border-radius:50%}.counter{background:linear-gradient(#efe6d6 0 30%,#67432b 30%);border:4px solid #40291e;border-radius:5px;box-shadow:0 6px 0 #2e1d14,0 10px 14px #0006;overflow:visible}
.counter .machine{position:absolute;right:10px;top:-14px;width:22px;height:16px;background:linear-gradient(#5b6168,#2c3136);border-radius:3px 3px 1px 1px;box-shadow:inset 0 2px 0 #9aa3a8}
.counter .machine:after{content:'';position:absolute;left:5px;bottom:-4px;width:12px;height:4px;background:#1b1f22;border-radius:0 0 2px 2px}
.counter .vitrine{position:absolute;left:10px;top:-14px;display:flex;gap:2px;padding:1px 3px;background:#ffffffb8;border:1px solid #9fb3b8;border-radius:3px 3px 0 0;box-shadow:inset 0 0 6px #fff}
.room.bar .counter{background:linear-gradient(#2a1d18 0 30%,#3c2a22 30%)}.room.bar .counter .vitrine{display:none}.room.bar .counter .machine{background:linear-gradient(#c9a35a,#7a5a2a)}.shelf{background:repeating-linear-gradient(90deg,#c9a35a 0 4px,#3f2a1e 4px 7px,#8a9a4a 7px 10px,#3f2a1e 10px 14px,#b85a3a 14px 17px,#3f2a1e 17px 22px);border:2px solid #2a1a12;border-radius:2px;box-shadow:0 3px 0 #1a100a}.room.hotel .shelf{background:radial-gradient(circle,#e8c35a 1.5px,transparent 2px) 6px 50%/14px 8px repeat-x,#3a2a1e}
.desk{background:linear-gradient(#efe6d6 0 35%,#67432b 35%);border:3px solid #40291e;border-radius:4px;box-shadow:0 5px 0 #2e1d14,0 8px 10px #0005}.wall{background:#5c4431}.pass{background:#d8c9a8;border:3px solid #40291e;z-index:3}.stairs{background:repeating-linear-gradient(90deg,#8a6a4c 0 8px,#6f5238 8px 10px);border:3px solid #40291e;border-radius:3px}.kitchen{background:repeating-linear-gradient(45deg,#9aa3a3 0 8px,#8b9494 8px 16px);z-index:1}.closed{position:absolute;inset:0;z-index:15;background:#0b1214cc;display:grid;place-content:center;justify-items:center;gap:6px;color:#ead3a4}.closed b{font:800 20px monospace;letter-spacing:.2em}.closed span{font-size:11px;color:#b9cbc6}.menu button{display:grid;grid-template-columns:1fr auto;gap:2px 10px;width:100%;margin-top:6px;padding:8px 10px;text-align:left;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;cursor:pointer;font-size:12px}.menu button b{color:#f1d57a}.menu button small{grid-column:1/-1;color:#d9a48a;font-size:10px}.menu button:disabled{cursor:not-allowed;background:#102526;border-color:#2d4445;color:#7f9591}.menu button:disabled b{color:#7f9591}.label{position:absolute;z-index:3;transform:translate(-50%,-50%);color:#ead3a4;font:800 8px monospace;letter-spacing:.08em;pointer-events:none;text-shadow:0 1px 2px #000a}.npc{position:absolute;z-index:8}.rug{position:absolute;z-index:1;border-radius:6px;background:repeating-linear-gradient(45deg,#8f3b3b 0 10px,#a85050 10px 20px);opacity:.55;box-shadow:inset 0 0 0 6px #c99a6a99}
.room.bar .rug{background:repeating-linear-gradient(45deg,#3a2a4a 0 10px,#4a3660 10px 20px)}
.room.hotel .rug{background:repeating-linear-gradient(45deg,#4a5a7a 0 10px,#5e6f90 10px 20px)}
.lamp{position:absolute;z-index:1;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,#fff3c07a 0,#ffe8a833 42%,transparent 68%);pointer-events:none}
.lamp:after{content:'';position:absolute;left:50%;top:50%;width:100px;height:100px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#ffeec066 0,transparent 70%)}
.plant{position:absolute;z-index:4;width:28px;height:40px;pointer-events:none;filter:drop-shadow(0 3px 2px #0006)}
.plant i{position:absolute;left:4px;bottom:0;width:20px;height:14px;background:linear-gradient(#b5603a,#8c4528);border-radius:2px 2px 5px 5px}
.plant b{position:absolute;left:0;top:0;width:28px;height:30px;border-radius:50% 50% 45% 45%;background:radial-gradient(circle at 35% 35%,#8fc06a,#3f7a3a 60%,#2c5a2a)}
.plant b:after{content:'';position:absolute;left:9px;top:-6px;width:10px;height:18px;border-radius:50%;background:#5f9a4a;transform:rotate(-20deg)}
.seat-hit{position:absolute;z-index:8;width:22px;height:22px;padding:0;border:1px dashed transparent;border-radius:50%;background:transparent;cursor:pointer}
.seat-hit:hover,.seat-hit:focus-visible{border-color:#f1d57a;background:#f1d57a33;outline:none}
.player.sitting i{height:16px;margin-top:6px}
.moves{display:flex;gap:6px;margin-top:10px}
.moves button{flex:1;padding:6px 8px;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;cursor:pointer;font-size:11px}
.player{position:absolute;z-index:10;width:20px;height:28px}.player i{display:block;width:14px;height:22px;margin:auto;background:#d7ad3c;border:2px solid #5c481c;border-radius:8px 8px 4px 4px}.player span{position:absolute;top:-15px;left:50%;transform:translateX(-50%);background:#13262b;border:1px solid #d7ad3c;border-radius:4px;padding:1px 4px;font:700 8px monospace}.context{position:absolute;z-index:20;border:1px solid #d0b66a;background:#153438;color:#f4e8c4;border-radius:5px;padding:5px 7px;font:800 8px monospace;cursor:pointer}.item{position:absolute;z-index:9;pointer-events:auto;filter:drop-shadow(0 1px 1px #0006)}.for{display:flex;gap:6px;margin-top:6px}.desc{margin:-4px 0 6px;font-size:11px;color:#9fb5b0}
.menu .rooms{margin-top:8px;display:grid;gap:4px}.menu .rooms p{margin:0;font-size:11px;color:#9fb5b0}
.menu .tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:6px}
.menu button.tile{display:flex;flex-direction:column;align-items:center;gap:3px;margin:0;padding:8px 4px 7px;text-align:center}
.menu button.tile:disabled :global(svg){opacity:.35;filter:grayscale(1)}
.menu .for button{display:block;width:auto;flex:1;margin:0;padding:5px 8px;font-size:11px;text-align:center;background:#102526;border-color:#2d4445;color:#9fb5b0}.menu .for button.on{background:#17383a;border-color:#d0b66a;color:#f4e8c4}.context.hint{cursor:default;white-space:nowrap}.menu{margin-top:12px;padding-top:10px;border-top:1px solid #2d4445}.context.exit{background:#3a2b24}.cafe-interior aside{padding:16px;background:#091719;border-left:1px solid #40595a;overflow:auto}.cafe-interior aside small{color:#d9bb6a;font:800 8px monospace;letter-spacing:.12em}.cafe-interior aside h3{margin:4px 0 10px}.cafe-interior aside .portrait{display:flex;gap:10px;align-items:center;margin-bottom:6px}.portrait h3{margin:0}.portrait small{display:block;color:#9fb5b0;font-size:11px}.cafe-interior aside p{font-size:11px;line-height:1.45;color:#cbd6d2}.history p{border-top:1px solid #2d4445;padding-top:7px}.chat{display:flex;gap:6px;margin-top:10px}.chat input{flex:1;min-width:0;background:#061012;color:#eef;border:1px solid #40595a;border-radius:5px;padding:7px}.chat button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:0 9px}.status,.near{margin-top:10px;padding:8px;border:1px solid #485f5d;border-radius:6px;background:#102526;font-size:10px;color:#b9cbc6}.near{color:#92aaa5}@media(max-width:900px){.cafe-interior main{grid-template-columns:1fr}.cafe-interior aside{position:absolute;right:10px;bottom:10px;width:min(320px,80vw);max-height:40vh;border:1px solid #40595a;border-radius:8px}}
    `}</style>
  </div>
}
