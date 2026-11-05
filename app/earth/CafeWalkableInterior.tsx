'use client'

// app/earth/CafeWalkableInterior.tsx
// Die Gastronomie als erste Einrichtung des allgemeinen Innenraums
// (app/interiors/WalkableInterior.tsx, NOXIA-INTERIOR-0001). Hier steht nur,
// was ein Lokal ausmacht: Grundriss nach Art und Größe, Öffnungszeiten,
// Gäste aus echten Käufen, Karte und Bestellen, Zimmer, Wissen des Personals.
// Bewegung, Personen, Gespräch und Tafel liefert der Motor.

import { useEffect, useMemo, useRef, useState } from 'react'
import HospitalityItemIcon from './HospitalityItemIcon'
import WalkableInterior, { type InteriorContext, type InteriorFitting, type PlacedThing, type Visit } from '@/app/interiors/WalkableInterior'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import { venueIntroduction } from '@/lib/game/hospitality/introductions'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import { useGameStore } from '@/lib/store/gameStore'
import { SOCIAL_INFRASTRUCTURE } from '@/lib/game/settlements/tiers'
import { spokenOrderItems, spokenOrderTitle } from '@/lib/game/hospitality/spokenOrder'
import { loadReferral, referralFor, saveReferral, venueReferralFacts, type JobReferral } from '@/lib/game/jobs/referral'
import { EINSATZ_S, employerShiftFacts, shiftEndText, shiftPay, standingFrom, type ShiftStanding, MUSIC_STYLES, PROPOSED_WAGE_PER_HOUR, ROLE_DUTY, ROLE_LABEL, SHIFT_GAME_HOURS, compressPurchases, roleStation, shiftRolesFor, shiftTasks, shiftWage, workingFact, type MusicStyle, type ShiftPurchase, type ShiftRole, type ShiftTask } from '@/lib/game/hospitality/playerShift'
import { VENUE_WC_DOOR, toiletAccess, venueServiceRules, type VenueServiceRules } from '@/lib/game/hospitality/venueServices'
import {
  isAtServicePoint,
  venueConversationFacts,
  venueLayoutForBuildingType,
  hasUpperFloor,
  venueClosedReason,
  venueHoursText,
  venueHoursFor,
  clockLabel,
  venueService,
  withUpperFloor,
  venueSizeForArea,
  venueLayoutForSize,
  ROOM_ITEM_CODE,
  ENTRY_ITEM_CODE,
  canBookRoom,
  roomsFree,
  type VenueFigure,
  type VenueRooms,
  type VenueUpperFloor,
  type VenueKind,
} from '@/lib/game/hospitality/venues'

type Props = {
  entityId: string
  /** Gebäudetyp (cafe, bar, restaurant, hotel). Unbekannt oder leer: Café. */
  buildingTypeId?: string
  buildingName: string
  companion?: ColonyResident | null
  onClose: () => void
  /** Von der Agentur direkt hergeschickt: die vermittelte Schicht beginnt gleich. */
  referralStart?: boolean
}

// Dekor je Lokalart – nur Bild, keine Kollision, keine Plätze.
const DECOR:Record<string,{plants:Array<[number,number]>;rug:{x:number;y:number;w:number;h:number}|null}>={
  cafe:{plants:[[130,112],[700,400],[470,410]],rug:{x:150,y:125,w:300,h:235}},
  bar:{plants:[[130,112],[470,420]],rug:{x:170,y:110,w:250,h:220}},
  restaurant:{plants:[[130,112],[570,112]],rug:null},
  hotel:{plants:[[130,112],[700,400],[330,112]],rug:{x:150,y:280,w:300,h:110}},
  nightclub:{plants:[],rug:null},
}

type MenuItem = { itemCode:string; label:string; priceCredits:number; affordable:boolean }
type Menu = { credits:number; items:MenuItem[] }
// Eine Bestellung dieses Besuchs. forId: wem sie ausgegeben wurde (null = für sich selbst).
type PlacedOrder = { key:string; itemCode:string; label:string; forId:string|null; at:number; tableService:boolean }

