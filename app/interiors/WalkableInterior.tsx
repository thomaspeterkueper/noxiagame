'use client'

// app/interiors/WalkableInterior.tsx
// Aktualisiert: 06.11.2026 — Bedienung am Tisch im Seitenfeld ansprechbar („Mit … sprechen“), zurück zur Begleitung; 28.10.2026 — Laufweg der Spielfigur für die Verhaltensaufzeichnung der Testphase
// Version:      1.1.1
// Ein Bedienmodell für alle Gebäude (NOXIA-INTERIOR-0001): Bewegung, Hinsetzen,
// Wege um die Möbel, Personen wählen, Porträt und Gespräch, Bedienplatz mit
// Begrüßung, Besucher, die kommen und gehen, rechte Tafel mit dem Nötigen.
// Was ein Gebäude unterscheidet – Einrichtung, Wissen, Angebot – kommt als
// `fitting` herein (InteriorFitting). Die Gastronomie ist die erste Einrichtung
// (app/earth/CafeWalkableInterior.tsx); Akademie, Verwaltung, Hafen können folgen.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { reportPlayerPosition } from '@/lib/telemetry/playerActivity'
import { NpcVisualStyles } from '@/lib/grid/NpcVisual'
import { PersonPortrait } from '@/lib/grid/PersonPortrait'
import { RobotFigure, RobotPortrait, isRobot } from '@/lib/grid/RobotVisual'
import { personSceneLabel } from '@/lib/game/population/personSceneLabel'
import { learningGatesFor, type LearningNeed } from '@/lib/game/interiors/learningGates'
import SsfModuleRenderer from '@/app/academy/learn/SsfModuleRenderer'
import type { ColonyResident } from '@/lib/store/colonyStateStore'
import type { DecorItem } from '@/lib/game/hospitality/furnishing'
import { useGameStore } from '@/lib/store/gameStore'
import { useRoomPresence, type PeerState } from '@/lib/multiplayer/roomPresence'
import { KieselFigure, useMyLook } from '@/lib/figures/KieselFigure'
import FigureEditor from '@/lib/figures/FigureEditor'
import { cleanPlayerLook, lookAtWork } from '@/lib/figures/playerLook'
import { kieselDirFrom, kieselLookFor, type KieselDir, type KieselPose } from '@/lib/figures/kiesel'
import { useRoomChat } from '@/lib/multiplayer/useRoomChat'
import { WHISPER_RANGE_PX, heardAt, type ChatRange } from '@/lib/multiplayer/roomChat'
import { FOLLOW_JOINTS, GESTURES, JOINTS, acceptedBy, sidePose, besidePartner, faceTowards, gestureState, invitesFor, jointState, npcJointDecision, parseGestureCommand, poseNow, type GestureName, type InviteState, type JointName, type NpcJointContext, type PoseState } from '@/lib/multiplayer/gestures'
import {
  VENUE_PLAYER_RADIUS,
  isVenueBlocked,
  guestMoment,
  isAtServicePoint,
  placeVenueFigures,
  venuePath,
  freeSeats,
  nearestFreeSeat,
  seatForGuest,
  tableServicePhase,
  tableServiceSpot,
  onDanceFloor,
  entryAllows,
  companionPlace,
  type VenueLayout,
  type VenueSpot,
  type VenueService,
  type GuestMoment,
  type VenueFigure,
  type TableServicePhase,
} from '@/lib/game/hospitality/venues'
import ConversationReport from '@/app/components/ConversationReport'

/** Mitte der breitesten freien Wandfläche zwischen den Fenstern – dort hängt die Leuchtschrift. */
function signSpot(windows:readonly{x:number;w:number}[],width=760):number{
  const edges=[...windows].sort((a,b)=>a.x-b.x)
  let best={from:0,to:0},last=0
  for(const w of [...edges,{x:width,w:0}]){if(w.x-last>best.to-best.from)best={from:last,to:w.x};last=Math.max(last,w.x+w.w)}
  return Math.round((best.from+best.to)/2)
}

export type Point = { x:number; y:number }
export type ShownFigure = { figure:VenueFigure; resident:ColonyResident; moment:GuestMoment|null }
/** Ein Besucher, der wirklich hier war (z. B. ein Kauf): Alter zum Zeitpunkt des Abrufs. */
export type Visit = { resident:ColonyResident; ageSeconds:number; fetchedAt:number; label:string }
/** Etwas, das sichtbar im Raum steht – beim Spieler, bei einer Person oder an einem Punkt. */
export type PlacedThing = { key:string; icon:ReactNode; title:string; forId:string|null; at:number; broughtToTable:boolean }
/** Eine Lernschwelle des Hauses mit dem Stand des Spielers (/api/game/learning/gates). */
export type GateView = { id:string; label:string; moduleTitle:string; need:LearningNeed; why:string; open:boolean; moduleId:string|null }

/** Was der Motor der Einrichtung über den Augenblick erzählt. */
export interface InteriorContext {
  pos:Point
  seat:VenueSpot|null
  atTable:boolean
  nearService:boolean
  closed:boolean
  service:VenueService
  selected:ColonyResident|null
  shown:ShownFigure[]
  figures:VenueFigure[]
  moments:Map<string,GuestMoment>
  joined:string|null
  waiterId:string|null
  tablePhase:TableServicePhase
  nowMs:number
  setStatus:(text:string)=>void
  setSelected:(resident:ColonyResident|null)=>void
  /** Lernschwellen des Hauses; leer, solange nicht geladen oder keine. */
  gates:GateView[]
  /** Öffnet das Lernmodul einer Schwelle im Raum. */
  openLearning:(gateId:string)=>void
  /** Spricht eine Person an – sie eröffnet das Gespräch. */
  talkTo:(resident:ColonyResident)=>void
  /** Das laufende Gespräch mit der gewählten Person. */
  history:Array<{role:'user'|'assistant';content:string}>
  /** Was der Spieler zuletzt gesagt hat – während einer Wortmeldung die neue. */
  lastPlayerText:string|null
  /** Tanzt der Spieler gerade (Tanzfläche im Nachtclub)? */
  dancing:boolean
  /** Zu einem Punkt im Raum gehen (Wege um die Möbel). */
  walkTo:(target:Point,onArrive?:()=>void)=>void
  /** Sagt der gewählten Person einen Satz (z. B. Beileid), als hätte der Spieler ihn getippt. */
  say:(text:string)=>void
  /** Wer mit dem Spieler gekommen ist und was draußen zuletzt ausgemacht wurde. */
  companion:{id:string;label:string;plan:string|null}|null
}
/** Eine Tür an der Eingangswand neben dem Ausgang (z. B. WC): gehen, benutzen. */
export interface SideDoor { x:number; y:number; label:string; goLabel:string; useLabel:string; use:(ctx:InteriorContext)=>void }

/** Die Einrichtung eines Gebäudes: Grundriss, Stil, Betrieb, Wissen und Angebot. */
export interface InteriorFitting {
  /** CSS-Klasse des Raums (cafe, bar, restaurant, hotel, …) – bestimmt Boden, Wand, Licht. */
  kind:string
  layout:VenueLayout
  /** „Café“ / „im Café“ – für Kopfzeile und Gespräch. */
  noun:string
  locative:string
  /** Kleine Zeile über der Tafel, z. B. „LOKAL“, „AKADEMIE“. */
  sectionLabel:string
  /** Kopfzeile rechts neben den Bedienhinweisen, z. B. Uhrzeit und Öffnungszeit. */
  headerNote?:string
  /** Betrieb: staffed, self-service, closed – aus Personal und Uhrzeit. */
  service:(figures:readonly VenueFigure[])=>VenueService
  /** Warum geschlossen, als Satz für die Tafel; null = offen. */
  closedText:(figures:readonly VenueFigure[])=>{headline:string;detail:string}|null
  /** Beschriftungen der Möbel (TRESEN, EMPFANG, KÜCHE, ZIMMER ↑). */
  furnitureLabel:(kind:string,service:VenueService)=>string|null
  /** Dekor: Pflanzen und Teppich – nur Bild. */
  decor?:{plants:Array<[number,number]>;rug:{x:number;y:number;w:number;h:number}|null}
  /** Was auf dem Tresen steht (Maschine, Vitrine). */
  counterDressing?:ReactNode
  /** Besucher aus echten Daten (Käufe). */
  visits:Visit[]
  /** Fakten einer Figur für das Gespräch – nur, was sie von ihrem Platz aus weiß. */
  facts:(self:VenueFigure,ctx:InteriorContext)=>string[]
  placeKnowledge:string[]
  hearsay:(self:VenueFigure)=>string[]
  introduction:(self:VenueFigure)=>unknown
  /** Was im Raum steht (Bestelltes). */
  things:PlacedThing[]
  /** Für den Eigentümer, auch wenn geschlossen ist (Einrichten vor dem Öffnen). */
  renderOwner?:(ctx:InteriorContext)=>ReactNode
  /** Das Angebot in der Tafel (Karte, Zimmer, Kurse) – gezeichnet von der Einrichtung. */
  renderOffer:(ctx:InteriorContext)=>ReactNode
  /** Zeile unter dem Tafeltext, wenn nichts gewählt ist. */
  idleText?:string
  /** Begrüßt das Personal am Bedienplatz von sich aus? */
  greetsAtService:boolean
  /** Knopftext für den Weg zum Bedienplatz. */
  goToServiceLabel:(service:VenueService)=>string
  /** Bedienung am Tisch möglich? */
  tableService:boolean
  loaded:boolean
  /** Nach einem abgeschlossenen Lernmodul (z. B. Kontostand neu holen). */
  onLearned?:(gateId:string)=>void
  /** Weitere Tür an der Eingangswand (WC). */
  sideDoor?:SideDoor|null
  /** Einlass (layout.entry): offen, wenn Eintritt bezahlt ist; sonst bleibt man an der Tür. */
  gate?:{open:boolean;blockedText:string}|null
  /** Marken im Raum (z. B. Aufgaben einer Schicht). */
  markers?:Array<{key:string;x:number;y:number;label:string}>
  /** Zusatz am Spieler, z. B. „Barkeeper“, solange er hier arbeitet. */
  playerTag?:string|null
  /** Einrichten (Eigentümer, 05.11.2026): Schmuck immer zeigen; beim Einrichten ziehen. */
  furnish?:{editing:boolean;decor:readonly DecorItem[];onMoveTable?:(id:string,x:number,y:number)=>void;onMoveDecor?:(id:string,x:number,y:number)=>void;onRemoveDecor?:(id:string)=>void}
  /** Hausrecht: Der Eigentümer kann einem Mitspieler Hausverbot geben. */
  banPeer?:(peer:PeerState,hours:number)=>void
  banChoices?:Array<[number,string]>
  /** Was die Einrichtung über eine Figur für gemeinsame Bewegungen weiß (Trauer, Beileid). */
  jointContext?:(personId:string)=>Partial<Pick<NpcJointContext,'mourning'|'condoled'>>
  /** Leuchtschrift an der Rückwand (2,5D), z. B. der Name des Cafés. */
  wallSign?:string|null
  /** Servierroboter, der Bestellungen vom Tresen an die Tische bringt (moderne Cafés). */
  serviceRobot?:boolean
  /** Pose aus einem Ereignis (Rangelei, Kampf; R-32) – vor allen anderen. */
  poseFor?:(personId:string)=>{pose:KieselPose;verletzt:boolean}|null
  /** Stimmung der Tanzfläche (Musikstil des DJ), als CSS-Klasse. */
  floorMood?:string|null
  /** Zusätzliche Figuren ohne Personeneintrag, z. B. ein Roboter (Kennung „robot:…“). */
  extraResidents?:ColonyResident[]
}

export type Props = {
  entityId:string
  buildingName:string
  companion?:ColonyResident|null
  onClose:()=>void
  fitting:InteriorFitting
  /** Die Einrichtung bekommt den Kontext, um Fakten und Angebot zu bauen. */
  onContext?:(ctx:InteriorContext)=>void
  /** Von außen angefordertes Lernmodul (z. B. aus dem Bankschalter). */
  learnRequest?:{gateId:string;at:number}|null
  /** Das Gespräch mit der Begleitung von draußen – es geht drinnen weiter. */
  companionHistory?:Array<{role:'user'|'assistant';content:string}>
}

const SPEED=12
const BRING_S=9

/** Servierroboter (06.11.2026): eigenes, schlichtes Design – weißer Körper, zwei Tablettfächer, Bildschirmgesicht. */
function ServeRobotSVG(){
  return <svg viewBox="0 0 48 80" width="40" height="66" aria-hidden="true" style={{display:'block',overflow:'visible'}}>
    <ellipse cx="24" cy="77" rx="15" ry="3.5" fill="#0006"/>
    <rect x="11" y="66" width="26" height="10" rx="5" fill="#3a4148"/>
    <rect x="13" y="22" width="22" height="47" rx="9" fill="#f4f6f7"/>
    <rect x="23" y="22" width="12" height="47" rx="6" fill="#00000010"/>
    <rect x="6" y="34" width="36" height="4" rx="2" fill="#d9b98f"/><rect x="6" y="50" width="36" height="4" rx="2" fill="#d9b98f"/>
    <g className="cargo"><rect x="13" y="27" width="7" height="7" rx="1.5" fill="#e8c35a"/><rect x="13" y="25.5" width="7" height="2" rx="1" fill="#fbf6e6"/><ellipse cx="30" cy="33" rx="6" ry="1.6" fill="#fff"/><path d="M26 32.5 q4 -4 8 0z" fill="#c98a5a"/></g>
    <rect x="12" y="4" width="24" height="18" rx="8" fill="#f4f6f7"/>
    <rect x="15" y="7" width="18" height="12" rx="5" fill="#16252b"/>
    <path d="M19 13 q2 -2.4 4 0 M25 13 q2 -2.4 4 0" stroke="#7fe0ff" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
    <rect x="22" y="0" width="4" height="4" rx="2" fill="#7fe0ff"/>
  </svg>
}

