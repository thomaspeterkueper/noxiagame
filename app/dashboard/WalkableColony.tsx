'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStreetTiles } from '@/lib/game/streetTiles'
import { BUILDINGS } from '@/lib/game/buildings/index'

interface TileEntity { id:string; entity_id:string; entity_type:string; tile_row:number; tile_col:number; profile_id:string|null; owner_class:string; actor_name?:string|null; username?:string|null }
interface Ship { id:string; ship_type:string; is_active:boolean; location_id:string }
interface Assignment { type:string; roleCode:string|null; tileEntityId:string|null }
interface Need { code:string; satisfaction:number }
interface Skill { code:string; level:number; experience:number }
interface Resident { id:string; displayName:string; birthYear:number|null; activityState:string; lastAction:string|null; assignments:Assignment[]; needs:Need[]; skills:Skill[] }
interface Props { locationSlug:string; locationName:string; population:number; entities:TileEntity[]; pending:any[]; ships:Ship[]; locationId:string; userId:string; onClose:()=>void; onEnterBuilding?:(entity:TileEntity)=>void }

type Selection = { kind:'building'; id:string } | { kind:'person'; id:string } | null

const COLS=32, ROWS=24, ISO_W=32, ISO_H=16, BLOCK_H=26
const CANVAS_W=(COLS+ROWS)*ISO_W+100, CANVAS_H=(COLS+ROWS)*ISO_H+200, MIN_ZOOM=.65, MAX_ZOOM=1.65
const C={road:'#5a5040',roadMain:'#6a6050',crossing:'#7a7060',habitat:'#4a6e5a',state:'#3a5a6e',corp:'#6e4a2a',figure:'#c9a961',npc:'#8fbca6',ship:'#6a9aca',text:'#e4dccd',selected:'#f1d57a'}