export default function CafeWalkableInterior({entityId,buildingTypeId,buildingName,companion=null,onClose,referralStart=false}:Props){
  const[hour,setHour]=useState<number|null>(null)
  const[upper,setUpper]=useState<VenueUpperFloor|null>(null)
  const[heard,setHeard]=useState<string[]>([])
  const[rooms,setRooms]=useState<VenueRooms|null>(null)
  const[areaM2,setAreaM2]=useState<number|null>(null)
  // Umbau (R-13): Ziel-Lokalart und Fertigstellung; Anzeigename des Hauses (z. B. „Metropol“, „Hauptstraße 72“).
  const[conversion,setConversion]=useState<{type:string;readyAt:string|null}|null>(null)
  const[displayName,setDisplayName]=useState<string|null>(null)
  const[placeKnowledge,setPlaceKnowledge]=useState<string[]>([])
  const[visits,setVisits]=useState<Visit[]>([])
  const[menu,setMenu]=useState<Menu|null>(null)
  const[menuState,setMenuState]=useState<'loading'|'ready'|'failed'>('loading')
  const[ordering,setOrdering]=useState<string|null>(null)
  const[orders,setOrders]=useState<PlacedOrder[]>([])
  // Für wen bestellt wird: für sich selbst oder für die angesprochene Person.
  const[treat,setTreat]=useState(false)
  const[nowMs,setNowMs]=useState(()=>Date.now())
  // Eine Kennung je Bestellversuch – eine Wiederholung nach Netzfehler bucht nicht doppelt.
  const pendingRequest=useRef<{itemCode:string;requestId:string}|null>(null)
  const ctxRef=useRef<InteriorContext|null>(null)
  // Hausregeln neben der Karte (Toilette); ohne Daten gilt der Standard: frei für jeden.
  const[serviceRules,setServiceRules]=useState<VenueServiceRules>(()=>venueServiceRules(null))
  // Im Gespräch Genanntes, das schon gebucht wurde: „Satz|Posten“.
  const[spokenDone,setSpokenDone]=useState<string[]>([])
  // Nachtclub: bis wann der Eintritt gilt (aus dem Gäste-Abruf), Millisekunden; null = nicht bezahlt.
  const[entryPaidUntil,setEntryPaidUntil]=useState<number|null>(null)

  const effectiveType=conversion?.type??buildingTypeId
  const layout=useMemo(()=>{const base=venueLayoutForSize(venueLayoutForBuildingType(effectiveType),venueSizeForArea(areaM2));return hasUpperFloor(upper)?withUpperFloor(base):base},[effectiveType,upper,areaM2])
  // Der Name des Hauses: aus den Daten, sonst der übergebene Name ohne Art-Präfix („Bar · Metropol“ → „Metropol“).
  const houseName=displayName??buildingName.split(' · ').pop()??buildingName
  const underConversion=Boolean(conversion)
  const emptyHouse=!conversion&&String(buildingTypeId??'')==='acquired_building'
  const kind=layout.kind as VenueKind
  const arrivalPoint=SOCIAL_INFRASTRUCTURE[kind]?.arrivalPoint===true
  // Das Startcafé geht nach der Uhr des Spielers (23–6 Uhr zu), alle anderen Lokale nach Koloniezeit.
  const hours=venueHoursFor(kind,arrivalPoint)
  const playerHour=hours.clock==='player'?new Date(nowMs).getHours():hour

  // Ortswissen: was Ansässige über die Gegend wissen.
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

  // Zustand des Lokals: Gäste aus echten Käufen, Stunde, Obergeschoss, Mitbekommenes, Zimmer, Grundfläche.
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
          setConversion(data.conversion&&typeof data.conversion==='object'&&data.conversion.type?{type:String(data.conversion.type),readyAt:data.conversion.readyAt?String(data.conversion.readyAt):null}:null)
          setDisplayName(typeof data.displayName==='string'&&data.displayName.trim()?data.displayName.trim():null)
          setServiceRules(venueServiceRules(data.services))
          setRecentPurchases(Array.isArray(data.recent)?data.recent.map((p:any)=>({personId:String(p.personId),atMs:Date.parse(String(p.at)),label:p.label?String(p.label):undefined})).filter((p:ShiftPurchase)=>Number.isFinite(p.atMs)):[])
          setEntryPaidUntil(typeof data.entryPaidForS==='number'&&data.entryPaidForS>0?Date.now()+data.entryPaidForS*1000:null)
          setRooms(data.rooms&&typeof data.rooms==='object'?{capacity:Number(data.rooms.capacity??0),occupied:Number(data.rooms.occupied??0),mineForS:data.rooms.mineForS==null?null:Number(data.rooms.mineForS)}:null)
          setVisits(data.guests.map((guest:any)=>({resident:guest.resident as ColonyResident,ageSeconds:Number(guest.ageSeconds??0),fetchedAt,label:String(guest.label??'Bestellung')})))
        }
      }catch{/* ohne Antwort bleibt der Raum, wie er ist */}
    }
    void load()
    const refresh=setInterval(()=>void load(),60_000)
    const clock=setInterval(()=>setNowMs(Date.now()),1000)
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

  async function order(item:MenuItem,said?:{title:string;key:string}){
    const ctx=ctxRef.current
    if(!ctx||ordering||!item.affordable||ctx.closed)return
    const recipient=treat&&ctx.selected&&ctx.shown.some(entry=>entry.resident.id===ctx.selected!.id)?ctx.selected:null
    const fromTable=ctx.atTable&&!isAtServicePoint(layout,ctx.pos)
    const pending=pendingRequest.current?.itemCode===item.itemCode?pendingRequest.current:{itemCode:item.itemCode,requestId:crypto.randomUUID()}
    pendingRequest.current=pending
    setOrdering(item.itemCode)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/hospitality/order',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({tileEntityId:entityId,itemCode:item.itemCode,requestId:pending.requestId,recipientPersonId:recipient?.id??null}),
      })
      const data=await response.json().catch(()=>({}))
      if(response.status<500)pendingRequest.current=null
      if(response.ok&&data.ok){
        const credits=Number(data.credits??0)
        setMenu(current=>current?{credits,items:current.items.map(entry=>({...entry,affordable:credits>=entry.priceCredits}))}:current)
        if(item.itemCode===ROOM_ITEM_CODE){
          if(!data.duplicate)setRooms(current=>current?{...current,occupied:current.occupied+1,mineForS:24*3600}:current)
        }else if(!data.duplicate){if(said)setSpokenDone(current=>[...current,said.key].slice(-20));setOrders(current=>[...current,{key:pending.requestId,itemCode:item.itemCode,label:item.label,forId:recipient?.id??null,at:Date.now(),tableService:fromTable}].slice(-8))}
        useGameStore.setState({credits})
        const shown=said?.title??item.label
        ctx.setStatus((item.itemCode===ENTRY_ITEM_CODE?'Eintritt bezahlt, gilt die ganze Nacht – der Türsteher lässt dich durch':item.itemCode===ROOM_ITEM_CODE?'Zimmer für eine Nacht gebucht':recipient?shown+' für '+personSceneLabel(recipient)+' bestellt':fromTable?shown+' bestellt, wird gleich gebracht':shown+' bestellt')+' – '+item.priceCredits+' Credits bezahlt. Du hast noch '+credits+' Credits.')
      }else{
        ctx.setStatus(String(data.error??'Die Bestellung konnte nicht gebucht werden. Es wurde nichts abgebucht.'))
        if(data.code==='NOXIA_CREDITS_INSUFFICIENT')setMenu(current=>current?{...current,items:current.items.map(entry=>entry.itemCode===item.itemCode?{...entry,affordable:false}:entry)}:current)
      }
    }catch{
      ctx.setStatus('Keine Verbindung. Ob gebucht wurde, ist offen – noch einmal bestellen bucht nicht doppelt.')
    }finally{setOrdering(null)}
  }

  // Einlass (Nachtclub): Eintritt steht auf der Karte; bezahlt ist er für diese Nacht.
  const entryItem=menu?.items.find(item=>item.itemCode===ENTRY_ITEM_CODE)??null
  const entryPaid=(entryPaidUntil!==null&&entryPaidUntil>nowMs)||orders.some(entry=>entry.itemCode===ENTRY_ITEM_CODE)
  const things:PlacedThing[]=orders.filter(entry=>entry.itemCode!==ENTRY_ITEM_CODE).map(entry=>({key:entry.key,icon:<HospitalityItemIcon code={entry.itemCode} size={18} title={entry.label}/>,title:entry.label,forId:entry.forId,at:entry.at,broughtToTable:entry.tableService}))
  const service=(figures:readonly VenueFigure[])=>underConversion||emptyHouse?'closed':venueService(layout,figures,playerHour,hours)
  const readyText=conversion?.readyAt?new Date(conversion.readyAt).toLocaleString('de-DE',{weekday:'short',hour:'2-digit',minute:'2-digit'}):null
  const canteenHint=arrivalPoint?' Bis dahin gibt es Wasser und Ration in der Hafenkantine.':''

  // ── Arbeiten im Lokal (Thomas, 28.10.2026) ──────────────────────────────
  // Stellen und Lohn kommen vom Server (/api/game/hospitality/shift, R-20). Gibt es
  // den Weg noch nicht, läuft die Schicht als Probeschicht ohne Lohn.
  type Shift={role:ShiftRole;startedAtMs:number;shiftId:string|null;wagePerHour:number;gameHours:number}
  type Jobs={server:boolean;open:ShiftRole[];wages:Partial<Record<ShiftRole,number>>;note?:string;employer:string;ownVenue:boolean;standing:ShiftStanding|null}
  const[jobs,setJobs]=useState<Jobs|null>(null)
  const[shift,setShift]=useState<Shift|null>(null)
  const[shiftDone,setShiftDone]=useState<string[]>([])
  const[shiftStats,setShiftStats]=useState({tasks:0,guests:0,tips:0})
  const[music,setMusic]=useState<MusicStyle>('House')
  const[shiftBusy,setShiftBusy]=useState(false)
  // Echte Käufe der letzten Stunden (Gäste-Abruf) – Stoff für die Gästeaufgaben einer Schicht.
  const[recentPurchases,setRecentPurchases]=useState<ShiftPurchase[]>([])
  // Personalplätze, die bei Schichtbeginn schon besetzt waren – der eigene Arbeitsplatz ist ein freier.
  const[stationTaken,setStationTaken]=useState<string[]>([])
  const seatOf=useRef(new Map<string,{x:number;y:number}>())
  const roles=shiftRolesFor(kind)
  // Vermittlungsschein der Agentur für dieses Haus (referral.ts).
  const[referral,setReferral]=useState<JobReferral|null>(()=>referralFor(loadReferral(),entityId,Date.now()))
  const autoStarted=useRef(false)

  async function shiftApi(body:Record<string,unknown>|null){
    const{token}=await getSessionInfo()
    const response=await fetch('/api/game/hospitality/shift'+(body?'':'?tileEntityId='+encodeURIComponent(entityId)),body?{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({tileEntityId:entityId,...body})}:{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    const data=await response.json().catch(()=>({}))
    return{ok:response.ok,status:response.status,data}
  }
  // Offene Stellen und eine laufende Schicht (nach dem Neuladen) holen.
  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const r=await shiftApi(null)
        if(!live)return
        if(r.ok&&Array.isArray(r.data.open)){
          setJobs({server:true,open:r.data.open.filter((role:string)=>roles.includes(role as ShiftRole)),wages:r.data.wages??{},note:r.data.note,employer:String(r.data.employer?.name??'der Betreiber'),ownVenue:Boolean(r.data.employer?.ownVenue),standing:standingFrom(r.data.standing)})
          if(r.data.active?.role&&String(r.data.active.tileEntityId??entityId)===entityId){if(Array.isArray(r.data.active.doneKeys))setShiftDone(r.data.active.doneKeys.map(String));setShiftStats({tasks:Number(r.data.active.tasks??0),guests:0,tips:0})}
          if(r.data.active?.role&&String(r.data.active.tileEntityId??entityId)===entityId)setShift({role:r.data.active.role,startedAtMs:Date.parse(r.data.active.startedAt),shiftId:String(r.data.active.shiftId),wagePerHour:Number(r.data.active.wagePerHour??0),gameHours:Number(r.data.active.gameHours??SHIFT_GAME_HOURS[r.data.active.role as ShiftRole]??4)})
          return
        }
      }catch{/* kein Arbeitsmarkt für Spieler – Probeschicht */}
      if(live)setJobs({server:false,open:roles,wages:{},employer:'der Betreiber',ownVenue:false,standing:null})
    })()
    return()=>{live=false}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[entityId,kind])
  // Wo Gäste gesessen haben – damit die Putzkraft weiß, welcher Tisch abzuwischen ist.
  useEffect(()=>{
    const ctx=ctxRef.current
    if(!ctx)return
    ctx.moments.forEach((moment,id)=>{if(moment.phase==='seated')seatOf.current.set(id,{x:moment.spot.x,y:moment.spot.y})})
  },[nowMs])

  // Die echten Käufe der Schichtstunden, verdichtet auf den Einsatz (NOXIA-TIME-0001: Echtzeit-Ereignis fester Dauer).
  const shiftVisits=shift?compressPurchases(recentPurchases,shift.startedAtMs,shift.gameHours):[]
  const tasks:ShiftTask[]=shift?shiftTasks({role:shift.role,layout,taken:new Set(stationTaken),startedAtMs:shift.startedAtMs,nowMs,visits:shiftVisits,done:new Set(shiftDone)}):[]
  const shiftLeftS=shift?Math.max(0,Math.round(EINSATZ_S-(nowMs-shift.startedAtMs)/1000)):0

  const taskCount=(n:number)=>n===1?'1 Aufgabe':n+' Aufgaben'
  const blockedText=(employer:string,until:string)=>employer.charAt(0).toLocaleUpperCase('de-DE')+employer.slice(1)+' stellt dich hier bis '+new Date(until).toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'numeric'})+' nicht mehr ein: drei Schichten ohne eine erledigte Aufgabe.'
  async function startShift(role:ShiftRole){
    const ctx=ctxRef.current
    if(!ctx||shiftBusy)return
    setShiftBusy(true)
    try{
      let next:Shift={role,startedAtMs:Date.now(),shiftId:null,wagePerHour:jobs?.wages[role]??PROPOSED_WAGE_PER_HOUR[role],gameHours:SHIFT_GAME_HOURS[role]}
      if(jobs?.server){
        const r=await shiftApi({action:'start',role,referral:referral?.role===role?{by:referral.by,issuedAt:new Date(referral.issuedAtMs).toISOString()}:null})
        if(!r.ok){ctx.setStatus(String(r.data.error??'Die Stelle ist gerade nicht frei.'));return}
        next={role,startedAtMs:Date.parse(r.data.startedAt??new Date().toISOString()),shiftId:String(r.data.shiftId),wagePerHour:Number(r.data.wagePerHour??next.wagePerHour),gameHours:Number(r.data.gameHours??next.gameHours)}
      }
      setShift(next);setShiftDone([]);setShiftStats({tasks:0,guests:0,tips:0})
      if(referral?.role===role){saveReferral(null);setReferral(null)}
      const station=roleStation(layout,role,new Set(ctx.figures.filter(f=>f.roomRole==='staff').map(f=>f.spot.id)))
      setStationTaken([...new Set(ctx.figures.filter(f=>f.roomRole==='staff').map(f=>f.spot.id))])
      ctx.setStatus((referral?.role===role?'Von der Agentur vermittelt – ':'')+'Schicht als '+ROLE_LABEL[role]+' beginnt – dein Platz: '+station.label+'.')
      // Erst nach dem Umschalten gehen – vorher gilt noch die Einlasssperre des Clubs.
      setTimeout(()=>ctxRef.current?.walkTo(station),80)
    }finally{setShiftBusy(false)}
  }
  async function completeTask(task:ShiftTask,extra?:{music?:MusicStyle}){
    const ctx=ctxRef.current
    if(!ctx||!shift)return
    let tip=0
    let counted:number|null=null
    if(shift.shiftId){
      // Gezählt wird, was der Server annimmt – Lohn gibt es nur für Erledigtes.
      try{
        const r=await shiftApi({action:'task',shiftId:shift.shiftId,taskKey:task.key,kind:task.kind,guest:task.guest})
        if(!r.ok){ctx.setStatus(String(r.data.error??'Das zählt gerade nicht.'));return}
        tip=Number(r.data.tip??0);counted=typeof r.data.tasks==='number'?r.data.tasks:null
        if(typeof r.data.credits==='number')useGameStore.setState({credits:r.data.credits})
      }catch{ctx.setStatus('Keine Verbindung – versuch es gleich noch einmal.');return}
    }
    setShiftDone(current=>[...current,task.key].slice(-200))
    if(extra?.music)setMusic(extra.music)
    setShiftStats(current=>({tasks:counted??current.tasks+1,guests:current.guests+(task.guest?1:0),tips:current.tips+tip}))
    ctx.setStatus('Erledigt: '+task.label+(extra?.music?' – '+extra.music:'')+(tip>0?' · '+tip+' Cr Trinkgeld':'')+'.')
  }
  async function endShift(){
    const ctx=ctxRef.current
    if(!ctx||!shift||shiftBusy)return
    setShiftBusy(true)
    try{
      const worked=shiftWage(shift.wagePerHour,shift.gameHours,shift.startedAtMs,Date.now())
      if(shift.shiftId){
        const r=await shiftApi({action:'end',shiftId:shift.shiftId})
        if(r.ok){
          if(typeof r.data.credits==='number')useGameStore.setState({credits:r.data.credits})
          const standing=standingFrom(r.data.standing)
          ctx.setStatus(shiftEndText({employer:jobs?.employer??'der Betreiber',tasks:Number(r.data.tasks??shiftStats.tasks),required:Number(r.data.required??1),wage:Number(r.data.wage??0),full:Number(r.data.full??worked),deduction:Number(r.data.deduction??0),ownVenue:Boolean(r.data.ownVenue),shortPaid:Number(r.data.shortPaid??0),standing}))
          setJobs(current=>current?{...current,standing}:current)
        }else ctx.setStatus(String(r.data.error??'Die Schicht konnte nicht abgerechnet werden; sie wird später abgerechnet.'))
      }else ctx.setStatus('Probeschicht beendet: '+taskCount(shiftStats.tasks)+' erledigt. Lohn ('+worked+' Cr) gibt es, sobald Spieler hier angestellt werden können.')
      setShift(null)
    }finally{setShiftBusy(false)}
  }
  // Nach einer Spielstunde ist die Schicht vorbei.
  useEffect(()=>{if(shift&&shiftLeftS<=0)void endShift()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[shift?.startedAtMs,shiftLeftS<=0])

  // Direkt von der Agentur gekommen: Schicht antreten, sobald Stellen und Raum da sind.
  useEffect(()=>{
    if(!referralStart||autoStarted.current||!referral||!jobs||shift||!ctxRef.current)return
    autoStarted.current=true
    if(ctxRef.current.service==='closed'||underConversion||emptyHouse){ctxRef.current.setStatus('Vermittelt als '+referral.roleLabel+' – aber das Haus hat gerade geschlossen.');return}
    if(!jobs.open.includes(referral.role)){ctxRef.current.setStatus('Die vermittelte Stelle als '+referral.roleLabel+' ist inzwischen vergeben.');return}
    void startShift(referral.role)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[referralStart,referral,jobs,shift,nowMs])

  const renderJobs=(ctx:InteriorContext)=>{
    if(!jobs||roles.length===0||ctx.service==='closed'||underConversion||emptyHouse)return null
    const standing=jobs.standing
    const open=roles.filter(role=>jobs.open.includes(role)).sort((a,b)=>Number(b===referral?.role)-Number(a===referral?.role))
    return <div className="menu jobs">
      <small>ARBEITEN</small>
      {referral&&<p className="hint">{open.includes(referral.role)?'Von der Agentur vermittelt: '+referral.roleLabel+' – man erwartet dich.':'Vermittelt als '+referral.roleLabel+', aber die Stelle ist inzwischen vergeben.'}</p>}
      {standing?.blockedUntil?<p className="hint warn">{blockedText(jobs.employer,standing.blockedUntil)}</p>
      :standing?.nextShiftAt&&Date.parse(standing.nextShiftAt)>Date.now()?<p className="hint">Hier hattest du eben eine Schicht. Die nächste gibt es ab {new Date(standing.nextShiftAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} Uhr – oder in einem anderen Lokal.</p>
      :open.length===0?<p className="hint">Gerade ist hier keine Stelle frei.</p>:<>
        <p className="hint">{'Ein Einsatz dauert '+Math.round(EINSATZ_S/60)+' Minuten und zählt als ganze Schicht. '+(!jobs.server?'Noch Probeschicht ohne Lohn.':jobs.ownVenue?'Im eigenen Haus ohne Lohn.':'Lohn zahlt '+jobs.employer+' nur für Erledigtes: ab drei Vierteln der Aufgaben voll, darunter weniger, ohne Aufgabe nichts.')}</p>
        {standing&&standing.emptyStreak>0&&<p className="hint warn">{(standing.emptyStreak===1?'Deine letzte Schicht':'Deine letzten zwei Schichten')+' hier: nichts erledigt. Nach drei solchen stellt man dich hier eine Woche nicht mehr ein.'}</p>}
        {open.map(role=><button key={role} className="tile-row" disabled={shiftBusy} onClick={()=>void startShift(role)} title={ROLE_DUTY[role]}>
          <span>{role===referral?.role?'Vermittelt: ':''}{ROLE_LABEL[role]} · {SHIFT_GAME_HOURS[role]} Std</span><b>{(jobs.wages[role]??PROPOSED_WAGE_PER_HOUR[role])*SHIFT_GAME_HOURS[role]} Cr{jobs.server?'':' (Vorschlag)'}</b><small>{ROLE_DUTY[role]}</small>
        </button>)}
      </>}
    </div>
  }
  const renderShift=(ctx:InteriorContext)=>{
    if(!shift)return null
    const clock=Math.floor(shiftLeftS/60)+':'+String(shiftLeftS%60).padStart(2,'0')
    const near=(task:ShiftTask)=>Math.hypot(ctx.pos.x-task.at.x,ctx.pos.y-task.at.y)<46
    return <div className="menu shift">
      <small>SCHICHT · {ROLE_LABEL[shift.role].toUpperCase()}{shift.shiftId?'':' · PROBE'}</small>
      {shift.shiftId&&!jobs?.ownVenue&&(()=>{const pay=shiftPay({role:shift.role,wagePerHour:shift.wagePerHour,gameHours:shift.gameHours,playedS:(nowMs-shift.startedAtMs)/1000,tasksDone:shiftStats.tasks});const atEnd=shiftPay({role:shift.role,wagePerHour:shift.wagePerHour,gameHours:shift.gameHours,playedS:EINSATZ_S,tasksDone:shiftStats.tasks});return <p className={'hint'+(shiftStats.tasks===0?' warn':'')}>{shiftStats.tasks===0?'Noch nichts erledigt – für Nichtstun gibt es kein Geld.':'Bisher verdient: '+pay.wage+' Cr.'} Für den vollen Lohn ({atEnd.full} Cr) braucht es bis zum Ende {atEnd.required} Aufgaben.</p>})()}
      <p>Noch {clock} · zählt als {shift.gameHours} Spielstunden · {shiftStats.tasks} erledigt{shiftStats.guests?' · '+shiftStats.guests+' Gäste':''}{shiftStats.tips?' · '+shiftStats.tips+' Cr Trinkgeld':''}{shift.role==='dj'?' · läuft: '+music:''}</p>
      {tasks.length===0&&<p className="hint">Gerade ist nichts zu tun. {ROLE_DUTY[shift.role]}.</p>}
      {tasks.slice(0,4).map(task=><div key={task.key} className="task">
        <span>{task.label}</span>
        {task.kind==='music'
          ?(near(task)?<div className="for">{MUSIC_STYLES.map(style=><button key={style} className={style===music?'on':''} onClick={()=>void completeTask(task,{music:style})}>{style}</button>)}</div>:<button onClick={()=>ctx.walkTo(task.at)}>Hingehen</button>)
          :near(task)?<button onClick={()=>void completeTask(task)}>Erledigen</button>:<button onClick={()=>ctx.walkTo(task.at)}>Hingehen</button>}
      </div>)}
      <button className="open-school" disabled={shiftBusy} onClick={()=>void endShift()}>Schicht beenden</button>
    </div>
  }

  const customerOffer=(ctx:InteriorContext)=>{
      const hasMenu=Boolean(menu?.items.length)&&ctx.service!=='closed'
      // Nachtclub ohne Eintritt: nur die Kasse an der Tür.
      if(layout.entry&&!entryPaid&&ctx.service!=='closed'){
        const atDoor=Math.hypot(ctx.pos.x-layout.entry.payAt.x,ctx.pos.y-layout.entry.payAt.y)<56
        if(!atDoor)return <p className="hint">Der Türsteher lässt nur mit Eintritt herein.</p>
        return <div className="menu">
          <small>EINTRITT</small>
          {menuState==='loading'&&<p>Die Preise werden geholt …</p>}
          {menuState!=='loading'&&!entryItem&&<p>Ohne Eintritt kommt niemand rein – und kassieren kann hier noch niemand.</p>}
          {entryItem&&menu&&<>
            <p>Du hast {menu.credits} Credits. Der Eintritt gilt die ganze Nacht.</p>
            <button className="open-school" disabled={!entryItem.affordable||ordering!==null} onClick={()=>{setTreat(false);void order(entryItem)}}>Eintritt bezahlen – {entryItem.priceCredits} Cr{entryItem.affordable?'':' (zu teuer)'}</button>
          </>}
        </div>
      }
      if(!ctx.nearService)return <p className="hint">{ctx.seat&&ctx.tablePhase!=='none'&&ctx.tablePhase!=='gone'?'Jemand vom Personal kommt gleich an deinen Tisch.':ctx.seat&&ctx.service==='staffed'&&layout.kind!=='hotel'?'Bleib sitzen – gleich kommt jemand an den Tisch.':'Zum Bestellen musst du '+(ctx.service==='self-service'?'am Automaten':layout.servicePoint.locative)+' stehen.'}</p>
      // Im Gespräch mit dem Personal Genanntes: ein Knopf je Posten, erst der bucht.
      const talkingToStaff=Boolean(ctx.selected&&ctx.shown.some(entry=>entry.resident.id===ctx.selected!.id&&entry.figure.roomRole==='staff'))
      const spokenText=ctx.lastPlayerText
      const spoken=hasMenu&&menu&&talkingToStaff?spokenOrderItems(spokenText,menu.items.filter(item=>item.itemCode!==ENTRY_ITEM_CODE)).filter(o=>!spokenDone.includes(spokenText+'|'+o.itemCode)):[]
      return <div className="menu">
        {spoken.length>0&&menu&&<div className="spoken">
          <small>IM GESPRÄCH GENANNT</small>
          {spoken.map(o=>{const item=menu.items.find(entry=>entry.itemCode===o.itemCode)!;return <button key={o.itemCode} className="open-school" disabled={!item.affordable||ordering!==null||(o.itemCode===ROOM_ITEM_CODE&&!canBookRoom(rooms))} onClick={()=>{if(o.itemCode===ROOM_ITEM_CODE)setTreat(false);void order(item,{title:spokenOrderTitle(o),key:spokenText+'|'+o.itemCode})}}>{spokenOrderTitle(o)} {o.itemCode===ROOM_ITEM_CODE?'buchen':'bestellen'} – {item.priceCredits} Cr{item.affordable?'':' (zu teuer)'}</button>})}
        </div>}
        <small>KARTE</small>
        {menuState==='loading'&&<p>Die Karte wird geholt …</p>}
        {menuState==='failed'&&<p>Die Karte konnte nicht geladen werden. Verlasse das Lokal und komm noch einmal herein.</p>}
        {menuState==='ready'&&!hasMenu&&<p>Hier gibt es noch keine Karte.</p>}
        {hasMenu&&menu&&<>
          <p>Du hast {menu.credits} Credits.</p>
          {ctx.selected&&ctx.shown.some(entry=>entry.resident.id===ctx.selected!.id)&&<div className="for">
            <button className={treat?'':'on'} onClick={()=>setTreat(false)}>Für mich</button>
            <button className={treat?'on':''} onClick={()=>setTreat(true)}>Für {personSceneLabel(ctx.selected)}</button>
          </div>}
          <div className="tiles">{menu.items.filter(item=>item.itemCode!==ROOM_ITEM_CODE&&item.itemCode!==ENTRY_ITEM_CODE).map(item=><button key={item.itemCode} className="tile" disabled={!item.affordable||ordering!==null} onClick={()=>void order(item)} title={item.affordable?item.label:'Dafür reichen deine Credits nicht.'}>
            <HospitalityItemIcon code={item.itemCode} size={44} title={item.label}/>
            <span>{item.label}</span><b>{item.priceCredits} Cr</b>
            {!item.affordable&&<small>zu teuer</small>}
          </button>)}</div>
          {(()=>{const room=menu.items.find(item=>item.itemCode===ROOM_ITEM_CODE);if(!room)return null;const free=rooms?roomsFree(rooms):0;return <div className="rooms">
            <small>ZIMMER</small>
            {rooms?.mineForS!=null?<p>Du hast hier ein Zimmer, noch etwa {Math.max(1,Math.round(rooms.mineForS/3600))} Stunden.</p>:<p>{rooms?rooms.capacity+' Zimmer, '+free+' frei.':'Ob ein Zimmer frei ist, weiß gerade niemand.'}</p>}
            <button className="tile" disabled={!room.affordable||ordering!==null||!canBookRoom(rooms)} onClick={()=>{setTreat(false);void order(room)}} title={room.affordable?'Zimmer für eine Nacht':'Dafür reichen deine Credits nicht.'}>
              <HospitalityItemIcon code={ROOM_ITEM_CODE} size={40} title="Zimmer"/>
              <span>Zimmer für eine Nacht</span><b>{room.priceCredits} Cr</b>
              {!room.affordable&&<small>zu teuer</small>}
            </button>
          </div>})()}
        </>}
      </div>
    }

  const fitting:InteriorFitting={
    kind:layout.kind,layout,noun:layout.noun,locative:layout.locative,sectionLabel:'LOKAL',
    headerNote:playerHour!==null?(hours.clock==='player'?'Ortszeit ':'Koloniezeit ')+playerHour+' Uhr · geöffnet '+venueHoursText(kind,hours):undefined,
    service,
    closedText:figures=>{
      if(underConversion)return{headline:'IM UMBAU',detail:'Dieses Haus wird gerade zum '+layout.noun+' umgebaut'+(readyText?'; fertig etwa '+readyText+'.':'.')+' Bis dahin ist hier Baustelle.'}
      if(emptyHouse)return{headline:'LEER',detail:'Dieses Haus gehört jemandem, hat aber noch keine Nutzung. Ein Umbau zum Lokal wird auf der Karte am Gebäude beauftragt.'}
      const reason=venueClosedReason(layout,figures,playerHour,hours)
      if(!reason)return null
      return reason==='hours'
        ?{headline:'GESCHLOSSEN',detail:'Dieses Lokal hat gerade geschlossen. Geöffnet ist '+venueHoursText(kind,hours)+' '+clockLabel(hours)+'; jetzt ist es '+playerHour+' Uhr.'+canteenHint}
        :{headline:'GESCHLOSSEN',detail:'Dieses Lokal ist geschlossen: Hier arbeitet gerade niemand. Ohne Personal gibt es weder Ausschank noch Gäste.'}
    },
    furnitureLabel:(kind,svc)=>kind==='counter'?(svc==='self-service'?'AUTOMAT':'TRESEN'):kind==='kitchen'?'KÜCHE':kind==='desk'?'EMPFANG':kind==='stairs'?(hasUpperFloor(upper)?(upper.guestRooms>0?'ZIMMER ↑':'PRIVAT ↑'):layout.kind==='hotel'?'ZIMMER ↑':null):null,
    decor:DECOR[layout.kind],
    counterDressing:<><i className="machine"/><i className="vitrine"><HospitalityItemIcon code="cake" size={14}/><HospitalityItemIcon code="snack" size={14}/></i></>,
    visits,
    facts:(self,ctx)=>venueConversationFacts({
      layout,buildingName:houseName,self,figures:ctx.figures,servingPlayer:self.id===ctx.waiterId&&ctx.atTable,playerPos:ctx.pos,playerSeat:ctx.seat,joinedPlayer:ctx.joined===self.id,arrivalPoint,
      menu:menu?.items.length&&ctx.service!=='closed'?menu.items:[],
      playerOrders:orders.filter(entry=>entry.forId!==self.id).map(entry=>entry.label),
      giftsToSelf:orders.filter(entry=>entry.forId===self.id).map(entry=>entry.label),
      ownOrder:ctx.moments.has(self.id)?visits.find(visit=>visit.resident.id===self.id)?.label??null:null,
      hour:playerHour,hours,upper,rooms,
      toilet:underConversion||emptyHouse?null:serviceRules.toilet,playerSaid:ctx.lastPlayerText,playerDancing:ctx.dancing,
      entry:layout.entry?{price:entryItem?.priceCredits??null,paid:entryPaid||Boolean(shift)}:null,
      playerWorkingFact:shift?workingFact(shift.role,self.roomRole==='staff'):venueReferralFacts(referral,self.roomRole==='staff',false)[0]??null,
      // Lohn und Ruf im Haus erklärt das Personal im Namen des Betreibers (Thomas, 30.10.2026).
      employmentFacts:self.roomRole==='staff'&&jobs?.server&&!jobs.ownVenue?employerShiftFacts({employer:jobs.employer,standing:jobs.standing,working:Boolean(shift),paid:true}):[],
    }),
    placeKnowledge,
    // Mitbekommenes hat nur, wer hier arbeitet und den ganzen Tag zuhört.
    hearsay:self=>self.roomRole==='staff'?heard:[],
    // Jedes Haus führt Neue auf seine Art ein – nur wer hier arbeitet.
    introduction:self=>self.roomRole==='staff'?venueIntroduction(kind,upper?.guestRooms??0):undefined,
    things,
    idleText:menuState==='ready'&&menu?.items.length?undefined:undefined,
    greetsAtService:true,
    goToServiceLabel:svc=>svc==='self-service'?'Zum Automaten gehen':layout.servicePoint.locative==='am Empfang'?'Zum Empfang gehen':'Zum Tresen gehen',
    tableService:true,
    loaded:true,
    markers:shift?tasks.slice(0,4).map(task=>({key:task.key,x:task.at.x,y:task.at.y,label:task.label})):[],
    playerTag:shift?ROLE_LABEL[shift.role]:null,
    floorMood:layout.danceFloor&&(shift?.role==='dj'||music!=='House')?music.toLowerCase():null,
    gate:layout.entry?{open:entryPaid||Boolean(shift),blockedText:entryItem?'Erst Eintritt bezahlen – beim Türsteher an der Tür ('+entryItem.priceCredits+' Cr).':'Ohne Eintritt kommt hier niemand rein; bezahlen kann man ihn noch nicht.'}:null,
    sideDoor:underConversion||emptyHouse||!serviceRules.toilet.available?null:{...VENUE_WC_DOOR,label:'WC',goLabel:'Zur Toilette',useLabel:'WC BENUTZEN',use:ctx=>ctx.setStatus(toiletAccess(serviceRules.toilet,{hasOrdered:orders.length>0}).text)},
    renderOffer:ctx=>shift?renderShift(ctx):<>{customerOffer(ctx)}{renderJobs(ctx)}</>,
  }

  return <WalkableInterior entityId={entityId} buildingName={houseName} companion={companion} onClose={onClose} fitting={fitting} onContext={ctx=>{ctxRef.current=ctx}}/>
}