export default function WalkableInterior({entityId,buildingName,companion=null,onClose,fitting,onContext,learnRequest=null,companionHistory=[]}:Props){
  const {layout}=fitting
  const[pos,setPos]=useState<Point>(layout.start)
  const[residents,setResidents]=useState<ColonyResident[]>([])
  const[selected,setSelectedRaw]=useState<ColonyResident|null>(()=>companion&&companionHistory.length?companion:null)
  const[message,setMessage]=useState('')
  // Credits bar geben (04.11.2026): an die Person, mit der man gerade spricht.
  const[giveOpen,setGiveOpen]=useState(false)
  const[giveAmount,setGiveAmount]=useState('5')
  const[giving,setGiving]=useState(false)
  const lastGift=useRef<{personId:string;amount:number;at:number}|null>(null)
  // Gesten und gemeinsame Bewegungen (Second-Life-Mechanik, 04.11.2026).
  const[myPose,setMyPoseRaw]=useState<PoseState|null>(null)
  const poseFrom=useRef<{x:number;y:number}|null>(null)
  const[myInvite,setMyInvite]=useState<InviteState|null>(null)
  const[npcJoint,setNpcJoint]=useState<{id:string;state:PoseState}|null>(null)
  const[declined,setDeclined]=useState<string[]>([])
  const lastGesture=useRef<{personId:string|null;text:string;at:number}|null>(null)
  const lastJoint=useRef<{personId:string;action:JointName;at:number}|null>(null)
  // Einrichten: ziehen im Raum (Koordinaten des Raums, 760 × 470).
  const roomRef=useRef<HTMLDivElement|null>(null)
  // 2,5D (Thomas, 06.11.2026: „sieht schon super aus, sollten wir so umsetzen, mit Namen, gerne auch etwas futuristischer“).
  // Der Raum wird mit CSS-3D schräg gestellt (orthografisch, wie die Karte); Koordinaten bleiben Raumkoordinaten.
  // Figuren, Namen und Knöpfe stehen aufrecht zur Kamera. Die Draufsicht bleibt als Ausweichansicht.
  const[iso,setIso]=useState(true)
  useEffect(()=>{try{if(localStorage.getItem('noxia.interiorView')==='flat')setIso(false)}catch{}},[])
  const toggleView=()=>setIso(v=>{const next=!v;try{localStorage.setItem('noxia.interiorView',next?'iso':'flat')}catch{};return next})
  const stageRef=useRef<HTMLDivElement|null>(null)
  const[fit,setFit]=useState(1)
  useEffect(()=>{const el=stageRef.current;if(!el||typeof ResizeObserver==='undefined')return;const ro=new ResizeObserver(([e])=>{const r=e.contentRect;setFit(Math.max(.4,Math.min(1.6,r.width/900,r.height/600)))});ro.observe(el);return()=>ro.disconnect()},[iso])
  const pins=useRef<Array<HTMLDivElement|null>>([])
  // Servierroboter: fährt vom Tresen an besetzte Tische und zurück (nur 2,5D, nur wenn geöffnet).
  const seatedRef=useRef<Point[]>([])
  const[robot,setRobot]=useState<{x:number;y:number;flip:boolean;carrying:boolean}|null>(null)
  const robotRef=useRef<{x:number;y:number;path:Point[];wait:number;phase:'home'|'out'|'back';flip:boolean;carrying:boolean}|null>(null)
  // Kamera (06.11.2026, „sollte größer sein“): näher heran, folgt der Figur; Mausrad oder +/− zoomt.
  const[zoom,setZoomRaw]=useState(1.35)
  useEffect(()=>{try{const z=Number(localStorage.getItem('noxia.interiorZoom'));if(z>=.8&&z<=2.6)setZoomRaw(z)}catch{}},[])
  const robotOn=useRef(false)
  useEffect(()=>{
    if(!fitting.serviceRobot)return
    const home={x:layout.servicePoint.x+(layout.servicePoint.x>layout.width/2?-34:34),y:layout.servicePoint.y+22}
    const id=setInterval(()=>{
      if(!robotOn.current){if(robotRef.current){robotRef.current=null;setRobot(null)}return}
      const r=robotRef.current??(robotRef.current={...home,path:[],wait:1500,phase:'home',flip:false,carrying:false})
      if(r.path.length){
        const t=r.path[0],dx=t.x-r.x,dy=t.y-r.y,d=Math.hypot(dx,dy),v=4.6
        if(Math.abs(dx+dy)>.5)r.flip=(dx+dy)<0
        if(d<=v){r.x=t.x;r.y=t.y;r.path.shift();if(!r.path.length)r.wait=r.phase==='out'?2600:3200}
        else{r.x+=dx/d*v;r.y+=dy/d*v}
      }else if(r.wait>0)r.wait-=60
      else if(r.phase==='home'){
        const seats=seatedRef.current
        if(!seats.length){r.wait=4000}
        else{
          const seat=seats[Math.floor(Math.random()*seats.length)]
          const cx=layout.width/2,cy=layout.height/2,len=Math.hypot(cx-seat.x,cy-seat.y)||1
          const target={x:seat.x+(cx-seat.x)/len*26,y:seat.y+(cy-seat.y)/len*26}
          const path=venuePath(layout,{x:r.x,y:r.y},target)
          if(path.length>1){r.path=path.slice(1);r.phase='out';r.carrying=true}else r.wait=2000
        }
      }else if(r.phase==='out'){r.carrying=false;r.path=venuePath(layout,{x:r.x,y:r.y},home).slice(1);r.phase='back'}
      else{r.phase='home';r.wait=2500+Math.random()*3000}
      setRobot({x:r.x,y:r.y,flip:r.flip,carrying:r.carrying})
    },60)
    return()=>clearInterval(id)
  },[fitting.serviceRobot,layout])
  const setZoom=(z:number)=>{const v=Math.max(.8,Math.min(2.6,Math.round(z*100)/100));setZoomRaw(v);try{localStorage.setItem('noxia.interiorZoom',String(v))}catch{}}
  const isoRef=useRef(true);isoRef.current=iso
  const dragging=useRef<{kind:'table'|'decor';id:string;dx:number;dy:number}|null>(null)
  const roomPoint=(e:{clientX:number;clientY:number})=>{
    const c=pins.current.map(el=>{const r=el?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null})
    if(!c[0]||!c[1]||!c[2])return{x:0,y:0}
    // Bildschirm = o + x·u + y·v  (u, v je Raumpunkt)  →  nach x, y auflösen
    const W=layout.width,H=layout.height,o=c[0],u={x:(c[1].x-o.x)/W,y:(c[1].y-o.y)/W},v={x:(c[2].x-o.x)/H,y:(c[2].y-o.y)/H}
    const det=u.x*v.y-u.y*v.x;if(Math.abs(det)<1e-9)return{x:0,y:0}
    const dx=e.clientX-o.x,dy=e.clientY-o.y
    return{x:(dx*v.y-dy*v.x)/det,y:(u.x*dy-u.y*dx)/det}
  }
  const startDrag=(kind:'table'|'decor',id:string,at:{x:number;y:number})=>(e:React.PointerEvent)=>{e.stopPropagation();e.preventDefault();const p=roomPoint(e);dragging.current={kind,id,dx:p.x-at.x,dy:p.y-at.y};(e.currentTarget as Element).setPointerCapture?.(e.pointerId)}
  const moveDrag=(e:React.PointerEvent)=>{const d=dragging.current;if(!d)return;const p=roomPoint(e);const x=Math.round(p.x-d.dx),y=Math.round(p.y-d.dy);if(d.kind==='table')fitting.furnish?.onMoveTable?.(d.id,x,y);else fitting.furnish?.onMoveDecor?.(d.id,x,y)}
  const endDrag=()=>{dragging.current=null}
  // Andere Spieler im selben Raum (04.11.2026).
  const[me,setMe]=useState<{profileId:string;name:string}|null>(null)
  const[peerId,setPeerId]=useState<string|null>(null)
  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const{token,userId}=await getSessionInfo()
        if(!token||!userId)return
        const response=await fetch('/api/game/profile',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const data=await response.json().catch(()=>({}))
        if(live)setMe({profileId:userId,name:String(data?.profile?.username??'Spieler')})
      }catch{/* ohne Profil keine Anwesenheit */}
    })()
    return()=>{live=false}
  },[])
  const[historyState,setHistory]=useState<Array<{role:'user'|'assistant';content:string}>>(()=>companion&&companionHistory.length?companionHistory.slice(-6):[])
  // Jedes Gespräch bleibt beim Wechsel erhalten (03.11.2026): wer zur Bedienung und
  // zurück zur Begleitung geht, setzt das Gespräch fort, statt neu anzufangen.
  const histories=useRef(new Map<string,Array<{role:'user'|'assistant';content:string}>>(companion&&companionHistory.length?[[companion.id,companionHistory.slice(-6)]]:[]))
  const select=(next:ColonyResident|null)=>{if(next)setPeerId(null);setSelectedRaw(next);setHistory(next?histories.current.get(next.id)??[]:[])}
  const setSelected=select
  const[sending,setSending]=useState(false)
  // Hat eine Figur das Gespräch beendet (Abbruch bei Wiederholung, G-6)? Dann bleibt das Feld zu, bis man jemand anderen wählt.
  const[endedBy,setEndedBy]=useState<string|null>(null)
  // Der Server weist zehn Minuten lang ab; danach darf man es wieder versuchen.
  useEffect(()=>{if(!endedBy)return;const t=setTimeout(()=>setEndedBy(null),10*60_000);return()=>clearTimeout(t)},[endedBy])
  const[status,setStatus]=useState('')
  const[loaded,setLoaded]=useState(false)
  const[nowMs,setNowMs]=useState(()=>Date.now())
  const[seat,setSeat]=useState<VenueSpot|null>(null)
  const[dancing,setDancing]=useState(false)
  const[satAt,setSatAt]=useState(0)
  const walk=useRef<ReturnType<typeof setInterval>|null>(null)
  const gateOpenRef=useRef(true)
  const blockedTextRef=useRef('Hier geht es nicht weiter.')
  gateOpenRef.current=!fitting.gate||fitting.gate.open
  blockedTextRef.current=fitting.gate?.blockedText??'Hier geht es nicht weiter.'
  const posRef=useRef<Point>(layout.start)
  // Laufweg für die Auswertung (Einheit: 10 px), gedrosselt in reportPlayerPosition.
  useEffect(()=>{reportPlayerPosition('interior:'+entityId,pos.x/10,pos.y/10)},[pos,entityId])
  const greeted=useRef(false)
  const[gates,setGates]=useState<GateView[]>([])
  const[learning,setLearning]=useState<string|null>(null)
  const learningRef=useRef<string|null>(null)
  useEffect(()=>{learningRef.current=learning},[learning])
  const hasGates=learningGatesFor(fitting.kind).length>0
  async function loadGates(){
    if(!hasGates)return
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/learning/gates?kind='+encodeURIComponent(fitting.kind),{headers:token?{Authorization:'Bearer '+token}:{},cache:'no-store'})
      const data=await response.json()
      if(response.ok&&Array.isArray(data.gates))setGates(data.gates)
    }catch{/* ohne Lernstand keine Schwellen-Anzeige */}
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{void loadGates()},[fitting.kind])
  function openLearning(gateId:string){
    const gate=gates.find(g=>g.id===gateId)
    if(!gate){setStatus('Der Lernstand wird noch geholt …');return}
    if(!gate.moduleId){setStatus('Für „'+gate.moduleTitle+'“ gibt es noch kein Lernmodul.');return}
    stopWalk();setLearning(gateId)
  }
  const handledLearn=useRef(0)
  useEffect(()=>{
    if(!learnRequest||learnRequest.at===handledLearn.current||gates.length===0)return
    handledLearn.current=learnRequest.at;openLearning(learnRequest.gateId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[learnRequest?.at,gates.length])

  useEffect(()=>{
    let live=true
    ;(async()=>{
      try{
        const{token}=await getSessionInfo()
        const response=await fetch('/api/game/population?includeDepth=1&tileEntityId='+encodeURIComponent(entityId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        const data=await response.json()
        if(live&&response.ok){
          const list=Array.isArray(data.residents)?data.residents:[]
          setResidents(companion&&!list.some((item:ColonyResident)=>item.id===companion.id)?[companion,...list]:list)
        }
      }catch{if(live)setResidents([])}
      if(live)setLoaded(true)
    })()
    return()=>{live=false}
  },[entityId,companion?.id])
  useEffect(()=>{const clock=setInterval(()=>setNowMs(Date.now()),400);return()=>clearInterval(clock)},[])

  function stopWalk(){if(walk.current){clearInterval(walk.current);walk.current=null}setDancing(false)}
  useEffect(()=>{posRef.current=pos},[pos])
  useEffect(()=>()=>stopWalk(),[])
  const gateOpen=!fitting.gate||fitting.gate.open
  function walkTo(target:Point,onArrive?:()=>void){
    if(!entryAllows(layout,target,gateOpen)){setStatus(fitting.gate?.blockedText??'Hier geht es nicht weiter.');return}
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
      if(k==='escape'){if(learningRef.current){setLearning(null);return}onClose();return}
      if(learningRef.current)return
      if(!['w','a','s','d'].includes(k))return
      event.preventDefault()
      stopWalk();setSeat(null)
      setPos(current=>{
        // In 2,5D gehen die Tasten nach Bildschirm: W nach oben (Raum: Nordost), D nach rechts (Südost).
        const D=SPEED/Math.SQRT2
        const next=isoRef.current
          ?{x:current.x+(k==='w'?D:k==='s'?-D:k==='d'?D:-D),y:current.y+(k==='w'?-D:k==='s'?D:k==='d'?D:-D)}
          :{x:current.x+(k==='d'?SPEED:k==='a'?-SPEED:0),y:current.y+(k==='s'?SPEED:k==='w'?-SPEED:0)}
        if(!entryAllows(layout,next,gateOpenRef.current)){setStatus(blockedTextRef.current);return current}
        return isVenueBlocked(layout,next,VENUE_PLAYER_RADIUS)?current:next
      })
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[onClose,layout])

  const visits=fitting.visits
  const worksHere=(r:ColonyResident)=>r.assignments.some(a=>a.type==='work'&&a.tileEntityId===entityId)
  // Alltag (06.11.2026, „Bewegungen sind noch so einfach“): Wer sitzt, trinkt mal oder plaudert; wer steht, erzählt auch mal.
  const idlePose=(id:string,sit:boolean,hasDrink:boolean):KieselPose=>{
    let h=0;for(let i=0;i<id.length;i++)h=(h*33+id.charCodeAt(i))>>>0
    const phase=Math.floor(nowMs/4200+(h%97)/13)%7
    if(sit)return phase===1&&hasDrink?'trinken':phase===3||phase===5?'plaudern_sitzend':'sitzen'
    return phase===2||phase===4?'plaudern':'stehen'
  }
  // Arbeit sichtbar wie in Siedler (Thomas, 04.11.2026): Putzkraft wischt, am Tresen
  // werden Gläser poliert, die Bedienung trägt das Tablett, der DJ tanzt am Pult.
  // Zwischendurch steht man auch mal nur da.
  const workPose=(roleText:string,id:string,walking:boolean):KieselPose|null=>{
    const r=roleText.toLowerCase()
    if(/clean|putz|reinig/.test(r))return 'wischen'
    if(walking)return /wait|kellner|bedien|service|server/.test(r)?'tragen':null
    if(/\bdj\b|deejay|auflegen/.test(r))return 'tanzen'
    let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0
    const busy=Math.floor(nowMs/7000+h%5)%3!==0
    if(!busy)return null
    if(/door|tür|security/.test(r))return null
    return /bar|nightclub|pub|cafe|restaurant|bistro|imbiss|hotel/.test(String(fitting.kind))||/bar|tresen|theke|barista|koch|cook/.test(r)?'polieren':null
  }
  const everyone=useMemo(()=>{
    const extra=fitting.extraResidents??[]
    const known=new Set([...residents,...extra].map(r=>r.id))
    return[...residents,...extra.filter(r=>!residents.some(x=>x.id===r.id)),...visits.filter(visit=>!known.has(visit.resident.id)).map(visit=>visit.resident)]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[residents,visits,(fitting.extraResidents??[]).map(r=>r.id).join()])
  const{figures,moments,joined}=useMemo(()=>{
    const ageOf=new Map(visits.map(visit=>[visit.resident.id,visit.ageSeconds+(nowMs-visit.fetchedAt)/1000]))
    const placed=placeVenueFigures(layout,everyone.map(r=>({id:r.id,worksHere:worksHere(r),isCompanion:Boolean(companion&&r.id===companion.id),presenceRoomId:r.interiorPresence?.roomId??null,displayPriority:r.personDepth?.level==='focal'?3:r.personDepth?.level==='developed'?2:r.personDepth?.level==='situated'?1:0})))
    const moments=new Map<string,GuestMoment>()
    let joined:string|null=null
    const playerSeat=seat?{seat,seatedForS:(nowMs-satAt)/1000}:null
    const figures:VenueFigure[]=[]
    let queue=1
    for(const figure of placed){
      const age=ageOf.get(figure.id)
      if(age===undefined||figure.roomRole==='staff'||!figure.visibleToPlayer){figures.push(figure);continue}
      const place=seatForGuest(layout,figure.spot,figure.id,age,playerSeat,placed)
      const moment=guestMoment(layout,place.seat,age)
      if(place.joined&&(moment.phase==='to-seat'||moment.phase==='seated'))joined=figure.id
      if(moment.phase==='gone'){if(residents.some(r=>r.id===figure.id))figures.push(figure);continue}
      const point=moment.phase==='ordering'?{x:moment.point.x-queue++*16,y:moment.point.y+4}:moment.point
      moments.set(figure.id,moment)
      figures.push({...figure,spot:{...moment.spot,x:point.x,y:point.y}})
    }
    // Die Begleitung bleibt beim Spieler (03.11.2026): am selben Tisch oder neben ihm.
    if(companion){
      const index=figures.findIndex(f=>f.id===companion.id&&f.roomRole==='companion')
      if(index>=0){
        const taken=new Set(figures.filter((_,i)=>i!==index).map(f=>f.spot.id))
        figures[index]={...figures[index],spot:companionPlace(layout,{playerPos:pos,playerSeat:seat,taken})}
      }
    }
    return{figures,moments,joined}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[layout,everyone,visits,nowMs,entityId,companion?.id,residents,seat,satAt,Math.round(pos.x/12),Math.round(pos.y/12)])

  const service=fitting.service(figures)
  const seatedForS=seat?(nowMs-satAt)/1000:0
  const tablePhase:TableServicePhase=seat&&fitting.tableService?tableServicePhase(seatedForS,layout.kind,service):'none'
  const waiterId=useMemo(()=>{
    if(!seat||tablePhase==='none'||tablePhase==='gone')return null
    return figures.filter(f=>f.roomRole==='staff'&&f.visibleToPlayer).map(f=>({id:f.id,d:Math.hypot(f.spot.x-seat.x,f.spot.y-seat.y)})).sort((a,b)=>a.d-b.d)[0]?.id??null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[seat?.id,tablePhase,figures.length])
  const served=useMemo(()=>waiterId&&seat?figures.map(f=>f.id===waiterId?{...f,spot:tableServiceSpot(layout,seat,tablePhase,seatedForS,f.spot)}:f):figures,[figures,waiterId,seat,tablePhase,seatedForS,layout])
  const atTable=tablePhase==='at-table'
  const closed=loaded&&service==='closed'
  const shown=useMemo<ShownFigure[]>(()=>{
    const byId=new Map(everyone.map(r=>[r.id,r]))
    if(service==='closed')return[]
    return served.filter(f=>f.visibleToPlayer).flatMap(figure=>{const resident=byId.get(figure.id);return resident?[{figure,resident,moment:moments.get(figure.id)??null}]:[]})
  },[served,moments,everyone,service])
  const nearestNpc=useMemo(()=>shown.map(item=>({...item,d:Math.hypot(item.figure.spot.x-pos.x,item.figure.spot.y-pos.y)})).sort((a,b)=>a.d-b.d)[0]??null,[shown,pos])
  const nearService=isAtServicePoint(layout,pos)||atTable
  const nearExit=Math.hypot(pos.x-layout.exit.x,pos.y-layout.exit.y)<48
  const onFloor=onDanceFloor(layout,pos)
  const nearSide=Boolean(fitting.sideDoor&&Math.hypot(pos.x-fitting.sideDoor.x,pos.y-fitting.sideDoor.y)<44)

  useEffect(()=>{if(selected)histories.current.set(selected.id,historyState)},[historyState,selected?.id])
  useEffect(()=>{if(companion)setStatus(personSceneLabel(companion)+' ist mit dir hereingekommen und bleibt bei dir.')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[companion?.id])
  // Kiesel-Figuren (04.11.2026): Blickrichtung aus der letzten Bewegung, Gehen solange sie sich bewegt.
  const facing=useRef(new Map<string,{x:number;y:number;dir:KieselDir;movedAt:number}>())
  function motion(id:string,x:number,y:number){
    const prev=facing.current.get(id)
    if(!prev){const v={x,y,dir:'se' as KieselDir,movedAt:0};facing.current.set(id,v);return{dir:v.dir,moving:false}}
    const dx=x-prev.x,dy=y-prev.y
    if(Math.abs(dx)>.5||Math.abs(dy)>.5){prev.dir=kieselDirFrom(dx,dy,prev.dir);prev.x=x;prev.y=y;prev.movedAt=Date.now()}
    return{dir:prev.dir,moving:Date.now()-prev.movedAt<500}
  }
  const workKey=String(fitting.kind)
  const myLook=useMyLook().look
  const[editingFigure,setEditingFigure]=useState(false)
  const presence=useRoomPresence(entityId,me,{x:pos.x,y:pos.y,seated:Boolean(seat),role:fitting.playerTag??null,look:myLook})
  const peers=presence.peers
  const peer=peerId?peers.find(p=>p.profileId===peerId)??null:null
  function setMyPose(next:PoseState|null){setMyPoseRaw(next);poseFrom.current=next?{...posRef.current}:null;presence.setPose(next)}
  // Wer sich wegbewegt, beendet seine Geste (außer auf dem Weg zum Partner).
  useEffect(()=>{const from=poseFrom.current;if(myPose&&from&&!FOLLOW_JOINTS.has(myPose.name)&&Math.hypot(pos.x-from.x,pos.y-from.y)>8)setMyPose(null)},[pos.x,pos.y])
  // Zusammen gehen (Arm, Hand in Hand): Wer angenommen hat, läuft neben dem anderen mit; lässt einer los, ist es vorbei.
  const following=useRef(false)
  useEffect(()=>{
    if(!myPose||!FOLLOW_JOINTS.has(myPose.name)||!myPose.with)return
    const w=myPose.with
    if(w===npcJoint?.id)return // mit einer Figur: Die Begleitung folgt dem Spieler
    const partner=peers.find(p=>p.profileId===w)
    if(!partner||partner.pose?.with!==me?.profileId||partner.pose?.name!==myPose.name){setMyPose(null);following.current=false;setStatus('Ihr lasst los.');return}
    if(!following.current)return
    const target=besidePartner(posRef.current,partner)
    if(Math.hypot(target.x-posRef.current.x,target.y-posRef.current.y)>20&&!walk.current)walkTo(target)
  },[nowMs,peers])
  useEffect(()=>{if(myPose&&!poseNow(myPose,nowMs)){setMyPose(null)}if(npcJoint&&!poseNow(npcJoint.state,nowMs))setNpcJoint(null)},[nowMs])
  function doGesture(name:GestureName){
    const g=GESTURES[name]
    if(seat&&name!=='prost'&&name!=='klatschen')setSeat(null)
    setMyPose(gestureState(name,Date.now()))
    if(name==='tanzen'&&onFloor)setDancing(true)
    presence.gesture(g.verb)
    const near=selected&&served.find(f=>f.id===selected.id)
    lastGesture.current={personId:near&&Math.hypot(near.spot.x-pos.x,near.spot.y-pos.y)<140?selected!.id:null,text:({winken:'winkt dir zu',jubeln:'jubelt neben dir',klatschen:'klatscht Beifall',verbeugen:'verbeugt sich vor dir',prost:'prostet dir zu',tanzen:'tanzt neben dir'} as Record<GestureName,string>)[name],at:Date.now()}
    if(peers.length)roomChat.logGesture(g.verb)
    setStatus('Du '+({winken:'winkst',jubeln:'jubelst',klatschen:'klatschst',verbeugen:'verbeugst dich',prost:'prostest in die Runde',tanzen:'tanzt'} as Record<GestureName,string>)[name]+'.')
  }
  function invitePeer(target:PeerState,action:JointName){
    if(action==='paartanz'&&!layout.danceFloor){setStatus('Hier gibt es keine Tanzfläche.');return}
    const next={to:target.profileId,action,at:Date.now()}
    setMyInvite(next);presence.invite(next)
    roomChat.logGesture('lädt '+target.name+' ein: '+JOINTS[action].label)
    setStatus('Du fragst '+target.name+': '+JOINTS[action].label+'? Warte auf die Antwort.')
  }
  // Angenommen: Mein Gegenüber trägt die Pose mit mir – ich mache mit.
  useEffect(()=>{
    if(!myInvite||!me)return
    const partner=acceptedBy(peers,myInvite,me.profileId)
    if(partner){setMyPose(jointState(myInvite.action,partner.profileId,Date.now()));setMyInvite(null);presence.invite(null);setStatus(partner.name+' '+({paartanz:'tanzt mit dir',anstossen:'stößt mit dir an',handschlag:'gibt dir die Hand',umarmen:'umarmt dich',troesten:'lässt sich trösten',armnehmen:'lässt sich in den Arm nehmen',handinhand:'nimmt deine Hand'} satisfies Record<JointName,string>)[myInvite.action]+'.')}
    else if(Date.now()-myInvite.at>30_000){setMyInvite(null);presence.invite(null);setStatus('Keine Antwort.')}
  },[peers,myInvite,nowMs])
  const incoming=me?invitesFor(peers,me.profileId,nowMs).filter(p=>!declined.includes(p.profileId+':'+p.invite.at)):[]
  function answerInvite(from:PeerState&{invite:InviteState},yes:boolean){
    if(!yes){setDeclined(d=>[...d,from.profileId+':'+from.invite.at].slice(-20));presence.gesture('lehnt ab');roomChat.logGesture('lehnt ab: '+from.name);return}
    const action=from.invite.action
    walkTo(besidePartner(posRef.current,from),()=>{setMyPose(jointState(action,from.profileId,Date.now()));following.current=FOLLOW_JOINTS.has(action);roomChat.logGesture(JOINTS[action].verb+' '+from.name)})
  }
  // Mit einer Figur: Sie entscheidet nach dem, was im Raum sichtbar und bekannt ist.
  function jointWithNpc(target:ColonyResident,action:JointName){
    const self=served.find(f=>f.id===target.id)
    if(!self)return
    const look=kieselLookFor(target as any)
    const c:NpcJointContext={
      companion:companionInfo?.id===target.id,
      staff:self.roomRole==='staff',
      working:self.roomRole==='staff'||worksHere(target),
      minor:look.age==='kind'||look.age==='jung',
      sitting:self.spot.posture==='sitting',
      danceFloor:Boolean(layout.danceFloor)&&!closed,
      dancing:self.spot.id.startsWith('dance-'),
      npcHasDrink:Boolean(moments.get(target.id)?.served)||fitting.things.some(t=>t.forId===target.id),
      playerHasDrink:fitting.things.some(t=>!t.forId),
      mourning:false,condoled:/beileid/i.test(lastPlayerText??''),
      refusedTalk:endedBy===target.id,
      ...(fitting.jointContext?.(target.id)??{}),
    }
    const decision=npcJointDecision(action,c)
    const name=personSceneLabel(target)
    if(!decision.ok){setStatus(name+': „'+decision.reply+'“');return}
    // Personal hinter dem Tresen: von vorn, am Bedienplatz.
    const meet=self.roomRole==='staff'&&Math.hypot(self.spot.x-layout.servicePoint.x,self.spot.y-layout.servicePoint.y)<120?layout.servicePoint:besidePartner(posRef.current,self.spot)
    walkTo(meet,()=>{
      const now=Date.now()
      setMyPose(jointState(action,target.id,now))
      setNpcJoint({id:target.id,state:jointState(action,'me',now)})
      lastJoint.current={personId:target.id,action,at:now}
      if(peers.length)roomChat.logGesture(JOINTS[action].verb+' '+name)
      void converse(target,false,'('+({paartanz:'tanzt mit dir',anstossen:'stößt mit dir an',handschlag:'gibt dir die Hand',umarmen:'umarmt dich',troesten:'legt dir tröstend die Hand auf die Schulter',armnehmen:'nimmt dich in den Arm',handinhand:'nimmt deine Hand'} satisfies Record<JointName,string>)[action]+')')
    })
  }
  // Befehle im Chat: „/winken“, „/tanzen mit“ …
  function runCommand(text:string,target:{peer?:PeerState|null;npc?:ColonyResident|null}):boolean{
    const cmd=parseGestureCommand(text)
    if(!cmd)return false
    if(cmd.kind==='gesture'){doGesture(cmd.name);return true}
    if(target.peer)invitePeer(target.peer,cmd.name)
    else if(target.npc)jointWithNpc(target.npc,cmd.name)
    else setStatus('Wähle zuerst jemanden aus – dann „/'+JOINTS[cmd.name].words[0]+'“.')
    return true
  }
  // Spieler reden im Raum miteinander (04.11.2026); gespeichert und ausgewertet.
  const roomChat=useRoomChat(me?entityId:null,buildingName,peers.length,me?.profileId??null)
  // Flüstern, Sagen, Rufen (05.11.2026): Sagen hört, wer in der Nähe steht; Rufen der ganze Raum.
  const[chatRange,setChatRange]=useState<Exclude<ChatRange,'whisper'>>('say')
  const[whisperText,setWhisperText]=useState('')
  const heard=me?roomChat.messages.filter(m=>heardAt(m,{id:me.profileId,x:pos.x,y:pos.y})):[]
  const nameOf=(id:string|null|undefined)=>id?peers.find(p=>p.profileId===id)?.name??'jemandem':'jemandem'
  async function whisperTo(target:PeerState){
    const text=whisperText.trim()
    if(!text||roomSending)return
    const send=async()=>{setRoomSending(true);try{const r=await roomChat.say(text,{range:'whisper',toProfileId:target.profileId,x:posRef.current.x,y:posRef.current.y});if(!r.ok){setStatus(r.error??'Nicht gesendet.');return}setWhisperText('');setStatus('Du flüsterst '+target.name+' etwas zu.')}finally{setRoomSending(false)}}
    if(Math.hypot(target.x-posRef.current.x,target.y-posRef.current.y)>WHISPER_RANGE_PX)walkTo(besidePartner(posRef.current,target),()=>void send())
    else await send()
  }
  const[roomText,setRoomText]=useState('')
  const[roomSending,setRoomSending]=useState(false)
  async function sayToRoom(){
    const text=roomText.trim()
    if(!text||roomSending)return
    if(runCommand(text,{peer})){setRoomText('');return}
    setRoomSending(true)
    try{
      const r=await roomChat.say(text,{range:chatRange,x:posRef.current.x,y:posRef.current.y})
      if(!r.ok){setStatus(r.error??'Nicht gesendet.');return}
      setRoomText('')
      if(r.cleaned)setStatus('Kontaktdaten wurden für die anderen entfernt.')
    }finally{setRoomSending(false)}
  }
  const companionInfo=companion?{id:companion.id,label:personSceneLabel(companion),plan:[...companionHistory].reverse().find(line=>line.role==='assistant')?.content??null}:null
  const lastPlayerText=[...historyState].reverse().find(entry=>entry.role==='user')?.content??null
  const ctx:InteriorContext={pos,seat,atTable,nearService,closed,service,selected,shown,figures:served,moments,joined,waiterId,tablePhase,nowMs,setStatus,setSelected,gates,openLearning,talkTo:resident=>{select(resident);if(!histories.current.get(resident.id)?.length)void converse(resident,true)},history:historyState,lastPlayerText,dancing:dancing&&onFloor,walkTo,say:text=>{if(selected)void converse(selected,false,text)},companion:companionInfo}
  const ctxRef=useRef<InteriorContext|null>(null)
  ctxRef.current=ctx
  useEffect(()=>{onContext?.(ctx)})

  // Was die Person über ein eben erhaltenes Geschenk weiß – früh in der Liste, damit es nicht abgeschnitten wird.
  function withGiftFact(facts:string[],personId:string){
    const extra:string[]=[]
    const g=lastGift.current
    if(g&&g.personId===personId&&Date.now()-g.at<10*60_000)extra.push(`Dein Gegenüber hat dir eben ${g.amount} Credits bar gegeben; du hast sie angenommen`)
    const j=lastJoint.current
    if(j&&j.personId===personId&&Date.now()-j.at<10*60_000)extra.push(JOINTS[j.action].npcFact)
    const ge=lastGesture.current
    if(ge&&ge.personId===personId&&Date.now()-ge.at<2*60_000)extra.push('Dein Gegenüber '+ge.text)
    // Andere Spieler im Raum: man sieht sie, kennt aber ihre Namen nicht.
    if(peers.length){
      const working=peers.filter(p=>p.role)
      extra.push(`Außerdem im Raum: ${peers.length===1?'ein weiterer Gast':peers.length+' weitere Gäste'}${working.length?', davon arbeitet '+(working.length===1?'einer':working.length)+' hier mit ('+[...new Set(working.map(p=>p.role))].join(', ')+')':''}`)
    }
    if(!extra.length)return facts
    return [facts[0],...extra,...facts.slice(1)].filter(Boolean).slice(0,16)
  }
  async function giveCredits(){
    const target=selected
    const amount=Math.round(Number(giveAmount))
    if(!target||giving||!Number.isFinite(amount)||amount<1)return
    setGiving(true)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/credits',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({channel:'cash',amount,toPersonId:target.id,place:buildingName,requestId:crypto.randomUUID()})})
      const data=await response.json().catch(()=>({}))
      if(!response.ok||!data.ok){setStatus(String(data.error??'Das hat nicht geklappt.'));return}
      if(typeof data.credits==='number')useGameStore.setState({credits:data.credits})
      lastGift.current={personId:target.id,amount,at:Date.now()}
      setGiveOpen(false)
      setStatus(`Du gibst ${personSceneLabel(target)} ${amount} Credits. Du hast noch ${data.credits} Credits.`)
      void converse(target,false,`(gibt dir ${amount} Credits)`)
    }catch{setStatus('Keine Verbindung – es wurde nichts gegeben.')}finally{setGiving(false)}
  }
  async function giveToPeer(target:PeerState){
    const amount=Math.round(Number(giveAmount))
    if(giving||!Number.isFinite(amount)||amount<1)return
    setGiving(true)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/credits',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({channel:'cash',amount,toUsername:target.name,place:buildingName,requestId:crypto.randomUUID()})})
      const data=await response.json().catch(()=>({}))
      if(!response.ok||!data.ok){setStatus(String(data.error??'Das hat nicht geklappt.'));return}
      if(typeof data.credits==='number')useGameStore.setState({credits:data.credits})
      setGiveOpen(false)
      presence.gesture('gibt '+amount+' Cr')
      setStatus(`Du gibst ${target.name} ${amount} Credits. Du hast noch ${data.credits} Credits.`)
    }catch{setStatus('Keine Verbindung – es wurde nichts gegeben.')}finally{setGiving(false)}
  }
  const talk=()=>{if(selected&&runCommand(message,{npc:selected})){setMessage('');return}void converse(selected,false)}
  async function converse(target:ColonyResident|null,opening:boolean,said?:string){
    if(!target||(!opening&&!(said??message).trim())||sending)return
    const self=served.find(f=>f.id===target.id)
    if(!self)return
    const text=opening?'':(said??message).trim().slice(0,400)
    const history=opening?[]:historyState
    setSending(true)
    try{
      const{token}=await getSessionInfo()
      const response=await fetch('/api/game/npc-conversation',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({
          player:text,opening,npcId:target.id,npcName:target.displayName,
          npcRole:target.assignments.find(a=>a.type==='work')?.roleCode??target.activityState,
          headline:'Gespräch '+fitting.locative+' '+buildingName,
          source:'NOXIA '+fitting.kind+' interior',
          locationName:buildingName,
          localFacts:withGiftFact(fitting.facts(self,text?{...ctx,lastPlayerText:text}:ctx),target.id),
          placeKnowledge:fitting.placeKnowledge,
          hearsay:fitting.hearsay(self),
          introduction:fitting.introduction(self),
          history,
        }),
      })
      const data=await response.json().catch(()=>({}))
      if(opening){if(response.ok&&data.reply)setHistory([{role:'assistant' as const,content:String(data.reply)}]);return}
      const reply=response.ok&&data.reply?String(data.reply):'Die Person antwortet gerade nicht.'
      if(data.conversationEnded){setEndedBy(target.id);setStatus(personSceneLabel(target)+' will gerade nicht weiterreden.')}
      setHistory(current=>[...current,{role:'user' as const,content:text},{role:'assistant' as const,content:reply}].slice(-10))
      setMessage('')
    }finally{setSending(false)}
  }

  useEffect(()=>{
    if(!fitting.greetsAtService||!nearService||service!=='staffed'||greeted.current||sending)return
    const host=shown.filter(item=>item.figure.roomRole==='staff').map(item=>({...item,d:Math.hypot(item.figure.spot.x-pos.x,item.figure.spot.y-pos.y)})).sort((a,b)=>a.d-b.d)[0]
    if(!host)return
    greeted.current=true
    if(selected?.id===host.resident.id&&historyState.length)return
    // Wer mit der Begleitung im Gespräch ist, wird nicht unterbrochen.
    if(companion&&selected?.id===companion.id&&historyState.length)return
    select(host.resident)
    if(!histories.current.get(host.resident.id)?.length)void converse(host.resident,true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[nearService,service,shown.length])
  useEffect(()=>{
    if(!joined)return
    const guest=everyone.find(r=>r.id===joined)
    if(!guest)return
    setStatus(personSceneLabel(guest)+' setzt sich zu dir an den Tisch.')
    if(!selected||!historyState.length)select(guest)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[joined])
  const waiter=waiterId?everyone.find(r=>r.id===waiterId)??null:null
  const waiterName=waiter?personSceneLabel(waiter):null
  // Bedienung ansprechen (06.11.2026): Kommt jemand an den Tisch, während man mit der
  // Begleitung spricht, fand man sie im Seitenfeld nicht – nur über ihre Figur im Raum.
  const tableMate=(()=>{const id=joined??companion?.id??null;return id&&id!==waiterId?everyone.find(r=>r.id===id)??null:null})()
  useEffect(()=>{if(atTable&&waiterName)setStatus(waiterName+' kommt an deinen Tisch und nimmt die Bestellung auf.')},[atTable,waiterName])

  const openSeats=closed?[]:freeSeats(layout,figures,seat?[seat.id]:[]).filter(spot=>entryAllows(layout,spot,gateOpen))
  const nextSeat=closed||seat?null:(()=>{const n=nearestFreeSeat(layout,figures,pos);return n&&entryAllows(layout,n,gateOpen)?n:null})()
  const closedInfo=closed?fitting.closedText(figures):null
  const decor=fitting.decor
  const labelled=layout.furniture.filter(item=>fitting.furnitureLabel(item.kind,service))
  seatedRef.current=shown.filter(item=>item.figure.spot.kind==='seat').map(item=>item.figure.spot)
  // Bildschirmversatz eines Raumpunkts zur Raummitte (aus der Kippung: x' = .707(x+y), y' = .354(y−x))
  const isoScale=fit*zoom
  robotOn.current=iso&&!closed&&Boolean(fitting.serviceRobot)
  const cam=(()=>{if(zoom<=1.02)return{x:0,y:0};const cx=layout.width/2,cy=layout.height/2;const dx=.7071*((pos.x-cx)+(pos.y-cy)),dy=.3536*((pos.y-cy)-(pos.x-cx))-30;const lim={x:.7071*(layout.width+layout.height)/2*(1-1/zoom)*1.05,y:(.3536*(layout.width+layout.height)/2+70)*(1-1/zoom)*1.1};return{x:-Math.max(-lim.x,Math.min(lim.x,dx))*isoScale,y:-Math.max(-lim.y,Math.min(lim.y,dy))*isoScale}})()
  const isoTransform=`translate(calc(-50% + ${cam.x.toFixed(1)}px),calc(-50% + ${cam.y.toFixed(1)}px)) scale(${isoScale.toFixed(3)}) rotateX(60deg) rotateZ(-45deg)`

  return <div className="walkable-interior">
    <NpcVisualStyles/>
    <header><div><small>INNENRAUM · {fitting.noun.toUpperCase()}</small><b>{buildingName}</b><span>{iso?'Boden anklicken oder WASD':'WASD bewegen'} · Platz anklicken zum Hinsetzen · Person anklicken · ESC verlassen{fitting.headerNote?' · '+fitting.headerNote:''}</span></div><div className="head-actions"><button className="view-toggle" onClick={toggleView} title="Ansicht wechseln">{iso?'Draufsicht':'2,5D'}</button><button onClick={onClose}>← Verlassen</button></div></header>
    <main>
      <div ref={stageRef} className={iso?'iso-stage':'flat-stage'} onWheel={iso?e=>{if(e.ctrlKey)return;setZoom(zoom*(e.deltaY<0?1.08:1/1.08))}:undefined}>
      {iso&&<div className="zoom-ctl"><button onClick={()=>setZoom(zoom*1.15)} aria-label="Näher heran">+</button><button onClick={()=>setZoom(zoom/1.15)} aria-label="Weiter weg">−</button><button onClick={()=>setZoom(zoom>1.1?1:1.35)} aria-label="Ganzer Raum">{zoom>1.1?'Raum':'Nah'}</button></div>}
      <div ref={roomRef} className={'room '+fitting.kind+(iso?' iso':'')+(fitting.furnish?.editing?' editing':'')} style={iso?{transform:isoTransform}:undefined} onPointerMove={fitting.furnish?.editing?moveDrag:undefined} onPointerUp={endDrag} onPointerCancel={endDrag}
        onClick={e=>{if((e.target as HTMLElement).closest('.npc,.peer,.player,.f,.seat-hit,.context,.item,.deco,.drag-table,.task-marker,button')||fitting.furnish?.editing||closed)return;const q=roomPoint(e);if(q.x>6&&q.y>6&&q.x<layout.width-6&&q.y<layout.height-6&&!isVenueBlocked(layout,q,VENUE_PLAYER_RADIUS))walkTo(q)}}>
        <div ref={el=>{pins.current[0]=el}} className="pin" style={{left:0,top:0}}/><div ref={el=>{pins.current[1]=el}} className="pin" style={{left:layout.width,top:0}}/><div ref={el=>{pins.current[2]=el}} className="pin" style={{left:0,top:layout.height}}/>
        {iso&&<><div className="wall3d n"><i className="seam"/>{layout.windows.map((win,index)=><div key={index} className="win" style={{left:win.x,width:win.w}}/>)}{fitting.wallSign&&<div className="neon-sign" style={{left:signSpot(layout.windows)}}>{fitting.wallSign}</div>}</div><div className="wall3d e"><i className="seam"/></div></>}
        {layout.windows.map((win,index)=><div key={index} className="window" style={{left:win.x,width:win.w}}><i/><em/></div>)}
        <div className="door"><small>AUSGANG</small></div>
        {fitting.sideDoor&&<div className="door side" style={{left:fitting.sideDoor.x-30}}><small>{fitting.sideDoor.label}</small></div>}
        {decor?.rug&&<div className="rug" style={{left:decor.rug.x,top:decor.rug.y,width:decor.rug.w,height:decor.rug.h}}/>}
        {layout.entry&&!gateOpen&&!closed&&<><div className="rope" style={{left:layout.entry.zone.x,top:layout.entry.zone.y-3,width:layout.entry.zone.w,height:6}}/><div className="rope" style={{left:layout.entry.zone.x+layout.entry.zone.w-3,top:layout.entry.zone.y,width:6,height:layout.entry.zone.h}}/></>}
        {layout.danceFloor&&<div className={'dancefloor'+(closed?' off':'')+(fitting.floorMood?' mood-'+fitting.floorMood:'')} style={{left:layout.danceFloor.x,top:layout.danceFloor.y,width:layout.danceFloor.w,height:layout.danceFloor.h}}><i/></div>}
        {layout.furniture.filter(item=>item.kind==='table'||item.kind==='high-table').map(item=><div key={'lamp:'+item.id} className="lamp" style={{left:item.x+item.w/2-70,top:item.y+item.h/2-70}}/>)}
        {iso&&layout.furniture.filter(item=>item.kind!=='board').map(item=><div key={'sh:'+item.id} className="fshadow" style={{left:item.x-3,top:item.y-3,width:item.w+6,height:item.h+6}}/>)}
        {layout.furniture.map((item,index)=><div key={item.id} className={'f '+item.kind+(item.kind==='chair'||item.kind==='stool'?' c'+(index%4):'')+(/^shelf-[a-z]+$/.test(item.id)?' '+item.id:'')} style={{left:item.x,top:item.y,width:item.w,height:item.h}}>{item.kind==='counter'&&fitting.counterDressing}{iso&&item.kind==='board'&&fitting.furnitureLabel(item.kind,service)&&<span className="board-text">{fitting.furnitureLabel(item.kind,service)}</span>}{iso&&item.kind!=='board'&&<><b className="fs"/><b className="fw"/></>}</div>)}
        {iso&&layout.furniture.filter(item=>item.kind==='table'||item.kind==='high-table'||item.kind==='chair'||item.kind==='stool').map(item=><div key={'leg:'+item.id} className={'leg '+item.kind} style={{left:item.x+item.w/2,top:item.y+item.h/2}}/>)}
        {iso&&!closed&&layout.furniture.filter(item=>item.kind==='table'||item.kind==='high-table').map(item=><div key={'pend:'+item.id} className="pendant" style={{left:item.x+item.w/2,top:item.y+item.h/2}}><i/><b/></div>)}
        {iso&&robot&&<div className={'serve-robot'+(robot.flip?' flip':'')+(robot.carrying?' carrying':'')} style={{left:robot.x,top:robot.y}} onClick={e=>{e.stopPropagation();setStatus('Der Servierroboter bringt Bestellungen vom Tresen an die Tische. Er weicht dir aus – einfach vorbeigehen.')}} title="Servierroboter"><span>Servierroboter</span><ServeRobotSVG/></div>}
        {(decor?.plants??[]).map(([x,y],index)=><div key={'plant:'+index} className="plant" style={{left:x-14,top:y-26}}><i/><b/></div>)}
        {(fitting.furnish?.decor??[]).map(d=><div key={'deco:'+d.id} className={'deco '+d.kind+(fitting.furnish?.editing?' movable':'')} style={{left:d.x,top:d.y}} onPointerDown={fitting.furnish?.editing?startDrag('decor',d.id,d):undefined}>{d.kind==='pflanze'?<><i/><b/></>:<i/>}{fitting.furnish?.editing&&<button className="rm" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();fitting.furnish?.onRemoveDecor?.(d.id)}} aria-label="Entfernen">×</button>}</div>)}
        {fitting.furnish?.editing&&layout.furniture.filter(f=>/^table-\d+$/.test(f.id)).map(f=><div key={'drag:'+f.id} className="drag-table" style={{left:f.x-22,top:f.y-4,width:f.w+44,height:f.h+8}} onPointerDown={startDrag('table',f.id,f)} title="Tisch ziehen"/>)}
        {labelled.filter(item=>!(iso&&item.kind==='board')).map(item=><div key={'label:'+item.id} className="label" style={{left:item.x+item.w/2,top:item.y+item.h/2}}>{fitting.furnitureLabel(item.kind,service)}</div>)}
        {shown.map(({figure,resident,moment})=>{
          const near=Math.hypot(figure.spot.x-pos.x,figure.spot.y-pos.y)<70
          return <div key={resident.id} className={'npc'+(figure.spot.id.startsWith('dance-')&&!closed?' dancing':'')+(figure.roomRole==='companion'?' with-player':'')} style={{left:figure.spot.x-19,top:figure.spot.y-50}}>
            {isRobot(resident)?<RobotFigure name={resident.displayName} selected={selected?.id===resident.id} showLabel={selected?.id===resident.id||near} onClick={()=>select(resident)}/>:(()=>{const m=motion(resident.id,figure.spot.x,figure.spot.y);const walking=m.moving||moment?.phase==='to-seat'||moment?.phase==='leaving';const label=personSceneLabel(resident);const sitting=figure.spot.posture==='sitting';const roleText=resident.assignments.find(a=>a.type==='work')?.roleCode??'';const forced=fitting.poseFor?.(resident.id)??null;const joint=npcJoint&&npcJoint.id===resident.id?poseNow(npcJoint.state,nowMs):null;const pose:KieselPose=forced?forced.pose:joint?joint:figure.spot.id.startsWith('dance-')&&!closed&&!walking?'tanzen':sitting?idlePose(resident.id,true,Boolean(moment?.served)):(worksHere(resident)&&!closed?workPose(roleText,resident.id,walking):null)??(walking?'gehen':idlePose(resident.id,false,false));return <button className={'kiesel'+(selected?.id===resident.id?' selected':'')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();select(resident)}} title={label}>
              <KieselFigure look={{...kieselLookFor(resident as any,worksHere(resident)?workKey:null),...(forced?.verletzt?{verletzt:true}:{})}} dir={joint?(FOLLOW_JOINTS.has(joint)?(walking?m.dir:'se'):faceTowards(figure.spot,pos)):walking||sitting?m.dir:'se'} pose={joint?sidePose(pose,walking?m.dir:'se',figure.spot,pos):pose} moving={walking} title={label}/>
              {(iso||selected?.id===resident.id||near)&&<span>{label}</span>}
            </button>})()}
          </div>
        })}
        {peers.map(p=>{const waving=p.emote&&Date.now()-p.emote.at<6000;return <button key={'peer:'+p.profileId} className={'peer'+(p.seated?' sitting':'')+(peerId===p.profileId?' selected':'')} style={{left:p.x-19,top:p.y-50}} onClick={e=>{e.stopPropagation();select(null);setPeerId(p.profileId)}} onPointerDown={e=>e.stopPropagation()} title={p.name+' (Spieler)'}>
          {(()=>{const m=motion('peer:'+p.profileId,p.x,p.y);const pp=poseNow(p.pose,nowMs);const partner=p.pose?.with?(p.pose.with===me?.profileId?pos:peers.find(o=>o.profileId===p.pose!.with)??null):null;return <KieselFigure look={p.look?lookAtWork(p.look,p.profileId,p.role?workKey:null):kieselLookFor({id:p.profileId},p.role?workKey:null)} dir={pp&&partner?(FOLLOW_JOINTS.has(pp)?(m.moving?m.dir:'se'):faceTowards(p,partner)):m.dir} pose={pp&&FOLLOW_JOINTS.has(pp)?sidePose(pp,m.moving?m.dir:'se',p,partner):m.moving?'gehen':pp??(p.seated?'sitzen':'stehen')} moving={m.moving} title={p.name}/>})()}<span>{p.name}{p.role?' · '+p.role:''}</span>{waving&&<em>{p.emote!.text}</em>}
        </button>})}
        {shown.filter(item=>item.moment?.served).map(item=><div key={'served:'+item.resident.id} className="item" style={{left:item.figure.spot.x+9,top:item.figure.spot.y-11}} title={visits.find(visit=>visit.resident.id===item.resident.id)?.label}>🍽️</div>)}
        {!iso&&closedInfo&&!fitting.furnish?.editing&&<div className="closed"><b>{closedInfo.headline}</b><span>{closedInfo.detail}</span></div>}
        {fitting.things.map((entry,index)=>{
          const target=entry.forId?shown.find(item=>item.resident.id===entry.forId)?.figure.spot:null
          const same=fitting.things.slice(0,index).filter(other=>other.forId===entry.forId).length
          if(!target&&entry.broughtToTable&&nowMs-entry.at<BRING_S*1000)return null
          const at=target?{x:target.x+16+same*12,y:target.y+(target.kind==='staff'?14:-4)}:seat?{x:seat.x+14+same*12,y:seat.y-6}:{x:pos.x+14+same*12,y:pos.y-14}
          return <div key={entry.key} className="item" style={{left:at.x-9,top:at.y-9}} title={entry.title}>{entry.icon}</div>
        })}
        {openSeats.map(spot=><button key={spot.id} className="seat-hit" style={{left:spot.x-11,top:spot.y-11}} title={'Hier hinsetzen – '+spot.label} aria-label={'Hinsetzen '+spot.label} onClick={()=>sitAt(spot)}/>)}
        {(fitting.markers??[]).map(marker=><div key={marker.key} className="task-marker" style={{left:marker.x-9,top:marker.y-30}} title={marker.label}><b>!</b><span>{marker.label}</span></div>)}
        {(()=>{const m=motion('me',pos.x,pos.y);return <div className={'player kiesel-player'+(seat?' sitting':'')+(dancing&&onFloor?' dancing':'')+(fitting.playerTag?' working':'')} style={{left:pos.x-19,top:pos.y-50}}><KieselFigure look={lookAtWork(myLook,me?.profileId??'player',fitting.playerTag?workKey:null)} dir={(()=>{const w=myPose?.with;if(!poseNow(myPose,nowMs)||!w)return m.dir;if(FOLLOW_JOINTS.has(myPose!.name))return m.moving?m.dir:'se';const q=w==='me'?null:peers.find(o=>o.profileId===w)??served.find(f=>f.id===w)?.spot;return q?faceTowards(pos,q):m.dir})()} pose={myPose&&FOLLOW_JOINTS.has(myPose.name)&&poseNow(myPose,nowMs)?sidePose(myPose.name as KieselPose,m.moving?m.dir:'se',pos,peers.find(o=>o.profileId===myPose.with)??served.find(f=>f.id===myPose.with)?.spot??null):!m.moving&&poseNow(myPose,nowMs)?poseNow(myPose,nowMs)!:seat?'sitzen':dancing&&onFloor?'tanzen':(fitting.playerTag&&!closed?(m.moving?(workPose(fitting.playerTag,'me',true)==='tragen'?'tragen':null):(nearService||/putz|reinig/i.test(fitting.playerTag)?workPose(fitting.playerTag,'me-',false):null)):null)??(m.moving?'gehen':'stehen')} moving={m.moving} title="Du"/><span>{fitting.playerTag?'Du · '+fitting.playerTag:'Du'}</span></div>})()}
        {nearService&&!closed&&<div className="context hint" style={{left:layout.servicePoint.x-34,top:layout.servicePoint.y+14}}>{service==='self-service'?'AM AUTOMATEN':layout.servicePoint.label} · RECHTS</div>}
        {(nearExit||closed)&&<button className="context exit" style={{left:42,top:420}} onClick={onClose}>{fitting.noun.toUpperCase()} VERLASSEN</button>}
        {fitting.sideDoor&&!closed&&nearSide&&<button className="context exit" style={{left:fitting.sideDoor.x-40,top:398}} onClick={()=>fitting.sideDoor!.use(ctx)}>{fitting.sideDoor.useLabel}</button>}
      </div>
      {iso&&closedInfo&&!fitting.furnish?.editing&&<div className="closed iso-closed"><b>{closedInfo.headline}</b><span>{closedInfo.detail}</span></div>}
      </div>
      <aside>
        <small>{fitting.noun.toUpperCase()} · {fitting.sectionLabel}</small>
        {selected?<div className="portrait">{isRobot(selected)?<RobotPortrait size={64} title={selected.displayName}/>:<PersonPortrait id={selected.id} role={selected.assignments.find(item=>item.type==='work')?.roleCode??selected.activityState} appearance={selected.appearance} size={64} title={personSceneLabel(selected)}/>}<div><h3>{personSceneLabel(selected)}</h3>{selected.identityState==='known'&&<small>{selected.assignments.find(item=>item.type==='work')?.roleCode??selected.activityState}</small>}</div></div>:<h3>{layout.template.rooms.find(r=>r.id===layout.playerRoomId)?.name??'Raum'}</h3>}
        {selected&&selected.identityState!=='known'&&selected.observableDescription&&selected.observableDescription!==personSceneLabel(selected)&&<p className="desc">{selected.observableDescription}</p>}
        {!selected&&closedInfo&&<p>{closedInfo.detail}</p>}
        {!selected&&!closed&&!nearService&&<p>Du kannst dich frei im Raum bewegen. Personen im Raum wissen nur, was sie von ihrem Platz aus sehen und was du ihnen erzählst.{fitting.idleText?' '+fitting.idleText:''}</p>}
        {incoming.map(from=><div key={'inv:'+from.profileId} className="invite"><p><b>{from.name}</b> {JOINTS[from.invite.action].ask}.</p><div className="moves"><button onClick={()=>answerInvite(from,true)}>Gern</button><button onClick={()=>answerInvite(from,false)}>Lieber nicht</button></div></div>)}
        {me&&(peers.length>0||roomChat.messages.length>0)&&<div className="room-chat">
          <small>IM RAUM · {peers.length===0?'gerade niemand sonst':peers.length===1?'1 weiterer Spieler':peers.length+' weitere Spieler'}</small>
          <div className="lines">{heard.slice(-12).map(m=><p key={m.id} className={m.range??'say'}><b>{m.senderId===me.profileId?(m.range==='whisper'?'Du flüsterst '+nameOf(m.toId)+' zu':m.range==='shout'?'Du rufst':'Du'):m.senderName+(m.range==='whisper'?' flüstert dir zu':m.range==='shout'?' ruft':'')}:</b> {m.text}{m.senderId!==me.profileId&&<button className="report" title="Nachricht melden" onClick={()=>{roomChat.report(m.id);setStatus('Danke – die Nachricht ist gemeldet.')}}>melden</button>}</p>)}</div>
          <div className="moves range" role="group" aria-label="Reichweite"><button className={chatRange==='say'?'on':''} onClick={()=>setChatRange('say')}>Sagen · in der Nähe</button><button className={chatRange==='shout'?'on':''} onClick={()=>setChatRange('shout')}>Rufen · ganzer Raum</button></div>
          <div className="chat"><input value={roomText} maxLength={300} onChange={e=>setRoomText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void sayToRoom()}} placeholder={chatRange==='shout'?'Durch den Raum rufen …':'Zu denen in der Nähe …'}/><button disabled={roomSending||!roomText.trim()} onClick={()=>void sayToRoom()}>{roomSending?'…':chatRange==='shout'?'Rufen':'Sagen'}</button></div>
          <p className="hint">Was Spieler hier sagen, wird in der Testphase gespeichert und ausgewertet. Kontaktdaten werden entfernt.</p>
        </div>}
        {peer&&<div className="peer-panel">
          <small>SPIELER</small><h3>{peer.name}</h3>
          <p className="hint">{peer.role?'Arbeitet hier gerade als '+peer.role+'.':peer.seated?'Sitzt hier.':'Ist auch hier.'} Ihr seht euch gegenseitig.</p>
          <div className="moves"><button onClick={()=>{doGesture('winken');roomChat.logGesture('winkt '+peer.name)}}>Winken</button><button onClick={()=>{doGesture('prost');roomChat.logGesture('prostet '+peer.name+' zu')}}>Zuprosten</button></div>
          <div className="chat"><input value={whisperText} maxLength={300} onChange={e=>setWhisperText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void whisperTo(peer)}} placeholder={'Nur '+peer.name+' zuflüstern …'}/><button disabled={roomSending||!whisperText.trim()} onClick={()=>void whisperTo(peer)}>Flüstern</button></div>
          <small>GEMEINSAM</small>
          <div className="moves joint">{(Object.keys(JOINTS) as JointName[]).filter(a=>a!=='paartanz'||layout.danceFloor).map(a=><button key={a} disabled={myInvite?.to===peer.profileId} onClick={()=>invitePeer(peer,a)}>{JOINTS[a].label}</button>)}</div>
          {myInvite?.to===peer.profileId&&<p className="hint">Gefragt: {JOINTS[myInvite.action].label} – warte auf {peer.name}.</p>}
          {giveOpen
            ?<div className="chat give"><input type="number" min={1} max={10000} value={giveAmount} onChange={e=>setGiveAmount(e.target.value)} aria-label="Credits geben"/><button disabled={giving} onClick={()=>void giveToPeer(peer)}>{giving?'…':'Geben'}</button><button onClick={()=>setGiveOpen(false)}>×</button></div>
            :<button className="give-open" onClick={()=>setGiveOpen(true)}>Credits geben …</button>}
          {fitting.banPeer&&<div className="moves joint ban"><small>HAUSRECHT · HAUSVERBOT</small>{(fitting.banChoices??[]).map(([h,l])=><button key={h} onClick={()=>{fitting.banPeer!(peer,h);setPeerId(null)}}>{l}</button>)}</div>}
          <button className="give-open block" onClick={()=>setPeerId(null)}>schließen</button>
        </div>}
        {selected&&!peer&&<>
          <div className="history">{historyState.map((entry,index)=><p key={index}><b>{entry.role==='user'?'Du':personSceneLabel(selected)}:</b> „{entry.content}“</p>)}</div>
          {/^[0-9a-f-]{36}$/i.test(selected.id)&&!isRobot(selected)&&endedBy!==selected.id&&(giveOpen
            ?<div className="chat give"><input type="number" min={1} max={10000} value={giveAmount} onChange={e=>setGiveAmount(e.target.value)} aria-label="Credits geben"/><button disabled={giving} onClick={()=>void giveCredits()}>{giving?'…':'Geben'}</button><button onClick={()=>setGiveOpen(false)}>×</button></div>
            :<button className="give-open" onClick={()=>setGiveOpen(true)}>Credits geben …</button>)}
          {!isRobot(selected)&&(()=>{const f=served.find(x=>x.id===selected.id);if(!f||Math.hypot(f.spot.x-pos.x,f.spot.y-pos.y)>150)return null;const extra=fitting.jointContext?.(selected.id);return <div className="moves joint"><small>GEMEINSAM</small>{(Object.keys(JOINTS) as JointName[]).filter(a=>(a!=='paartanz'||layout.danceFloor)&&(a!=='troesten'||extra?.mourning)).map(a=><button key={a} onClick={()=>jointWithNpc(selected,a)}>{JOINTS[a].label}</button>)}</div>})()}
          <div className="chat"><input value={message} maxLength={400} disabled={endedBy===selected.id} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void talk()}} placeholder={endedBy===selected.id?'Gespräch beendet':'Kurze Antwort …'}/><button disabled={sending||!message.trim()||endedBy===selected.id} onClick={()=>void talk()}>{sending?'…':'Sprechen'}</button></div><ConversationReport npcId={selected.id} compact/>
        </>}
        {!closed&&<div className="moves">
          {!gateOpen&&layout.entry?<button onClick={()=>walkTo(layout.entry!.payAt)}>Zum Türsteher</button>:!nearService&&<button onClick={()=>walkTo(layout.servicePoint)}>{fitting.goToServiceLabel(service)}</button>}
          {fitting.sideDoor&&!nearSide&&entryAllows(layout,fitting.sideDoor,gateOpen)&&<button onClick={()=>walkTo({x:fitting.sideDoor!.x,y:fitting.sideDoor!.y},()=>fitting.sideDoor!.use(ctxRef.current??ctx))}>{fitting.sideDoor.goLabel}</button>}
          {onFloor&&!seat&&<button onClick={()=>{const next=!dancing;setDancing(next);setStatus(next?'Du tanzt.':'Du hörst auf zu tanzen.')}}>{dancing?'Aufhören':'Tanzen'}</button>}
          {seat?<button onClick={()=>setSeat(null)}>Aufstehen</button>:nextSeat&&<button onClick={()=>sitAt(nextSeat)}>Hinsetzen</button>}
          {waiter&&waiterName&&(tablePhase==='coming'||tablePhase==='at-table')&&selected?.id!==waiter.id&&<button onClick={()=>ctx.talkTo(waiter)}>Mit {waiterName} sprechen</button>}
          {tableMate&&selected?.id!==tableMate.id&&selected&&selected.id===waiter?.id&&<button onClick={()=>select(tableMate)}>Mit {personSceneLabel(tableMate)} weitersprechen</button>}
        </div>}
        <button className="give-open block" onClick={()=>setEditingFigure(true)}>Deine Figur gestalten …</button>
        {!closed&&<div className="moves gestures"><small>GESTEN · auch im Chat: /winken, /prost, /hand …</small>{myPose&&FOLLOW_JOINTS.has(myPose.name)&&<button className="on" onClick={()=>{setMyPose(null);following.current=false;setNpcJoint(null);setStatus('Ihr lasst los.')}}>Loslassen</button>}{(Object.keys(GESTURES) as GestureName[]).map(g=><button key={g} className={poseNow(myPose,nowMs)===g?'on':''} onClick={()=>poseNow(myPose,nowMs)===g?setMyPose(null):doGesture(g)}>{GESTURES[g].label}</button>)}</div>}
        {!closed&&fitting.renderOffer(ctx)}
        {fitting.renderOwner?.(ctx)}
        {!closed&&!selected&&gates.length>0&&<div className="menu learn">
          <small>WISSEN HIER</small>
          {gates.filter(g=>!g.open).map(g=><div key={g.id} className={'gate '+g.need}>
            <p><b>{g.need==='required'?'🔒 ':''}{g.label}</b> – {g.why}.</p>
            <button disabled={!g.moduleId} onClick={()=>openLearning(g.id)}>{g.moduleId?'Lernen: „'+g.moduleTitle+'“':'„'+g.moduleTitle+'“ – Lernmodul folgt'}</button>
          </div>)}
          {gates.some(g=>g.open)&&<p className="hint">✓ {gates.filter(g=>g.open).map(g=>g.label).join(' · ')}</p>}
        </div>}
        {status&&<div className="status">{status}</div>}
        {nearestNpc&&<div className="near">Nächste Person: {personSceneLabel(nearestNpc.resident)} · {nearestNpc.figure.spot.label}</div>}
      </aside>
    </main>
    {editingFigure&&<FigureEditor onClose={text=>{setEditingFigure(false);if(text)setStatus(text)}}/>}
    {learning&&(()=>{const gate=gates.find(g=>g.id===learning);if(!gate?.moduleId)return null;return <div className="learn-overlay" role="dialog" aria-label={'Lernmodul '+gate.moduleTitle}>
      <div className="sheet">
        <div className="bar"><div><small>LERNEN {fitting.locative.toUpperCase()}</small><b>{gate.moduleTitle}</b><span>{gate.label} – {gate.why}.</span></div><button onClick={()=>setLearning(null)}>Zurück in den Raum</button></div>
        <div className="body"><SsfModuleRenderer moduleId={gate.moduleId} onComplete={result=>{
          setStatus('Lernmodul abgeschlossen: „'+gate.moduleTitle+'“'+(result.points>0?' · +'+result.points+' Wissen':''))
          void loadGates();fitting.onLearned?.(gate.id)
        }}/></div>
      </div>
    </div>})()}
    <style jsx global>{`.walkable-interior{position:fixed;inset:44px 0 0;z-index:2600;background:#0d1718;color:#eef2ed;font-family:system-ui}.walkable-interior header{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#10272a;border-bottom:1px solid #476263}.walkable-interior header small,.walkable-interior header b,.walkable-interior header span{display:block}.walkable-interior header small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}.walkable-interior header b{margin-top:2px}.walkable-interior header span{font-size:9px;color:#91a7a7}.walkable-interior header button{border:1px solid #5a7472;background:#17383a;color:#eef2ed;border-radius:6px;padding:7px 10px;cursor:pointer}.walkable-interior main{display:grid;grid-template-columns:minmax(0,1fr) 320px;height:calc(100% - 54px)}.walkable-interior .room{position:relative;width:min(100%,760px);height:470px;margin:28px auto;background:linear-gradient(var(--wall) 0 12%,var(--panel) 12% 19%,var(--rail) 19% 20%,var(--floor) 20% 100%);border:12px solid #5c4431;box-shadow:0 18px 50px #0008,inset 0 0 120px #00000055;overflow:hidden}.walkable-interior .room.cafe{--wall:#e9d9b8;--panel:#b98b5d;--rail:#7a5436;--floor:#c08a56;--plank:#a9733f;--top:#e5c79a}.walkable-interior .room.bar{--wall:#4a3340;--panel:#3a2229;--rail:#1f1316;--floor:#5a3b2a;--plank:#4a2f20;--top:#8a6a4c}.walkable-interior .room.hotel{--wall:#e6dccb;--panel:#c9b291;--rail:#8d6e4e;--floor:#d6cdbd;--plank:#c4b6a0;--top:#efe6d6}.walkable-interior .room.restaurant{--wall:#efe3d3;--panel:#8a4a3e;--rail:#5e3027;--floor:#b9875a;--plank:#a3703f;--top:#ead3b0}.walkable-interior .room:after{content:'';position:absolute;inset:20% 0 0;background-image:linear-gradient(var(--plank) 1px,transparent 1px),linear-gradient(90deg,#0000001a 1px,transparent 1px);background-size:100% 18px,160px 18px;background-position:0 0,40px 0;opacity:.55;pointer-events:none}.walkable-interior .room:before{content:'';position:absolute;inset:12% 0 81%;background:repeating-linear-gradient(90deg,transparent 0 34px,#0000001c 34px 36px);pointer-events:none}.walkable-interior .window{position:absolute;top:14px;height:44px;background:linear-gradient(#9fd0e6,#d9ecf3 70%,#b8d9a3);border:6px solid #6d4f37;box-shadow:inset 0 0 10px #ffffff88,0 6px 0 -2px #5a3f2b}.walkable-interior .window i{position:absolute;inset:0;background:linear-gradient(#6d4f37,#6d4f37) center/100% 3px no-repeat,linear-gradient(#6d4f37,#6d4f37) center/3px 100% no-repeat}.walkable-interior .window em{position:absolute;left:-6px;right:-6px;bottom:-12px;height:6px;background:#8c6a48;border-radius:0 0 3px 3px}.walkable-interior .room.bar .window{background:linear-gradient(#1d2b45,#3b5870 70%,#2a3a3a)}.walkable-interior .door{position:absolute;left:45px;bottom:0;width:86px;height:55px;background:linear-gradient(90deg,#4a382c,#5c463a 50%,#4a382c);border:5px solid #6a4d37;border-bottom:0;display:grid;place-items:start center}.walkable-interior .door:after{content:'';position:absolute;right:12px;top:26px;width:6px;height:6px;border-radius:50%;background:#d8b35a}.walkable-interior .door small{margin-top:-18px;padding:1px 5px;background:#1d6b3a;color:#dff5e3;font:700 6px monospace;letter-spacing:.1em;border-radius:2px}.walkable-interior .f{position:absolute;z-index:2}.walkable-interior .table{background:radial-gradient(circle at 40% 35%,var(--top),#b07a48 70%,#7a4d2c);border:3px solid #4e3525;border-radius:50%;box-shadow:0 4px 0 #3a2518,0 8px 10px #0005}.walkable-interior .table:after{content:'';position:absolute;left:50%;top:50%;width:9px;height:9px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 40% 40%,#f6f1e4,#cdd6c4);box-shadow:0 -5px 0 -1px #c84d4d,0 1px 2px #0006}.walkable-interior .room.restaurant .table:after{background:#fff;box-shadow:0 -6px 0 -1px #e8b84a,0 1px 2px #0006}.walkable-interior .high-table{background:#3a2a22;border:4px solid #c9a35a;border-radius:50%}.walkable-interior .chair{background:linear-gradient(#8b5a3a,#6e4529);border:2px solid #3b281c;border-radius:6px 6px 3px 3px;box-shadow:inset 0 3px 0 #a26f47,0 2px 0 #2a1a12}.walkable-interior .room.bar .chair{background:linear-gradient(#7a2f2a,#5a221e);box-shadow:inset 0 3px 0 #9a3f38,0 2px 0 #2a1a12}.walkable-interior .stool{background:#8a3b34;border:2px solid #3d1b18;border-radius:50%}.walkable-interior .counter{background:linear-gradient(#efe6d6 0 30%,#67432b 30%);border:4px solid #40291e;border-radius:5px;box-shadow:0 6px 0 #2e1d14,0 10px 14px #0006;overflow:visible}.walkable-interior .counter .machine{position:absolute;right:10px;top:-14px;width:22px;height:16px;background:linear-gradient(#5b6168,#2c3136);border-radius:3px 3px 1px 1px;box-shadow:inset 0 2px 0 #9aa3a8}.walkable-interior .counter .machine:after{content:'';position:absolute;left:5px;bottom:-4px;width:12px;height:4px;background:#1b1f22;border-radius:0 0 2px 2px}.walkable-interior .counter .vitrine{position:absolute;left:10px;top:-14px;display:flex;gap:2px;padding:1px 3px;background:#ffffffb8;border:1px solid #9fb3b8;border-radius:3px 3px 0 0;box-shadow:inset 0 0 6px #fff}.walkable-interior .room.bar .counter{background:linear-gradient(#2a1d18 0 30%,#3c2a22 30%)}.walkable-interior .room.bar .counter .vitrine{display:none}.walkable-interior .room.bar .counter .machine{background:linear-gradient(#c9a35a,#7a5a2a)}.walkable-interior .shelf{background:repeating-linear-gradient(90deg,#c9a35a 0 4px,#3f2a1e 4px 7px,#8a9a4a 7px 10px,#3f2a1e 10px 14px,#b85a3a 14px 17px,#3f2a1e 17px 22px);border:2px solid #2a1a12;border-radius:2px;box-shadow:0 3px 0 #1a100a}.walkable-interior .room.hotel .shelf{background:radial-gradient(circle,#e8c35a 1.5px,transparent 2px) 6px 50%/14px 8px repeat-x,#3a2a1e}.walkable-interior .desk{background:linear-gradient(#efe6d6 0 35%,#67432b 35%);border:3px solid #40291e;border-radius:4px;box-shadow:0 5px 0 #2e1d14,0 8px 10px #0005}.walkable-interior .wall{background:#5c4431}.walkable-interior .pass{background:#d8c9a8;border:3px solid #40291e;z-index:3}.walkable-interior .stairs{background:repeating-linear-gradient(90deg,#8a6a4c 0 8px,#6f5238 8px 10px);border:3px solid #40291e;border-radius:3px}.walkable-interior .kitchen{background:repeating-linear-gradient(45deg,#9aa3a3 0 8px,#8b9494 8px 16px);z-index:1}.walkable-interior .closed{position:absolute;inset:0;z-index:15;background:#0b1214cc;display:grid;place-content:center;justify-items:center;gap:6px;color:#ead3a4}.walkable-interior .closed b{font:800 20px monospace;letter-spacing:.2em}.walkable-interior .closed span{font-size:11px;color:#b9cbc6}.walkable-interior .menu button{display:grid;grid-template-columns:1fr auto;gap:2px 10px;width:100%;margin-top:6px;padding:8px 10px;text-align:left;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;cursor:pointer;font-size:12px}.walkable-interior .menu button b{color:#f1d57a}.walkable-interior .menu button small{grid-column:1/-1;color:#d9a48a;font-size:10px}.walkable-interior .menu button:disabled{cursor:not-allowed;background:#102526;border-color:#2d4445;color:#7f9591}.walkable-interior .menu button:disabled b{color:#7f9591}.walkable-interior .label{position:absolute;z-index:3;transform:translate(-50%,-50%);color:#ead3a4;font:800 8px monospace;letter-spacing:.08em;pointer-events:none;text-shadow:0 1px 2px #000a}.walkable-interior .npc{position:absolute;z-index:8}.walkable-interior .rug{position:absolute;z-index:1;border-radius:6px;background:repeating-linear-gradient(45deg,#8f3b3b 0 10px,#a85050 10px 20px);opacity:.55;box-shadow:inset 0 0 0 6px #c99a6a99}.walkable-interior .room.bar .rug{background:repeating-linear-gradient(45deg,#3a2a4a 0 10px,#4a3660 10px 20px)}.walkable-interior .room.hotel .rug{background:repeating-linear-gradient(45deg,#4a5a7a 0 10px,#5e6f90 10px 20px)}.walkable-interior .lamp{position:absolute;z-index:1;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,#fff3c07a 0,#ffe8a833 42%,transparent 68%);pointer-events:none}.walkable-interior .lamp:after{content:'';position:absolute;left:50%;top:50%;width:100px;height:100px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#ffeec066 0,transparent 70%)}.walkable-interior .plant{position:absolute;z-index:4;width:28px;height:40px;pointer-events:none;filter:drop-shadow(0 3px 2px #0006)}.walkable-interior .plant i{position:absolute;left:4px;bottom:0;width:20px;height:14px;background:linear-gradient(#b5603a,#8c4528);border-radius:2px 2px 5px 5px}.walkable-interior .plant b{position:absolute;left:0;top:0;width:28px;height:30px;border-radius:50% 50% 45% 45%;background:radial-gradient(circle at 35% 35%,#8fc06a,#3f7a3a 60%,#2c5a2a)}.walkable-interior .plant b:after{content:'';position:absolute;left:9px;top:-6px;width:10px;height:18px;border-radius:50%;background:#5f9a4a;transform:rotate(-20deg)}.walkable-interior .seat-hit{position:absolute;z-index:8;width:22px;height:22px;padding:0;border:1px dashed transparent;border-radius:50%;background:transparent;cursor:pointer}.walkable-interior .seat-hit:hover,.walkable-interior .seat-hit:focus-visible{border-color:#f1d57a;background:#f1d57a33;outline:none}.walkable-interior .player.sitting i{height:16px;margin-top:6px}.walkable-interior .moves{display:flex;gap:6px;margin-top:10px}.walkable-interior .moves button{flex:1;padding:6px 8px;border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;cursor:pointer;font-size:11px}.walkable-interior .player{position:absolute;z-index:10;width:20px;height:28px}.walkable-interior .player i{display:block;width:14px;height:22px;margin:auto;background:#d7ad3c;border:2px solid #5c481c;border-radius:8px 8px 4px 4px}.walkable-interior .player span{position:absolute;top:-15px;left:50%;transform:translateX(-50%);background:#13262b;border:1px solid #d7ad3c;border-radius:4px;padding:1px 4px;font:700 8px monospace}.walkable-interior .context{position:absolute;z-index:20;border:1px solid #d0b66a;background:#153438;color:#f4e8c4;border-radius:5px;padding:5px 7px;font:800 8px monospace;cursor:pointer}.walkable-interior .item{position:absolute;z-index:9;pointer-events:auto;filter:drop-shadow(0 1px 1px #0006)}.walkable-interior .for{display:flex;gap:6px;margin-top:6px}.walkable-interior .desc{margin:-4px 0 6px;font-size:11px;color:#9fb5b0}.walkable-interior .menu .rooms{margin-top:8px;display:grid;gap:4px}.walkable-interior .menu .rooms p{margin:0;font-size:11px;color:#9fb5b0}.walkable-interior .menu .tiles{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:6px}.walkable-interior .menu button.tile{display:flex;flex-direction:column;align-items:center;gap:3px;margin:0;padding:8px 4px 7px;text-align:center}.walkable-interior .menu button.tile:disabled :global(svg){opacity:.35;filter:grayscale(1)}.walkable-interior .menu .for button{display:block;width:auto;flex:1;margin:0;padding:5px 8px;font-size:11px;text-align:center;background:#102526;border-color:#2d4445;color:#9fb5b0}.walkable-interior .menu .for button.on{background:#17383a;border-color:#d0b66a;color:#f4e8c4}.walkable-interior .context.hint{cursor:default;white-space:nowrap}.walkable-interior .menu{margin-top:12px;padding-top:10px;border-top:1px solid #2d4445}.walkable-interior .context.exit{background:#3a2b24}.walkable-interior aside{padding:16px;background:#091719;border-left:1px solid #40595a;overflow:auto}.walkable-interior aside small{color:#d9bb6a;font:800 8px monospace;letter-spacing:.12em}.walkable-interior aside h3{margin:4px 0 10px}.walkable-interior aside .portrait{display:flex;gap:10px;align-items:center;margin-bottom:6px}.walkable-interior .portrait h3{margin:0}.walkable-interior .portrait small{display:block;color:#9fb5b0;font-size:11px}.walkable-interior aside p{font-size:11px;line-height:1.45;color:#cbd6d2}.walkable-interior .history p{border-top:1px solid #2d4445;padding-top:7px}.walkable-interior .chat{display:flex;gap:6px;margin-top:10px}.walkable-interior .chat input{flex:1;min-width:0;background:#061012;color:#eef;border:1px solid #40595a;border-radius:5px;padding:7px}.walkable-interior .chat button{border:1px solid #5d7b79;background:#17383a;color:#fff;border-radius:5px;padding:0 9px}.walkable-interior .status,.walkable-interior .near{margin-top:10px;padding:8px;border:1px solid #485f5d;border-radius:6px;background:#102526;font-size:10px;color:#b9cbc6}.walkable-interior .near{color:#92aaa5}@media(max-width:900px){.walkable-interior main{grid-template-columns:1fr}.walkable-interior aside{position:absolute;right:10px;bottom:10px;width:min(320px,80vw);max-height:40vh;border:1px solid #40595a;border-radius:8px}}
    .walkable-interior .room.academy{--wall:#e4e8e6;--panel:#8fa3a0;--rail:#4f6663;--floor:#b9b2a3;--plank:#a69f90;--top:#efe9dc}.walkable-interior .room.academy .table{border-radius:6px;background:linear-gradient(#d9c9a8,#b9a076);box-shadow:0 4px 0 #6a5436}.walkable-interior .room.academy .table:after{display:none}.walkable-interior .lectern{background:linear-gradient(#8a6a46,#6a4c30);border:3px solid #3f2c1d;border-radius:4px 4px 2px 2px;box-shadow:0 4px 0 #2e1f14}.walkable-interior .board{background:#2f4f45;border:4px solid #8a6a46;box-shadow:inset 0 0 12px #0006}.walkable-interior .board:after{content:'';position:absolute;left:10px;top:4px;width:60%;height:3px;background:#e9e4d0aa;border-radius:2px}.walkable-interior .menu .tile .domain{font:800 7px monospace;letter-spacing:.1em;color:#9fb5b0}.walkable-interior .menu .open-school{margin-top:8px;width:100%;padding:8px;border:1px solid #d0b66a;background:#17383a;color:#f4e8c4;border-radius:5px;cursor:pointer;font-size:12px}.walkable-interior .hint{margin:6px 0 0;font-size:11px;color:#9fb5b0}.walkable-interior .room.administration{--wall:#e8e6df;--panel:#9aa5a3;--rail:#56635f;--floor:#cfc8ba;--plank:#bdb5a5;--top:#efe9dc}.walkable-interior .room.administration .counter{background:linear-gradient(#efe6d6 0 30%,#56635f 30%)}.walkable-interior .room.administration .counter .machine,.walkable-interior .room.administration .counter .vitrine{display:none}.walkable-interior .room.administration .rug{background:repeating-linear-gradient(45deg,#5a6b7a 0 10px,#6d7e8d 10px 20px)}.walkable-interior .menu .notice{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:4px 0 10px;font-size:11px}.walkable-interior .menu .notice dt{color:#9fb5b0}.walkable-interior .menu .notice dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}.walkable-interior .room.spaceport{--wall:#dfe6ea;--panel:#6f8591;--rail:#3c4f58;--floor:#9aa5aa;--plank:#8b969b;--top:#e6e9ea}.walkable-interior .room.spaceport .window{background:linear-gradient(#8fb6d6,#d8e8f2 60%,#b8c4c8);border-color:#3c4f58}.walkable-interior .room.spaceport .counter{background:linear-gradient(#e6e9ea 0 30%,#3c4f58 30%)}.walkable-interior .room.spaceport .counter .machine,.walkable-interior .room.spaceport .counter .vitrine{display:none}.walkable-interior .room.spaceport .board{background:#0f1f26;border-color:#3c4f58}.walkable-interior .room.spaceport .board:after{background:#4fd1c5cc}.walkable-interior .room.spaceport .chair{background:linear-gradient(#5b6b73,#3f4d54);box-shadow:inset 0 3px 0 #7d8c93,0 2px 0 #1f272b}.walkable-interior .room.spaceport .wall{background:#3c4f58}.walkable-interior .room.bank{--wall:#ebe7dd;--panel:#8a7a5a;--rail:#4e4330;--floor:#d9d2c3;--plank:#c8bfae;--top:#f1ebdf}.walkable-interior .room.bank .counter{background:linear-gradient(#f3eee4 0 30%,#4e4330 30%)}.walkable-interior .room.bank .counter .machine,.walkable-interior .room.bank .counter .vitrine{display:none}.walkable-interior .room.bank .board{background:#1c2a24;border-color:#8a7a5a}.walkable-interior .room.bank .board:after{background:#e8c35acc}.walkable-interior .room.bank .wall{background:#4e4330}.walkable-interior .room.bank .rug{background:repeating-linear-gradient(45deg,#6b3a3a 0 10px,#7d4848 10px 20px)}.walkable-interior .room.warehouse{--wall:#d9dcd8;--panel:#7b8a7a;--rail:#3f4a40;--floor:#9c9a92;--plank:#8c8a82;--top:#d7c7a2}.walkable-interior .room.warehouse .table{border-radius:3px;background:linear-gradient(#c9a86a,#a8863f);box-shadow:inset 0 0 0 3px #7a5a2a,0 4px 0 #4e3a1a}.walkable-interior .room.warehouse .table:after{display:none}.walkable-interior .room.warehouse .counter{background:linear-gradient(#d7c7a2 0 30%,#3f4a40 30%)}.walkable-interior .room.warehouse .counter .machine,.walkable-interior .room.warehouse .counter .vitrine{display:none}.walkable-interior .room.warehouse .board{background:#1f2a22;border-color:#7b8a7a}.walkable-interior .room.warehouse .shelf{background:repeating-linear-gradient(90deg,#8a7a5a 0 6px,#3f2a1e 6px 9px,#9aa3a3 9px 15px,#3f2a1e 15px 18px)}.walkable-interior .room.warehouse .lamp{background:radial-gradient(circle,#ffffff44 0,transparent 68%)}.walkable-interior .menu.learn .gate p{margin:6px 0 0}.walkable-interior .room.bank .table:after{display:none}.walkable-interior .room.nightclub{--wall:#1b1526;--panel:#251a36;--rail:#0e0a15;--floor:#1c1724;--plank:#272033;--top:#3a2d4d;border-color:#2a2038}.walkable-interior .room.nightclub:after{opacity:.25}.walkable-interior .dancefloor{position:absolute;z-index:1;border:3px solid #0b0810;box-shadow:0 0 30px #b14cff55,inset 0 0 20px #000a;background:repeating-conic-gradient(#2b1f45 0 25%,#3d2a63 0 50%) 0 0/36px 36px;overflow:hidden}.walkable-interior .dancefloor i{position:absolute;inset:-40%;background:radial-gradient(circle at 30% 40%,#ff4fd855 0,transparent 22%),radial-gradient(circle at 70% 60%,#4fd8ff55 0,transparent 22%),radial-gradient(circle at 50% 20%,#ffe14f44 0,transparent 18%);animation:club-lights 6s linear infinite}.walkable-interior .dancefloor.off{filter:grayscale(1) brightness(.5)}.walkable-interior .dancefloor.off i{display:none}@keyframes club-lights{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.walkable-interior .dj-booth{background:linear-gradient(#2c2238,#17111f);border:3px solid #0b0810;border-radius:4px;box-shadow:0 4px 0 #07050a,0 0 14px #4fd8ff66}.walkable-interior .dj-booth:after{content:'';position:absolute;left:12px;right:12px;top:8px;height:5px;border-radius:3px;background:linear-gradient(90deg,#ff4fd8,#4fd8ff,#ffe14f);box-shadow:0 0 8px #4fd8ff}.walkable-interior .sofa{background:linear-gradient(#5b2d7a,#3e1d56);border:2px solid #22102f;border-radius:7px;box-shadow:inset 0 3px 0 #7a43a0,0 2px 0 #12081a}.walkable-interior .room.nightclub .table{background:radial-gradient(circle at 40% 35%,#3a2d4d,#22192f 70%,#140e1c);border-color:#0b0810;box-shadow:0 0 10px #b14cff44}.walkable-interior .room.nightclub .table:after{background:#ff4fd8;box-shadow:0 0 8px #ff4fd8}.walkable-interior .room.nightclub .high-table{background:#140e1c;border-color:#4fd8ff}.walkable-interior .room.nightclub .counter{background:linear-gradient(#2c2238 0 30%,#17111f 30%);border-color:#0b0810;box-shadow:0 0 14px #ff4fd855,0 6px 0 #07050a}.walkable-interior .room.nightclub .counter .vitrine{display:none}.walkable-interior .room.nightclub .counter .machine{background:linear-gradient(#4fd8ff,#1a6a80)}.walkable-interior .room.nightclub .lamp{background:radial-gradient(circle,#b14cff33 0,transparent 65%)}.walkable-interior .room.nightclub .lamp:after{display:none}.walkable-interior .room.nightclub .label{color:#e9c8ff}.walkable-interior .player.dancing i{animation:club-dance .45s ease-in-out infinite alternate}@keyframes club-dance{0%{transform:translateY(0) rotate(-4deg)}100%{transform:translateY(-4px) rotate(4deg)}}@media(prefers-reduced-motion:reduce){.walkable-interior .dancefloor i,.walkable-interior .npc.dancing,.walkable-interior .player.dancing i{animation:none}}.walkable-interior .menu .task{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;padding:6px 8px;border:1px solid #3b5f55;border-radius:5px;background:#0f2a26;font-size:11px}.walkable-interior .menu .task>button{width:auto;margin:0;padding:4px 8px;display:block;text-align:center;font-size:11px;border-color:#d0b66a}.walkable-interior .menu .task .for{margin:0;flex-wrap:wrap;justify-content:flex-end}.walkable-interior .menu.shift p{margin:4px 0}.walkable-interior .menu.jobs button small{color:#9fb5b0}.walkable-interior .task-marker{position:absolute;z-index:12;pointer-events:none;display:flex;align-items:center;gap:3px}.walkable-interior .task-marker b{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#f1d57a;color:#3a2a00;font:900 11px monospace;box-shadow:0 0 0 3px #f1d57a55;animation:task-pulse 1.2s ease-in-out infinite}.walkable-interior .task-marker span{padding:1px 4px;border-radius:3px;background:#13262bdd;color:#f4e8c4;font:700 7px monospace;white-space:nowrap}@keyframes task-pulse{0%,100%{box-shadow:0 0 0 2px #f1d57a55}50%{box-shadow:0 0 0 6px #f1d57a22}}.walkable-interior .player.working span{white-space:nowrap}.walkable-interior .player.working i{background:#3b8f6a;border-color:#1f4d39}.walkable-interior .player.working span{border-color:#3b8f6a}.walkable-interior .dancefloor.mood-techno i{filter:hue-rotate(160deg) saturate(1.4)}.walkable-interior .dancefloor.mood-charts i{filter:hue-rotate(60deg)}.walkable-interior .dancefloor.mood-achtziger i{filter:hue-rotate(260deg) saturate(1.6)}@media(prefers-reduced-motion:reduce){.walkable-interior .task-marker b{animation:none}}.walkable-interior .rope{position:absolute;z-index:6;border-radius:3px;background:repeating-linear-gradient(90deg,#b0203a 0 10px,#d23a52 10px 20px);box-shadow:0 0 6px #ff4f6a88}.walkable-interior .door.side{width:60px;height:46px;background:linear-gradient(90deg,#5a4a3e,#6c5a4c 50%,#5a4a3e)}.walkable-interior .door.side small{background:#2f5d78;color:#e3f1fa}.walkable-interior .menu.learn .gate.required b{color:#f1d57a}.walkable-interior .menu.learn .gate button{display:block;text-align:center;font-size:11px;padding:6px 8px}.walkable-interior .learn-overlay{position:absolute;inset:54px 0 0;z-index:40;background:#050c0dcc;display:grid;place-items:center;padding:18px}.walkable-interior .learn-overlay .sheet{width:min(860px,100%);max-height:100%;display:flex;flex-direction:column;background:#fff;color:#1a1a18;border-radius:10px;overflow:hidden;box-shadow:0 20px 60px #000a}.walkable-interior .learn-overlay .bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;background:#10272a;color:#eef2ed}.walkable-interior .learn-overlay .bar small,.walkable-interior .learn-overlay .bar b,.walkable-interior .learn-overlay .bar span{display:block}.walkable-interior .learn-overlay .bar small{font:800 8px monospace;letter-spacing:.12em;color:#d9bb6a}.walkable-interior .learn-overlay .bar span{font-size:10px;color:#91a7a7}.walkable-interior .learn-overlay .bar button{border:1px solid #5a7472;background:#17383a;color:#eef2ed;border-radius:6px;padding:7px 10px;cursor:pointer;white-space:nowrap}.walkable-interior .learn-overlay .body{overflow:auto}.walkable-interior .hint.warn{color:#f1b07a}.walkable-interior .npc.with-player{transition:left .7s ease,top .7s ease}.walkable-interior .kiesel,.walkable-interior .peer{position:relative;display:block;width:38px;height:57px;padding:0;border:0;background:none;cursor:pointer;filter:drop-shadow(0 2px 1px #0005)}.walkable-interior .peer{position:absolute;z-index:9}.walkable-interior .kiesel.selected,.walkable-interior .peer.selected{filter:drop-shadow(0 0 5px #f1d57a)}.walkable-interior .kiesel>span{position:absolute;top:-14px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#13262bdd;border:1px solid #52677a;border-radius:4px;padding:1px 4px;font:700 8px monospace;color:#eee0c6}.walkable-interior .player.kiesel-player{width:38px;height:57px}.walkable-interior .player.kiesel-player>i{display:none}.walkable-interior .peer span{position:absolute;top:-15px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#13262b;border:1px solid #6fa8dc;border-radius:4px;padding:1px 4px;font:700 8px monospace;color:#e3f1fa}.walkable-interior .peer em{position:absolute;top:-32px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#f4e8c4;color:#2b2018;border-radius:8px;padding:1px 6px;font:700 9px system-ui;font-style:normal}.walkable-interior .give-open.block{display:block}.walkable-interior .room-chat{margin-bottom:10px;padding:8px;border:1px solid #2f5d78;border-radius:6px;background:#0b1d24}.walkable-interior .room-chat .lines{max-height:150px;overflow:auto}.walkable-interior .room-chat .lines p{margin:3px 0;font-size:11px}.walkable-interior .room-chat .report{margin-left:6px;border:0;background:none;color:#7f9591;font:600 9px system-ui;text-decoration:underline;cursor:pointer;padding:0}.walkable-interior .peer-panel{margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #2d4445}.walkable-interior .peer-panel h3{margin:2px 0 4px}.walkable-interior .give-open{margin-top:6px;border:0;background:none;color:#9fb5b0;font:600 10px system-ui;text-decoration:underline;cursor:pointer;padding:0}.walkable-interior .chat.give input{max-width:90px}.walkable-interior .moves.gestures,.walkable-interior .moves.joint{flex-wrap:wrap;gap:4px;margin-top:6px}.walkable-interior .moves.gestures small,.walkable-interior .moves.joint small{flex-basis:100%;font:800 8px monospace;letter-spacing:.1em;color:#9fb5b0}.walkable-interior .moves.gestures button,.walkable-interior .moves.joint button{flex:0 0 auto;padding:4px 7px;font-size:11px}.walkable-interior .moves.gestures button.on{border-color:#f1d57a;color:#f1d57a}.walkable-interior .moves.range{margin-top:6px}.walkable-interior .moves.range button{font-size:10px;padding:4px 6px}.walkable-interior .moves.range button.on{border-color:#f1d57a;color:#f1d57a}.walkable-interior .room-chat p.whisper{font-style:italic;color:#c9b8e8}.walkable-interior .room-chat p.shout b{color:#f1b07a}.walkable-interior .deco{position:absolute;z-index:3;pointer-events:none}.walkable-interior .deco.movable{pointer-events:auto;cursor:grab;outline:1px dashed #f1d57a88;outline-offset:3px}.walkable-interior .deco .rm{position:absolute;right:-12px;top:-12px;width:16px;height:16px;padding:0;border:0;border-radius:50%;background:#b0203a;color:#fff;font-size:11px;line-height:16px;cursor:pointer}.walkable-interior .deco.pflanze{width:28px;height:40px;margin:-26px 0 0 -14px;filter:drop-shadow(0 3px 2px #0006)}.walkable-interior .deco.pflanze i{position:absolute;left:4px;bottom:0;width:20px;height:14px;background:linear-gradient(#b5603a,#8c4528);border-radius:2px 2px 5px 5px}.walkable-interior .deco.pflanze b{position:absolute;left:0;top:0;width:28px;height:30px;border-radius:50% 50% 45% 45%;background:radial-gradient(circle at 35% 35%,#8fc06a,#3f7a3a 60%,#2c5a2a)}.walkable-interior .deco.stehlampe{width:16px;height:48px;margin:-44px 0 0 -8px}.walkable-interior .deco.stehlampe i{position:absolute;left:7px;top:10px;width:2px;height:36px;background:#3a3a3a;box-shadow:-5px 36px 0 0 #3a3a3a,5px 36px 0 0 #3a3a3a}.walkable-interior .deco.stehlampe:before{content:'';position:absolute;left:0;top:0;width:16px;height:12px;border-radius:8px 8px 2px 2px;background:#f4e3b0;box-shadow:0 0 22px 10px #ffe8a855}.walkable-interior .deco.bild{width:40px;height:28px;margin:-14px 0 0 -20px}.walkable-interior .deco.bild i{position:absolute;inset:0;border:4px solid #8a6a46;background:linear-gradient(135deg,#6fa0c8,#e8c35a 55%,#5a8a4a);box-shadow:0 2px 3px #0006}.walkable-interior .deco.girlande{width:120px;height:16px;margin:-8px 0 0 -60px}.walkable-interior .deco.girlande i{position:absolute;inset:0;background:conic-gradient(from 135deg at 50% 0,#e2574c 0 25%,transparent 0) 0 0/20px 16px,conic-gradient(from 135deg at 50% 0,#f1d57a 0 25%,transparent 0) 10px 0/20px 16px;border-top:2px solid #6b5a4a}.walkable-interior .deco.teppich{width:110px;height:56px;margin:-28px 0 0 -55px;z-index:1}.walkable-interior .deco.teppich i{position:absolute;inset:0;border-radius:6px;background:repeating-linear-gradient(90deg,#7a3b5a 0 10px,#8f4f6b 10px 20px);opacity:.75;box-shadow:inset 0 0 0 5px #d9b56388}.walkable-interior .deco.kerzen{width:20px;height:16px;margin:-12px 0 0 -10px;z-index:4}.walkable-interior .deco.kerzen i{position:absolute;left:3px;bottom:0;width:4px;height:10px;background:#f4efe6;box-shadow:7px 2px 0 0 #f4efe6,0 -4px 6px 2px #ffd46a88}.walkable-interior .drag-table{position:absolute;z-index:7;border:2px dashed #f1d57a;border-radius:8px;background:#f1d57a14;cursor:grab;touch-action:none}.walkable-interior .room.editing{outline:2px solid #f1d57a55}.walkable-interior .moves.ban small{color:#f1b07a}.walkable-interior .invite{margin-bottom:10px;padding:8px;border:1px solid #f1d57a;border-radius:6px;background:#2a2410}.walkable-interior .invite p{margin:0 0 4px;font-size:12px}
/* ── 2,5D (06.11.2026): orthografisch gekippter Raum, aufrechte Figuren, futuristische Kanten ── */
.walkable-interior .iso-stage{position:relative;height:100%;min-height:560px;overflow:hidden;background:radial-gradient(120% 90% at 50% 18%,#15262b 0,#0a1113 72%)}
.walkable-interior .iso-stage:before{content:'';position:absolute;inset:0;background:linear-gradient(transparent 0 calc(100% - 1px),#4fd8ff10 calc(100% - 1px)) 0 0/100% 34px;pointer-events:none}
.walkable-interior .room.iso{position:absolute;left:50%;top:56%;margin:0;width:760px;height:470px;border:0;border-radius:0;transform-style:preserve-3d;overflow:visible;box-shadow:none;
  --accent:#4fd8ff;--wallTop:#22323a;--wallBase:#2d434c;
  background:linear-gradient(#ffffff0c 1px,transparent 1px) 0 0/38px 38px,linear-gradient(90deg,#ffffff0c 1px,transparent 1px) 0 0/38px 38px,var(--floor)}
.walkable-interior .room.iso:before{display:none}
.walkable-interior .room.iso:after{inset:0;opacity:.35}
.walkable-interior .room.iso.cafe,.walkable-interior .room.iso.restaurant{--accent:#ffb86b;--wallTop:#d9cbb0;--wallBase:#efe4cf}
.walkable-interior .room.iso.bar{--accent:#ff8a5b;--wallTop:#2e1f27;--wallBase:#4a3340}
.walkable-interior .room.iso.nightclub{--accent:#ff4fd8;--wallTop:#120d1c;--wallBase:#241a36}
.walkable-interior .room.iso.hotel{--accent:#e8c35a;--wallTop:#cbbfa9;--wallBase:#e6dccb}
.walkable-interior .room.iso.bank{--accent:#e8c35a;--wallTop:#cdc6b6;--wallBase:#ebe7dd}
.walkable-interior .room.iso.police{--accent:#6fa8ff;--wallTop:#c6d0d6;--wallBase:#e2e8ec}
.walkable-interior .room.iso.fire_station{--accent:#ff5a3a;--wallTop:#b9c0c6;--wallBase:#dfe3e6}
.walkable-interior .room.iso.doctors,.walkable-interior .room.iso.hospital{--accent:#5fe0c8;--wallTop:#cfdcdc;--wallBase:#eef4f3}
.walkable-interior .room.iso.spaceport,.walkable-interior .room.iso.academy,.walkable-interior .room.iso.administration{--accent:#4fd8ff}
.walkable-interior .room.police{--wall:#e2e8ec;--panel:#2c4a7c;--rail:#1f2b45;--floor:#a7b0b4;--plank:#99a3a7;--top:#eef2f4}
.walkable-interior .room.fire_station{--wall:#dfe3e6;--panel:#a6261d;--rail:#5a1410;--floor:#8f969b;--plank:#81888d;--top:#e6e9ea}
.walkable-interior .room.doctors,.walkable-interior .room.hospital{--wall:#eef4f3;--panel:#5fa89a;--rail:#2f6b60;--floor:#d9e2e0;--plank:#c9d4d2;--top:#f4f8f7}
.walkable-interior .room.iso .f.wall{--h:70px;background:linear-gradient(var(--wallBase),var(--wallTop))!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 40%,transparent)}
.walkable-interior .room.iso .pin{position:absolute;width:0;height:0;pointer-events:none}
.walkable-interior .room:not(.iso) .pin{position:absolute;width:0;height:0;pointer-events:none}
/* Rückwände: Nord (y = 0) und Ost (x = Breite), mit Leuchtkante oben und unten */
.walkable-interior .wall3d{position:absolute;top:-150px;height:150px;transform-origin:0 100%;pointer-events:none;
  background:linear-gradient(var(--wallTop),var(--wallBase) 70%,color-mix(in srgb,var(--wallBase) 80%,#000));
  box-shadow:inset 0 3px 0 var(--accent),inset 0 -4px 0 color-mix(in srgb,var(--accent) 70%,#000)}
.walkable-interior .wall3d.n{left:0;width:760px;transform:rotateX(-90deg)}
.walkable-interior .wall3d.e{left:760px;width:470px;transform:rotateZ(90deg) rotateX(-90deg);filter:brightness(.86)}
.walkable-interior .wall3d .seam{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 94px,#0000001f 94px 96px,#ffffff10 96px 97px)}
.walkable-interior .wall3d:after{content:'';position:absolute;left:0;right:0;top:22px;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.55;box-shadow:0 0 12px var(--accent)}
.walkable-interior .wall3d .win{position:absolute;top:34px;height:72px;border:5px solid color-mix(in srgb,var(--wallTop) 60%,#fff);border-radius:3px;background:linear-gradient(#9fd0e6,#d9ecf3 70%,#b8d9a3);box-shadow:0 0 0 1px var(--accent),inset 0 0 14px #fff8}
.walkable-interior .room.iso.nightclub .wall3d .win,.walkable-interior .room.iso.bar .wall3d .win{background:linear-gradient(#1d2b45,#3b5870 70%,#2a3a3a)}
.walkable-interior .room.iso .window{display:none}
/* Möbel: Oberseite angehoben, Seiten aus derselben Fläche, dunkler */
.walkable-interior .room.iso .f{transform-style:preserve-3d;transform:translateZ(var(--h,30px));--h:30px}
.walkable-interior .room.iso .f>.fs,.walkable-interior .room.iso .f>.fw{position:absolute;display:block;background:inherit;border:0;border-radius:0;box-shadow:none;pointer-events:none}
.walkable-interior .room.iso .f>.fs{left:0;top:100%;width:100%;height:var(--h);transform-origin:50% 0;transform:rotateX(-90deg);filter:brightness(.55)}
.walkable-interior .room.iso .f>.fw{right:100%;top:0;width:var(--h);height:100%;transform-origin:100% 50%;transform:rotateY(-90deg);filter:brightness(.72)}
.walkable-interior .room.iso .f>.fs:after,.walkable-interior .room.iso .f>.fw:after{content:'';position:absolute;inset:0;border-top:1px solid color-mix(in srgb,var(--accent) 55%,transparent)}
.walkable-interior .room.iso .f.counter,.walkable-interior .room.iso .f.pass{--h:44px;box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 60%,transparent),0 0 16px color-mix(in srgb,var(--accent) 35%,transparent)}
.walkable-interior .room.iso .f.table,.walkable-interior .room.iso .f.desk{--h:28px}
.walkable-interior .room.iso .f.high-table{--h:42px}
.walkable-interior .room.iso .f.chair,.walkable-interior .room.iso .f.sofa{--h:16px}
.walkable-interior .room.iso .f.stool{--h:24px}
.walkable-interior .room.iso .f.shelf{--h:74px}
.walkable-interior .room.iso .f.dj-booth{--h:40px;box-shadow:0 0 18px var(--accent)}
.walkable-interior .room.iso .f.wall{--h:96px}
.walkable-interior .room.iso .f.kitchen,.walkable-interior .room.iso .f.lectern{--h:40px}
.walkable-interior .room.iso .f.stairs{--h:26px}
.walkable-interior .room.iso .f.vehicle{--h:70px}
.walkable-interior .room.iso .f.bed{--h:22px}
.walkable-interior .room.iso .f.locker{--h:80px}
.walkable-interior .room.iso .f.board{transform-origin:50% 100%;transform:translateZ(54px) rotateX(-90deg);height:26px!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 50%,#000)}
/* Tafeln an der Wand: Beschriftung auf der Tafel, nicht am Boden */
.walkable-interior .room.iso .f.board .board-text{position:absolute;left:8px;top:4px;font:800 10px/1 ui-monospace,monospace;letter-spacing:.14em;color:var(--accent);text-shadow:0 0 6px color-mix(in srgb,var(--accent) 70%,transparent)}
/* Trennwände als Milchglas: man sieht, was dahinter ist */
.walkable-interior .room.iso .f.wall{background:linear-gradient(#ffffff55,#e8f1f466)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 55%,transparent),inset 0 0 0 1px #fff8}
.walkable-interior .room.iso .f.wall>.fs,.walkable-interior .room.iso .f.wall>.fw{background:linear-gradient(#ffffff66,#dce8ec55 40%,#cfdde2aa);filter:none}
.walkable-interior .room.iso .f.wall>.fs:before,.walkable-interior .room.iso .f.wall>.fw:before{content:'';position:absolute;left:0;right:0;top:46%;height:6px;background:repeating-linear-gradient(90deg,#ffffffcc 0 10px,transparent 10px 14px);opacity:.7}
/* Regale je nach Haus: Ordner und Zeitschriften statt Flaschen */
.walkable-interior .room.iso .f.shelf-files,.walkable-interior .room.iso.bank .f.shelf,.walkable-interior .room.iso.job_agency .f.shelf{background:repeating-linear-gradient(90deg,#2f4f7a 0 9px,#f2f2ee 9px 10px,#4d4d55 10px 19px,#f2f2ee 19px 20px,#7a8fa8 20px 29px,#f2f2ee 29px 30px)!important;border:0}
.walkable-interior .room.iso .f.shelf-files>.fs,.walkable-interior .room.iso.bank .f.shelf>.fs,.walkable-interior .room.iso.job_agency .f.shelf>.fs{background:repeating-linear-gradient(#c9ccd0 0 2px,transparent 2px 24px),repeating-linear-gradient(90deg,#2f4f7a 0 9px,#4d4d55 9px 18px,#7a8fa8 18px 27px,#e8e8e2 27px 28px);filter:brightness(.8)}
.walkable-interior .room.iso .f.shelf-mags{background:repeating-linear-gradient(90deg,#f1c7a8 0 12px,#ffffff 12px 14px,#9fd3c7 14px 26px,#ffffff 26px 28px,#e7e0a2 28px 40px,#ffffff 40px 42px)!important;border:0}
.walkable-interior .room.iso .f.shelf-mags>.fs{background:repeating-linear-gradient(#e6ecea 0 3px,transparent 3px 24px),repeating-linear-gradient(90deg,#f1c7a8 0 12px,#9fd3c7 12px 24px,#e7e0a2 24px 36px,#fff 36px 38px);filter:brightness(.9)}
/* Empfangstresen in Praxis, Krankenhaus und Wache: hell statt Kneipenholz */
.walkable-interior .room.iso.doctors .f.counter,.walkable-interior .room.iso.hospital .f.counter{background:linear-gradient(#fbfdfd,#e3eeec)!important;border:0}
.walkable-interior .room.iso.doctors .f.counter>.fs,.walkable-interior .room.iso.hospital .f.counter>.fs{background:linear-gradient(transparent 0 70%,#5fe0c8 70% 74%,transparent 74%),#eef5f4;filter:brightness(.9)}
.walkable-interior .room.iso.doctors .f.counter>.fw,.walkable-interior .room.iso.hospital .f.counter>.fw{background:#e6efed;filter:brightness(.85)}
.walkable-interior .room.iso.police .f.counter{background:linear-gradient(#eef2f6,#c9d3de)!important;border:0}
.walkable-interior .room.iso.police .f.counter>.fs{background:linear-gradient(transparent 0 70%,#2c4a7c 70% 78%,transparent 78%),#d9e0e8;filter:brightness(.85)}
.walkable-interior .room.iso.police .f.counter>.fw{background:#cdd6e0;filter:brightness(.8)}
/* Löschfahrzeug: Fahrerhaus links mit Scheibe, Rollläden, weißer Streifen, Räder, Blaulicht */
.walkable-interior .room.iso .f.vehicle{background:linear-gradient(90deg,#b81d16 0 26%,#d42a20 26%)!important;border-radius:4px}
.walkable-interior .room.iso .f.vehicle:before{content:'';position:absolute;left:14px;top:18%;width:12px;height:64%;border-radius:3px;background:linear-gradient(#5ab8ff,#1d6fe0);box-shadow:0 0 14px #3a9bff;transform:translateZ(3px)}
.walkable-interior .room.iso .f.vehicle>.fs{background:radial-gradient(circle at 16% 100%,#1b1b1b 0 13px,#555 13px 15px,transparent 16px),radial-gradient(circle at 70% 100%,#1b1b1b 0 13px,#555 13px 15px,transparent 16px),radial-gradient(circle at 86% 100%,#1b1b1b 0 13px,#555 13px 15px,transparent 16px),linear-gradient(90deg,#9fd3ea 4% 22%,transparent 22%) 0 8px/100% 26px no-repeat,linear-gradient(transparent 62%,#f4f4f0 62% 70%,transparent 70%),repeating-linear-gradient(90deg,transparent 0 26%,#00000022 26% 27%),linear-gradient(90deg,#b31c15 0 26%,#c9231b 26%);filter:none}
.walkable-interior .room.iso .f.vehicle>.fw{background:linear-gradient(transparent 0 8%,#9fd3ea 8% 92%,transparent 92%) 0 6px/100% 26px no-repeat,linear-gradient(transparent 62%,#f4f4f0 62% 70%,transparent 70%),#a81a14;filter:none}
.walkable-interior .room.iso .fshadow{position:absolute;border-radius:6px;background:#0007;filter:blur(5px);pointer-events:none}
/* Aufrecht zur Kamera: Figuren, Namen, Knöpfe, Pflanzen */
.walkable-interior .room.iso .npc,.walkable-interior .room.iso .peer,.walkable-interior .room.iso .player,.walkable-interior .room.iso .plant,
.walkable-interior .room.iso .deco.pflanze,.walkable-interior .room.iso .deco.stehlampe,.walkable-interior .room.iso .task-marker,.walkable-interior .room.iso .item{
  transform-origin:50% 100%;transform:rotateZ(45deg) rotateX(-90deg) scaleY(1.155);transform-style:flat}
.walkable-interior .room.iso .label{transform-origin:0 0;transform:rotateZ(45deg) rotateX(-90deg) translate(-50%,-140%);color:var(--accent);text-shadow:0 0 6px color-mix(in srgb,var(--accent) 60%,transparent)}
.walkable-interior .room.iso .context{transform-origin:0 100%;transform:rotateZ(45deg) rotateX(-90deg) translateY(-30px);border-color:var(--accent);background:#0b1f26ee;box-shadow:0 0 10px color-mix(in srgb,var(--accent) 45%,transparent)}
.walkable-interior .room.iso .item{transform:rotateZ(45deg) rotateX(-90deg) translateY(-26px)}
.walkable-interior .room.iso .kiesel>span,.walkable-interior .room.iso .peer span,.walkable-interior .room.iso .player>span{top:-17px;background:#0b1f26e6;border:1px solid color-mix(in srgb,var(--accent) 70%,#fff0);color:#eaf8ff;box-shadow:0 0 8px color-mix(in srgb,var(--accent) 35%,transparent);font:700 8px ui-monospace,monospace;letter-spacing:.04em;padding:1px 5px;border-radius:3px}
.walkable-interior .room.iso .player>span{border-color:#f1d57a;color:#fff3cf}
.walkable-interior .room.iso .kiesel,.walkable-interior .room.iso .peer{filter:drop-shadow(0 2px 1px #0005)}
/* Chrome schneidet aufgestellte Flächen am Rand ab: Platz für das Namensschild oben in der Fläche selbst */
.walkable-interior .room.iso .npc{padding:20px 26px 0;margin:-20px 0 0 -26px}
.walkable-interior .room.iso .player,.walkable-interior .room.iso .peer{padding:20px 26px 0;margin:-20px 0 0 -26px;box-sizing:content-box}
.walkable-interior .room.iso .player>span,.walkable-interior .room.iso .peer>span{top:22px}
.walkable-interior .room.iso .kiesel>span{top:-7px}
.walkable-interior .room.iso .peer em{top:-2px}
.walkable-interior .room.iso .seat-hit{border-radius:50%}
.walkable-interior .room.iso .lamp{opacity:.85}
.walkable-interior .room.iso .dancefloor{box-shadow:0 0 40px color-mix(in srgb,var(--accent) 45%,transparent),inset 0 0 20px #000a}
.walkable-interior .room.iso .door{box-shadow:0 0 0 2px var(--accent)}
.walkable-interior .room.iso .drag-table{transform:translateZ(46px)}
.walkable-interior .iso-closed{position:absolute;inset:0;z-index:30;pointer-events:none}
.walkable-interior .head-actions{display:flex;gap:8px}
.walkable-interior .view-toggle{background:#0b1f26;border:1px solid #2f5d78;color:#cfe8f2}
.walkable-interior .flat-stage{display:contents}

/* ── 2,5D Teil 2 (06.11.2026): Kamera, modernes Café, Roboter, Alltag ── */
.walkable-interior .room.iso{transition:transform .45s cubic-bezier(.2,.7,.2,1)}
.walkable-interior .zoom-ctl{position:absolute;left:14px;bottom:14px;z-index:40;display:flex;gap:6px}
.walkable-interior .zoom-ctl button{min-width:34px;height:34px;padding:0 10px;border-radius:8px;border:1px solid #2f5d78;background:#0b1f26e6;color:#e6f6ff;font:700 15px system-ui;cursor:pointer}
.walkable-interior .zoom-ctl button:last-child{font-size:12px}
/* Tischfüße, Hängelampen (aufrecht) */
.walkable-interior .room.iso .leg{position:absolute;width:6px;height:26px;margin:-26px 0 0 -3px;background:linear-gradient(90deg,#3a3a3a,#6a6a6a,#3a3a3a);border-radius:2px;transform-origin:50% 100%;transform:rotateZ(45deg) rotateX(-90deg) scaleY(1.155);pointer-events:none}
.walkable-interior .room.iso .leg.high-table{height:40px;margin-top:-40px}
.walkable-interior .room.iso .leg.chair,.walkable-interior .room.iso .leg.stool{width:4px;height:14px;margin:-14px 0 0 -2px}
.walkable-interior .room.iso .pendant{position:absolute;width:24px;height:150px;margin:-150px 0 0 -12px;transform-origin:50% 100%;transform:rotateZ(45deg) rotateX(-90deg) scaleY(1.155);pointer-events:none}
.walkable-interior .room.iso .pendant i{position:absolute;left:11.5px;top:0;width:1px;height:62px;background:#2a2a2acc}
.walkable-interior .room.iso .pendant b{position:absolute;left:3px;top:60px;width:18px;height:14px;border-radius:9px 9px 4px 4px;background:radial-gradient(circle at 50% 85%,#fff7d6,#ffd98a 45%,#c9a25a 75%);box-shadow:0 10px 26px 8px #ffd98a55}
.walkable-interior .room.iso.nightclub .pendant b,.walkable-interior .room.iso.bar .pendant b{background:radial-gradient(circle at 50% 85%,#fff,var(--accent) 60%);box-shadow:0 10px 26px 8px color-mix(in srgb,var(--accent) 40%,transparent)}
.walkable-interior .room.iso.police .pendant,.walkable-interior .room.iso.fire_station .pendant,.walkable-interior .room.iso.doctors .pendant,.walkable-interior .room.iso.hospital .pendant,.walkable-interior .room.iso.bank .pendant{display:none}
/* Servierroboter */
.walkable-interior .room.iso .serve-robot{position:absolute;width:100px;height:84px;margin:-84px 0 0 -50px;padding-top:0;transform-origin:50% 100%;transform:rotateZ(45deg) rotateX(-90deg) scaleY(1.155);cursor:pointer}
.walkable-interior .room.iso .serve-robot svg{position:absolute;bottom:0;left:30px}
.walkable-interior .room.iso .serve-robot.flip svg{transform:scaleX(-1)}
.walkable-interior .room.iso .serve-robot .cargo{opacity:0;transition:opacity .3s}
.walkable-interior .room.iso .serve-robot.carrying .cargo{opacity:1}
.walkable-interior .room.iso .serve-robot>span{position:absolute;top:0;left:50%;transform:translateX(-50%);white-space:nowrap;background:#0b1f26e6;border:1px solid var(--accent);color:#eaf8ff;font:700 7px ui-monospace,monospace;padding:1px 4px;border-radius:3px}
/* Leuchtschrift an der Nordwand */
.walkable-interior .wall3d .neon-sign{position:absolute;left:52%;top:30px;transform:translateX(-50%);font:800 30px "Trebuchet MS",system-ui,sans-serif;letter-spacing:.06em;color:#fff;white-space:nowrap;text-shadow:0 0 4px #fff,0 0 12px var(--accent),0 0 26px var(--accent)}
/* Alltag: leises Atmen, Gleiten beim Platzwechsel */
@keyframes iso-breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.018)}}
.walkable-interior .room.iso .kiesel svg{transform-origin:50% 100%;animation:iso-breathe 3.4s ease-in-out infinite}
.walkable-interior .room.iso .npc:nth-child(3n) .kiesel svg{animation-duration:3.9s}
.walkable-interior .room.iso .npc:nth-child(3n+1) .kiesel svg{animation-duration:3.1s;animation-delay:-1s}
.walkable-interior .room.iso .npc{transition:left 1.1s linear,top 1.1s linear}
@media (prefers-reduced-motion:reduce){.walkable-interior .room.iso .kiesel svg{animation:none}.walkable-interior .room.iso,.walkable-interior .room.iso .npc{transition:none}}
/* Modernes Café (koreanisch inspiriert): hell, Holzlamellen, Terrazzo, Marmor, Pastell */
.walkable-interior .room.iso.cafe{--accent:#f2b880;--wallTop:#fbf9f5;--wallBase:#f3efe8;
  background:radial-gradient(circle at 20% 30%,#c9bfb2 0 1.2px,transparent 1.6px) 0 0/23px 19px,radial-gradient(circle at 70% 60%,#b7a99a 0 1px,transparent 1.5px) 0 0/31px 27px,radial-gradient(circle at 40% 80%,#e0b9a0 0 1.4px,transparent 1.8px) 0 0/41px 37px,linear-gradient(135deg,#efebe4,#e6e0d6)}
.walkable-interior .room.iso.cafe:after{display:none}
.walkable-interior .room.iso.cafe .wall3d{background:linear-gradient(#fbf9f5 0 48%,transparent 48%),repeating-linear-gradient(90deg,#d8b88e 0 9px,#c9a77b 9px 10px,#e2c49c 10px 11px),#d8b88e;box-shadow:inset 0 3px 0 #ffffff,inset 0 -5px 0 #b89268}
.walkable-interior .room.iso.cafe .wall3d:after{top:48%;height:3px;background:#b89268;box-shadow:none;opacity:1}
.walkable-interior .room.iso.cafe .wall3d .seam{display:none}
.walkable-interior .room.iso.cafe .wall3d .win{top:10px;height:96px;border:3px solid #2b2b2b;border-radius:14px 14px 4px 4px;background:linear-gradient(#cfe9f5,#eef7fb 60%,#cfe3c6);box-shadow:inset 0 0 18px #fff}
.walkable-interior .room.iso.cafe .neon-sign{top:6px;font-size:34px;color:#ff7a59;font-family:"Brush Script MT","Segoe Script",cursive;text-shadow:0 0 2px #ffd2bf,0 0 8px #ff7a59,0 0 18px #ff9a7a}
.walkable-interior .room.iso.cafe .rug{display:none}
.walkable-interior .room.iso.cafe .f.table{--h:30px;border-radius:50%;border:0;background:radial-gradient(circle at 34% 30%,#ffffff,#f1eee9 45%,#dcd6cd 80%);box-shadow:0 0 0 2px #c9c2b7}
.walkable-interior .room.iso.cafe .f.table:after{display:none}
.walkable-interior .room.iso.cafe .f.table>.fs,.walkable-interior .room.iso.cafe .f.table>.fw,.walkable-interior .room.iso.cafe .f.chair>.fs,.walkable-interior .room.iso.cafe .f.chair>.fw{display:none}
.walkable-interior .room.iso.cafe .f.chair{--h:18px;border-radius:50%;border:0;box-shadow:0 2px 0 #0002}
.walkable-interior .room.iso.cafe .f.chair.c0{background:#bcd3c1}.walkable-interior .room.iso.cafe .f.chair.c1{background:#f1c9c0}
.walkable-interior .room.iso.cafe .f.chair.c2{background:#f3e3b8}.walkable-interior .room.iso.cafe .f.chair.c3{background:#c9cfe6}
.walkable-interior .room.iso.cafe .leg.table{height:30px;margin-top:-30px;width:8px;margin-left:-4px;background:linear-gradient(90deg,#c9a77b,#e2c49c,#b89268)}
.walkable-interior .room.iso.cafe .leg.chair{background:linear-gradient(90deg,#c9a77b,#e2c49c)}
.walkable-interior .room.iso.cafe .f.counter{background:linear-gradient(135deg,#ffffff,#efece6);border:0;box-shadow:0 0 0 2px #e2ddd4}
.walkable-interior .room.iso.cafe .f.counter>.fs,.walkable-interior .room.iso.cafe .f.counter>.fw{background:repeating-linear-gradient(90deg,#d8b88e 0 8px,#c9a77b 8px 9px);filter:none}
.walkable-interior .room.iso.cafe .f.counter>.fw{filter:brightness(.88)}
.walkable-interior .room.iso.cafe .f.shelf{--h:64px;background:repeating-linear-gradient(90deg,#f3efe8 0 14px,#c98a5a 14px 18px,#f3efe8 18px 30px,#9ab06b 30px 36px,#f3efe8 36px 50px,#e8c35a 50px 54px);border:0}
.walkable-interior .room.iso.cafe .plant b{background:radial-gradient(circle at 35% 35%,#7fb06a,#2f6b3a 60%,#204a28);width:34px;height:36px;left:-3px;top:-6px}
.walkable-interior .room.iso.cafe .plant i{background:linear-gradient(#f3efe8,#d9d3c9);border-radius:3px 3px 8px 8px}
.walkable-interior .room.iso.cafe .lamp{opacity:.5}
.walkable-interior .room.iso.cafe .door{background:linear-gradient(90deg,#d9d3c9,#efebe4 50%,#d9d3c9);border-color:#2b2b2b;box-shadow:none}
`}</style>
  </div>
}