function isoProject(col:number,row:number){return{x:(col-row)*ISO_W+CANVAS_W/2,y:(col+row)*ISO_H+60}}
function labelForBuilding(entityId:string){return BUILDINGS[entityId]?.name ?? entityId.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function pct(v:number){return `${Math.round(v*100)}%`}
function assignmentOf(r:Resident,type:string){return r.assignments.find(a=>a.type===type)}

function drawFigure(ctx:CanvasRenderingContext2D,x:number,y:number,color:string,label=''){
  ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(x,y+2,6,2.5,0,0,Math.PI*2);ctx.fill()
  const b=y-3;ctx.fillStyle='#1b2936';ctx.fillRect(x-2.5,b-6,2,6);ctx.fillRect(x+.5,b-6,2,6)
  ctx.fillStyle='#2c5574';ctx.fillRect(x-3.5,b-14,7,8)
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,b-17,4,0,Math.PI*2);ctx.fill()
  if(label){ctx.fillStyle=C.text;ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillText(label,x,b-24)}
}
function drawIsoFloor(ctx:CanvasRenderingContext2D,col:number,row:number,color:string){const{x,y}=isoProject(col,row);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-ISO_H);ctx.lineTo(x+ISO_W,y);ctx.lineTo(x,y+ISO_H);ctx.lineTo(x-ISO_W,y);ctx.closePath();ctx.fill()}
function drawIsoBuilding(ctx:CanvasRenderingContext2D,col:number,row:number,topColor:string,label:string,icon:string,selected:boolean){
  const{x,y}=isoProject(col,row),topY=y-BLOCK_H
  const shade=(hex:string,f:number)=>{const c=hex.replace('#','');const n=(i:number)=>Math.max(0,Math.min(255,parseInt(c.slice(i,i+2),16)*f))|0;return`rgb(${n(0)},${n(2)},${n(4)})`}
  ctx.fillStyle=shade(topColor,.55);ctx.beginPath();ctx.moveTo(x-ISO_W,y);ctx.lineTo(x,y+ISO_H);ctx.lineTo(x,y+ISO_H-BLOCK_H);ctx.lineTo(x-ISO_W,y-BLOCK_H);ctx.closePath();ctx.fill()
  ctx.fillStyle=shade(topColor,.75);ctx.beginPath();ctx.moveTo(x,y+ISO_H);ctx.lineTo(x+ISO_W,y);ctx.lineTo(x+ISO_W,y-BLOCK_H);ctx.lineTo(x,y+ISO_H-BLOCK_H);ctx.closePath();ctx.fill()
  ctx.fillStyle=topColor;ctx.beginPath();ctx.moveTo(x,topY-ISO_H);ctx.lineTo(x+ISO_W,topY);ctx.lineTo(x,topY+ISO_H);ctx.lineTo(x-ISO_W,topY);ctx.closePath();ctx.fill();ctx.strokeStyle=selected?C.selected:'rgba(0,0,0,.35)';ctx.lineWidth=selected?3:1;ctx.stroke()
  ctx.font='13px serif';ctx.textAlign='center';ctx.fillText(icon,x,topY+4);ctx.fillStyle=C.text;ctx.font='7px monospace';ctx.fillText(label,x,y+ISO_H+10)
}
function drawShip(ctx:CanvasRenderingContext2D,cx:number,cy:number){ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(cx,cy+26,20,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=C.ship;ctx.beginPath();ctx.moveTo(cx,cy-22);ctx.lineTo(cx-16,cy+6);ctx.lineTo(cx-11,cy+18);ctx.lineTo(cx+11,cy+18);ctx.lineTo(cx+16,cy+6);ctx.closePath();ctx.fill()}

const panelStyle:React.CSSProperties={background:'#111926',border:'2px solid #5f6d7a',boxShadow:'inset 0 0 0 1px #0b1018',color:'#d8d4c8'}
const sectionStyle:React.CSSProperties={borderTop:'1px solid #465363',paddingTop:8,marginTop:8}
const actionStyle:React.CSSProperties={width:'100%',padding:'8px 10px',background:'#27394d',color:'#f2df9c',border:'2px outset #58697c',font:'bold 11px monospace',cursor:'pointer'}

export default function WalkableColony({locationSlug,locationName,population,entities,pending,ships,userId,onClose,onEnterBuilding}:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null),dragRef=useRef<{x:number;y:number;vx:number;vy:number}|null>(null)
  const[figPos,setFigPos]=useState({col:4.5,row:8.5}),[viewport,setViewport]=useState({x:Math.max(0,CANVAS_W/2-400),y:0}),[zoom,setZoom]=useState(1),[dragging,setDragging]=useState(false),[residents,setResidents]=useState<Resident[]>([]),[selection,setSelection]=useState<Selection>(null),[showPeople,setShowPeople]=useState(false)
  const streets=useMemo(()=>getStreetTiles(locationSlug,population,entities,pending,userId,COLS,ROWS),[locationSlug,population,entities,pending,userId])
  const playerHabitat=entities.find(e=>e.entity_id==='habitat'&&e.profile_id===userId),landingPad=entities.find(e=>e.entity_id==='landing_pad'||e.entity_id==='docking_bay'),hasShipAtLocation=ships.some(s=>s.is_active)
  const selectedBuilding=selection?.kind==='building'?entities.find(e=>e.id===selection.id)??null:null
  const selectedPerson=selection?.kind==='person'?residents.find(r=>r.id===selection.id)??null:null
  const clampViewport=useCallback((x:number,y:number,z=zoom)=>({x:Math.max(0,Math.min(CANVAS_W-800/z,x)),y:Math.max(0,Math.min(CANVAS_H-500/z,y))}),[zoom])
  const centerOn=useCallback((col:number,row:number,z=zoom)=>{const p=isoProject(col,row);setViewport(clampViewport(p.x-400/z,p.y-250/z,z))},[zoom,clampViewport])

  useEffect(()=>{if(playerHabitat){const p={col:playerHabitat.tile_col+.5,row:playerHabitat.tile_row+.5};setFigPos(p);centerOn(p.col,p.row)}},[playerHabitat?.id])
  useEffect(()=>{let live=true;fetch(`/api/game/population?locationSlug=${encodeURIComponent(locationSlug)}`).then(r=>r.ok?r.json():Promise.reject()).then(d=>{if(live)setResidents(Array.isArray(d.residents)?d.residents:[])}).catch(()=>{if(live)setResidents([])});return()=>{live=false}},[locationSlug])

  const residentPositions=useMemo(()=>residents.map((r,i)=>{const a=assignmentOf(r,'work')??r.assignments.find(x=>x.tileEntityId);const b=entities.find(e=>e.id===a?.tileEntityId);if(!b)return null;const slot=i%4;return{resident:r,col:b.tile_col+.18+(slot%2)*.38,row:b.tile_row+.15+Math.floor(slot/2)*.34,building:b}}).filter(Boolean) as {resident:Resident;col:number;row:number;building:TileEntity}[],[residents,entities])

  useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,CANVAS_W,CANVAS_H);ctx.fillStyle='#090e17';ctx.fillRect(0,0,CANVAS_W,CANVAS_H)
    const icons:Record<string,string>={habitat:'⌂',mine:'⛏',solar:'☀',landing_pad:'✈',docking_bay:'✈',bank:'¤',school:'◆',academy:'◆',research_lab:'⚗',shipyard:'⚙',warehouse:'▣',admin:'▤',command_center:'◉',water_recycler:'◌'}
    type Item={depth:number;draw:()=>void};const q:Item[]=[]
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const v=((c*7+r*13)%6)*4,s=streets.find(x=>x.col===c&&x.row===r),color=s?(s.subtype==='main'?C.roadMain:s.subtype==='crossing'?C.crossing:C.road):`rgb(${56+v},${49+v},${39+v})`;q.push({depth:(c+r)*2-1000,draw:()=>drawIsoFloor(ctx,c,r,color)})}
    for(const e of entities){if(e.entity_type!=='building')continue;const own=e.profile_id===userId,state=e.owner_class==='STATE',corp=!!e.profile_id&&!own,color=state?C.state:own?C.habitat:corp?C.corp:C.habitat;q.push({depth:e.tile_col+e.tile_row,draw:()=>drawIsoBuilding(ctx,e.tile_col,e.tile_row,color,labelForBuilding(e.entity_id),icons[e.entity_id]??'■',selection?.kind==='building'&&selection.id===e.id)})}
    if(landingPad&&hasShipAtLocation)q.push({depth:landingPad.tile_col+landingPad.tile_row+.5,draw:()=>{const p=isoProject(landingPad.tile_col,landingPad.tile_row);drawShip(ctx,p.x,p.y-BLOCK_H-10)}})
    for(const rp of residentPositions)q.push({depth:rp.col+rp.row+.25,draw:()=>{const p=isoProject(rp.col,rp.row);drawFigure(ctx,p.x,p.y,selection?.kind==='person'&&selection.id===rp.resident.id?C.selected:C.npc,'')}})
    q.push({depth:figPos.col+figPos.row+.3,draw:()=>{const p=isoProject(figPos.col,figPos.row);drawFigure(ctx,p.x,p.y,C.figure,'Du')}});q.sort((a,b)=>a.depth-b.depth);q.forEach(i=>i.draw())
  },[figPos,streets,entities,userId,landingPad,hasShipAtLocation,residentPositions,selection])

  const isoUnproject=useCallback((px:number,py:number)=>{const dx=px-CANVAS_W/2,dy=py-60;return{col:(dx/ISO_W+dy/ISO_H)/2,row:(dy/ISO_H-dx/ISO_W)/2}},[])
  const hitBuilding=useCallback((p:{col:number;row:number})=>entities.filter(e=>e.entity_type==='building').sort((a,b)=>(b.tile_col+b.tile_row)-(a.tile_col+a.tile_row)).find(e=>Math.abs(e.tile_col-p.col)<.8&&Math.abs(e.tile_row-p.row)<.8),[entities])
  const pointerToWorld=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{const rect=e.currentTarget.getBoundingClientRect(),px=(e.clientX-rect.left)/zoom+viewport.x,py=(e.clientY-rect.top)/zoom+viewport.y;return isoUnproject(px,py)},[zoom,viewport,isoUnproject])
  const handleClick=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{if(dragging)return;const hit=hitBuilding(pointerToWorld(e));if(hit){setSelection({kind:'building',id:hit.id});setShowPeople(false);return}setSelection(null)},[dragging,hitBuilding,pointerToWorld])
  const handleDoubleClick=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{const hit=hitBuilding(pointerToWorld(e));if(hit&&onEnterBuilding)onEnterBuilding(hit)},[hitBuilding,pointerToWorld,onEnterBuilding])
  const focusPerson=(r:Resident)=>{setSelection({kind:'person',id:r.id});setShowPeople(false);const rp=residentPositions.find(x=>x.resident.id===r.id);if(rp)centerOn(rp.col,rp.row)}
  const enterSelected=()=>{if(selectedBuilding&&onEnterBuilding)onEnterBuilding(selectedBuilding)}
  const wheel=useCallback((e:React.WheelEvent)=>{e.preventDefault();const next=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom*(e.deltaY>0?.9:1.1)));setZoom(next);setViewport(v=>clampViewport(v.x,v.y,next))},[zoom,clampViewport])
  const pointerDown=(e:React.PointerEvent)=>{dragRef.current={x:e.clientX,y:e.clientY,vx:viewport.x,vy:viewport.y};setDragging(false);e.currentTarget.setPointerCapture(e.pointerId)}
  const pointerMove=(e:React.PointerEvent)=>{const d=dragRef.current;if(!d)return;const dx=(e.clientX-d.x)/zoom,dy=(e.clientY-d.y)/zoom;if(Math.abs(dx)+Math.abs(dy)>4)setDragging(true);setViewport(clampViewport(d.vx-dx,d.vy-dy))}
  const pointerUp=(e:React.PointerEvent)=>{dragRef.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);setTimeout(()=>setDragging(false),0)}
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(selection){setSelection(null);return}onClose();return}if(e.key==='Enter'&&selectedBuilding){enterSelected();return}if(e.key.toLowerCase()==='f'){centerOn(figPos.col,figPos.row);return}const step=36/zoom;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){e.preventDefault();setViewport(v=>clampViewport(v.x+(e.key==='ArrowRight'||e.key==='d'?step:e.key==='ArrowLeft'||e.key==='a'?-step:0),v.y+(e.key==='ArrowDown'||e.key==='s'?step:e.key==='ArrowUp'||e.key==='w'?-step:0)))}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose,selection,selectedBuilding,zoom,clampViewport,centerOn,figPos])

  const workers=selectedBuilding?residents.filter(r=>r.assignments.some(a=>a.type==='work'&&a.tileEntityId===selectedBuilding.id)):[]
  const homeResidents=selectedBuilding?residents.filter(r=>r.assignments.some(a=>a.type==='home'&&a.tileEntityId===selectedBuilding.id)):[]
  const lowNeed=selectedPerson?[...selectedPerson.needs].sort((a,b)=>a.satisfaction-b.satisfaction)[0]:null
  const work=selectedPerson?assignmentOf(selectedPerson,'work'):null,home=selectedPerson?assignmentOf(selectedPerson,'home'):null
  const workBuilding=work?.tileEntityId?entities.find(e=>e.id===work.tileEntityId):null,homeBuilding=home?.tileEntityId?entities.find(e=>e.id===home.tileEntityId):null

  return <div style={{position:'absolute',inset:0,zIndex:100,background:'#0b1018',display:'grid',gridTemplateRows:'38px minmax(0,1fr) 46px',border:'3px ridge #6a7480',fontFamily:'monospace'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 10px',background:'#1a2736',borderBottom:'2px ridge #6a7480',color:'#f1d57a'}}>
      <div style={{fontWeight:700,fontSize:12}}>NOXIA · {locationName.toUpperCase()} <span style={{color:'#9eabb8',fontWeight:400}}>POP {population.toLocaleString()} · SIM {residents.length}</span></div>
      <div style={{display:'flex',gap:6}}><button onClick={()=>setShowPeople(v=>!v)} style={{...actionStyle,width:'auto',padding:'4px 9px'}}>PERSONEN [{residents.length}]</button><button onClick={onClose} style={{...actionStyle,width:'auto',padding:'4px 9px'}}>KARTE SCHLIESSEN</button></div>
    </header>

    <main style={{minHeight:0,display:'grid',gridTemplateColumns:'minmax(0,1fr) 260px',gap:0}}>
      <div style={{position:'relative',overflow:'hidden',background:'#050912'}} onWheel={wheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} onClick={handleClick} onDoubleClick={handleDoubleClick} style={{position:'absolute',left:0,top:0,transformOrigin:'0 0',transform:`translate(${-viewport.x*zoom}px,${-viewport.y*zoom}px) scale(${zoom})`,cursor:dragging?'grabbing':'crosshair',touchAction:'none'}}/>
        <div style={{position:'absolute',left:8,top:8,padding:'5px 7px',background:'rgba(9,14,23,.84)',border:'1px solid #536273',color:'#aebbc7',fontSize:9}}>KLICK: AUSWÄHLEN · DOPPELKLICK/ENTER: BETRETEN · ZIEHEN/WASD: KAMERA · F: FIGUR</div>
        <div style={{position:'absolute',right:8,bottom:8,display:'flex',gap:3}}><button onClick={()=>setZoom(z=>Math.max(MIN_ZOOM,z-.15))}>−</button><button onClick={()=>centerOn(figPos.col,figPos.row)}>F</button><button onClick={()=>setZoom(z=>Math.min(MAX_ZOOM,z+.15))}>+</button></div>
      </div>

      <aside style={{...panelStyle,minHeight:0,overflowY:'auto',padding:10}}>
        {showPeople?<><div style={{fontSize:11,fontWeight:700,color:'#f1d57a',marginBottom:8}}>BEVÖLKERUNG · {residents.length}</div>{residents.length===0?<div style={{fontSize:10,color:'#82909e'}}>Keine simulierten Personen.</div>:residents.map(r=>{const w=assignmentOf(r,'work');return <button key={r.id} onClick={()=>focusPerson(r)} style={{display:'block',width:'100%',textAlign:'left',padding:'7px',marginBottom:5,background:'#172231',border:'1px solid #536273',color:'#ddd6c7',cursor:'pointer'}}><strong>{r.displayName}</strong><br/><span style={{fontSize:9,color:'#8fbca6'}}>{w?.roleCode??r.activityState} · {r.lastAction??'idle'}</span></button>})}</>:
        selectedBuilding?<><div style={{fontSize:10,color:'#8fa1b4'}}>GEBÄUDE</div><div style={{fontSize:15,fontWeight:700,color:'#f1d57a',margin:'2px 0 8px'}}>{labelForBuilding(selectedBuilding.entity_id)}</div><div style={{fontSize:10,lineHeight:1.55}}>Koordinate {selectedBuilding.tile_col},{selectedBuilding.tile_row}<br/>Eigentum: {selectedBuilding.profile_id===userId?'du':selectedBuilding.owner_class==='STATE'?'staatlich':selectedBuilding.actor_name??selectedBuilding.username??'fremd'}</div><div style={sectionStyle}><div style={{fontSize:10,color:'#9eabb8'}}>PERSONAL</div><div style={{fontSize:11,marginTop:3}}>{workers.length} Arbeitende · {homeResidents.length} Wohnende</div>{workers.slice(0,5).map(r=><button key={r.id} onClick={()=>focusPerson(r)} style={{display:'block',background:'none',border:0,color:'#8fbca6',padding:'3px 0',cursor:'pointer',font:'10px monospace'}}>› {r.displayName} · {assignmentOf(r,'work')?.roleCode}</button>)}</div><div style={sectionStyle}><button onClick={enterSelected} disabled={!onEnterBuilding} style={{...actionStyle,opacity:onEnterBuilding?1:.45}}>BETRETEN</button><div style={{fontSize:9,color:'#8492a0',marginTop:5}}>Doppelklick auf das Gebäude öffnet ebenfalls den Innenraum.</div></div></>:
        selectedPerson?<><div style={{fontSize:10,color:'#8fa1b4'}}>PERSON</div><div style={{fontSize:15,fontWeight:700,color:'#f1d57a',margin:'2px 0'}}>{selectedPerson.displayName}</div><div style={{fontSize:10,color:'#8fbca6'}}>{work?.roleCode??selectedPerson.activityState} · {selectedPerson.lastAction??'idle'}</div><div style={sectionStyle}><div style={{fontSize:10,lineHeight:1.6}}>Arbeit: {workBuilding?labelForBuilding(workBuilding.entity_id):'—'}<br/>Wohnen: {homeBuilding?labelForBuilding(homeBuilding.entity_id):'—'}<br/>Geburtsjahr: {selectedPerson.birthYear??'—'}</div></div><div style={sectionStyle}><div style={{fontSize:10,color:'#9eabb8'}}>BEDÜRFNISSE</div>{selectedPerson.needs.map(n=><div key={n.code} style={{display:'grid',gridTemplateColumns:'1fr 40px',gap:5,fontSize:9,marginTop:3}}><span>{n.code}</span><span style={{textAlign:'right',color:n.satisfaction<.6?'#e7a36a':'#8fbca6'}}>{pct(n.satisfaction)}</span></div>)}</div><div style={sectionStyle}><div style={{fontSize:10,color:'#9eabb8'}}>KOMPETENZEN</div>{selectedPerson.skills.map(s=><div key={s.code} style={{fontSize:9,marginTop:3}}>{s.code}: {pct(s.level)} · XP {s.experience}</div>)}</div><div style={sectionStyle}><div style={{fontSize:10,color:'#9eabb8'}}>BEOBACHTUNG</div><div style={{fontSize:9,lineHeight:1.5,marginTop:3,color:lowNeed&&lowNeed.satisfaction<.6?'#e7a36a':'#aeb8c2'}}>{lowNeed&&lowNeed.satisfaction<.6?`${lowNeed.code} ist auffällig niedrig (${pct(lowNeed.satisfaction)}).`:'Keine kritische persönliche Abweichung erkannt.'}</div></div></>:
        <><div style={{fontSize:11,fontWeight:700,color:'#f1d57a'}}>KOLONIEKONTROLLE</div><div style={{fontSize:10,lineHeight:1.6,marginTop:8,color:'#b7c0c8'}}>Wähle ein Gebäude auf der Karte. Dort siehst du Personal, Eigentum und die Aktion <b>BETRETEN</b>.<br/><br/>Die Personenliste öffnet die simulierten Bewohner mit Tätigkeit, Bedürfnissen und Kompetenzen.</div></>}
      </aside>
    </main>

    <footer style={{display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',gap:10,padding:'0 10px',background:'#172230',borderTop:'2px ridge #6a7480',color:'#9eabb8',fontSize:9}}><div>{selection?.kind==='building'?`AUSWAHL: ${selectedBuilding?labelForBuilding(selectedBuilding.entity_id):'—'}`:selection?.kind==='person'?`AUSWAHL: ${selectedPerson?.displayName??'—'}`:'BEREIT'} · {entities.filter(e=>e.entity_type==='building').length} GEBÄUDE · {residents.length} SIMULIERTE PERSONEN</div><div>ZOOM {Math.round(zoom*100)}% · KAMERA {Math.round(viewport.x)},{Math.round(viewport.y)}</div></footer>
  </div>
}
