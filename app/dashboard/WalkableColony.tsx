'use client'
// app/dashboard/WalkableColony.tsx
// Strategische Kolonieansicht: freie Kamera statt harter Figuren-Zentrierung.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStreetTiles } from '@/lib/game/streetTiles'

interface TileEntity {
  id: string
  entity_id: string
  entity_type: string
  tile_row: number
  tile_col: number
  profile_id: string | null
  owner_class: string
  actor_name?: string | null
  username?: string | null
}

interface Ship {
  id: string
  ship_type: string
  is_active: boolean
  location_id: string
}

interface Props {
  locationSlug: string
  locationName: string
  population: number
  entities: TileEntity[]
  pending: any[]
  ships: Ship[]
  locationId: string
  userId: string
  onClose: () => void
  onEnterBuilding?: (entity: TileEntity) => void
}

const COLS = 32
const ROWS = 24
const ISO_W = 32
const ISO_H = 16
const BLOCK_H = 26
const CANVAS_W = (COLS + ROWS) * ISO_W + 100
const CANVAS_H = (COLS + ROWS) * ISO_H + 200
const VP_W = 800
const VP_H = 500
const MIN_ZOOM = 0.65
const MAX_ZOOM = 1.65

function isoProject(col: number, row: number) {
  return { x: (col - row) * ISO_W + CANVAS_W / 2, y: (col + row) * ISO_H + 60 }
}

const C = {
  road: '#5a5040', roadMain: '#6a6050', crossing: '#7a7060', habitat: '#4a6e5a',
  state: '#3a5a6e', corp: '#6e4a2a', figure: '#c9a961', ship: '#6a9aca', text: '#d4c8b0',
}

function drawFigure(ctx: CanvasRenderingContext2D, x: number, y: number, color = C.figure, label = '') {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 9, 4, 0, Math.PI * 2); ctx.fill()
  const baseY = y - 4
  ctx.fillStyle = '#1a2a3a'; ctx.fillRect(x - 4, baseY - 8, 3.5, 8); ctx.fillRect(x + 1, baseY - 8, 3.5, 8)
  ctx.fillStyle = '#2a4e7a'; ctx.fillRect(x - 5, baseY - 18, 10, 11); ctx.fillRect(x - 8, baseY - 17, 3.5, 8); ctx.fillRect(x + 5, baseY - 17, 3.5, 8)
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, baseY - 22, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#4a90d0'; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(x, baseY - 22, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1
  if (label) { ctx.fillStyle = C.text; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText(label, x, baseY - 32) }
}

function drawIsoFloor(ctx: CanvasRenderingContext2D, col: number, row: number, color: string) {
  const { x, y } = isoProject(col, row); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - ISO_H); ctx.lineTo(x + ISO_W, y); ctx.lineTo(x, y + ISO_H); ctx.lineTo(x - ISO_W, y); ctx.closePath(); ctx.fill()
}

function drawIsoBuilding(ctx: CanvasRenderingContext2D, col: number, row: number, topColor: string, label?: string, icon?: string, height = BLOCK_H) {
  const { x, y } = isoProject(col, row); const topY = y - height
  const shade = (hex: string, factor: number) => { const c = hex.replace('#', ''); const n = (i: number) => Math.max(0, Math.min(255, parseInt(c.slice(i, i + 2), 16) * factor)) | 0; return `rgb(${n(0)},${n(2)},${n(4)})` }
  ctx.fillStyle = shade(topColor, .55); ctx.beginPath(); ctx.moveTo(x - ISO_W, y); ctx.lineTo(x, y + ISO_H); ctx.lineTo(x, y + ISO_H - height); ctx.lineTo(x - ISO_W, y - height); ctx.closePath(); ctx.fill()
  ctx.fillStyle = shade(topColor, .75); ctx.beginPath(); ctx.moveTo(x, y + ISO_H); ctx.lineTo(x + ISO_W, y); ctx.lineTo(x + ISO_W, y - height); ctx.lineTo(x, y + ISO_H - height); ctx.closePath(); ctx.fill()
  ctx.fillStyle = topColor; ctx.beginPath(); ctx.moveTo(x, topY - ISO_H); ctx.lineTo(x + ISO_W, topY); ctx.lineTo(x, topY + ISO_H); ctx.lineTo(x - ISO_W, topY); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = .5; ctx.stroke()
  if (icon) { ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, x, topY) }
  if (label) { ctx.fillStyle = C.text; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText(label, x, y + ISO_H + 10) }
}

function drawShip(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, cy + 26, 20, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = C.ship; ctx.beginPath(); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx - 16, cy + 6); ctx.lineTo(cx - 11, cy + 18); ctx.lineTo(cx + 11, cy + 18); ctx.lineTo(cx + 16, cy + 6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8ab8e8'; ctx.stroke()
}

export default function WalkableColony({ locationSlug, locationName, population, entities, pending, ships, userId, onClose, onEnterBuilding }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const [figPos, setFigPos] = useState({ col: 4.5, row: 8.5 })
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ x: Math.max(0, CANVAS_W / 2 - VP_W / 2), y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)

  const streets = useMemo(() => getStreetTiles(locationSlug, population, entities, pending, userId, COLS, ROWS), [locationSlug, population, entities, pending, userId])
  const playerHabitat = entities.find(e => e.entity_id === 'habitat' && e.profile_id === userId)
  const landingPad = entities.find(e => e.entity_id === 'landing_pad' || e.entity_id === 'docking_bay')
  const hasShipAtLocation = ships.some(s => s.is_active)

  const clampViewport = useCallback((x: number, y: number, z = zoom) => ({
    x: Math.max(0, Math.min(CANVAS_W - VP_W / z, x)),
    y: Math.max(0, Math.min(CANVAS_H - VP_H / z, y)),
  }), [zoom])

  const centerOn = useCallback((col: number, row: number, z = zoom) => {
    const p = isoProject(col, row)
    setViewport(clampViewport(p.x - VP_W / (2 * z), p.y - VP_H / (2 * z), z))
  }, [zoom, clampViewport])

  useEffect(() => {
    if (playerHabitat) { const p = { col: playerHabitat.tile_col + .5, row: playerHabitat.tile_row + .5 }; setFigPos(p); centerOn(p.col, p.row) }
  }, [playerHabitat?.id])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H); ctx.fillStyle = '#0a0e18'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${.05 + (i % 3) * .05})`; ctx.beginPath(); ctx.arc((i * 113) % CANVAS_W, (i * 71) % (CANVAS_H * .4), .8, 0, Math.PI * 2); ctx.fill() }
    const icons: Record<string, string> = { habitat:'🏠', mine:'⛏', solar:'☀️', landing_pad:'🛬', docking_bay:'🛬', bank:'🏦', school:'🏫', shipyard:'⚙️', warehouse:'📦', admin:'🏛', command_center:'📡' }
    type Item = { depth: number; draw: () => void }; const queue: Item[] = []
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) { const v=((c*7+r*13)%6)*4; const street=streets.find(s=>s.col===c&&s.row===r); const color=street?(street.subtype==='main'?C.roadMain:street.subtype==='crossing'?C.crossing:C.road):`rgb(${61+v},${52+v},${40+v})`; queue.push({depth:(c+r)*2-1000,draw:()=>drawIsoFloor(ctx,c,r,color)}) }
    for (const e of entities) { if(e.entity_type!=='building') continue; const own=e.profile_id===userId; const state=e.owner_class==='STATE'; const corp=!!e.profile_id&&!own; const color=state?C.state:own?C.habitat:corp?C.corp:C.habitat; queue.push({depth:e.tile_col+e.tile_row,draw:()=>drawIsoBuilding(ctx,e.tile_col,e.tile_row,color,e.entity_id,icons[e.entity_id]??'🏗')}) }
    if(landingPad&&hasShipAtLocation) queue.push({depth:landingPad.tile_col+landingPad.tile_row+.5,draw:()=>{const p=isoProject(landingPad.tile_col,landingPad.tile_row);drawShip(ctx,p.x,p.y-BLOCK_H-10)}})
    queue.push({depth:figPos.col+figPos.row+.3,draw:()=>{const p=isoProject(figPos.col,figPos.row);drawFigure(ctx,p.x,p.y,C.figure,'Du')}})
    queue.sort((a,b)=>a.depth-b.depth); queue.forEach(i=>i.draw())
  }, [figPos, streets, entities, ships, userId, landingPad, hasShipAtLocation])

  const isoUnproject = useCallback((px:number,py:number)=>{const dx=px-CANVAS_W/2,dy=py-60;return{col:(dx/ISO_W+dy/ISO_H)/2,row:(dy/ISO_H-dx/ISO_W)/2}},[])

  const handleClick = useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    if (dragging) return
    const rect=e.currentTarget.getBoundingClientRect(); const px=(e.clientX-rect.left)/zoom+viewport.x; const py=(e.clientY-rect.top)/zoom+viewport.y; const p=isoUnproject(px,py)
    const hit=entities.find(en=>Math.abs(en.tile_col-p.col)<.65&&Math.abs(en.tile_row-p.row)<.65)
    if(hit){ if(onEnterBuilding) onEnterBuilding(hit); else {setTooltip(`▶ ${hit.entity_id}`);setTimeout(()=>setTooltip(null),1500)} }
  },[dragging,zoom,viewport,entities,onEnterBuilding,isoUnproject])

  const wheel = useCallback((e:React.WheelEvent)=>{e.preventDefault(); const next=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom*(e.deltaY>0?.9:1.1))); setZoom(next); setViewport(v=>clampViewport(v.x,v.y,next))},[zoom,clampViewport])
  const pointerDown=(e:React.PointerEvent)=>{dragRef.current={x:e.clientX,y:e.clientY,vx:viewport.x,vy:viewport.y};setDragging(false);e.currentTarget.setPointerCapture(e.pointerId)}
  const pointerMove=(e:React.PointerEvent)=>{const d=dragRef.current;if(!d)return;const dx=(e.clientX-d.x)/zoom,dy=(e.clientY-d.y)/zoom;if(Math.abs(dx)+Math.abs(dy)>4)setDragging(true);setViewport(clampViewport(d.vx-dx,d.vy-dy))}
  const pointerUp=(e:React.PointerEvent)=>{dragRef.current=null;e.currentTarget.releasePointerCapture(e.pointerId);window.setTimeout(()=>setDragging(false),0)}

  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape'){onClose();return} if(e.key.toLowerCase()==='f'){centerOn(figPos.col,figPos.row);return} const step=36/zoom; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){e.preventDefault();setViewport(v=>clampViewport(v.x+(e.key==='ArrowRight'||e.key==='d'?step:e.key==='ArrowLeft'||e.key==='a'?-step:0),v.y+(e.key==='ArrowDown'||e.key==='s'?step:e.key==='ArrowUp'||e.key==='w'?-step:0)))}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose,zoom,clampViewport,centerOn,figPos])

  return <div style={{position:'absolute',inset:0,zIndex:100,background:'rgba(0,0,0,.92)',display:'flex',flexDirection:'column',borderRadius:8}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'.5rem 1rem',background:'#070b14',borderBottom:'1px solid #1d2a3d'}}>
      <div><span style={{color:'#c9a961',fontFamily:'monospace',fontSize:'.75rem',fontWeight:700}}>◈ {locationName.toUpperCase()} — KOLONIEANSICHT</span><span style={{color:'#3a4e5a',fontSize:'.65rem',marginLeft:'1rem',fontFamily:'monospace'}}>Bevölkerung: {population.toLocaleString()}</span></div>
      <div style={{display:'flex',gap:'.5rem',alignItems:'center'}}><span style={{color:'#64748b',fontSize:'.62rem',fontFamily:'monospace'}}>Ziehen: Kamera · Mausrad: Zoom · WASD/Pfeile: Kamera · F: Figur · Klick: Gebäude</span><button onClick={onClose} style={{background:'none',border:'1px solid #1d2a3d',color:'#8b9aaa',borderRadius:6,padding:'3px 10px',cursor:'pointer'}}>ESC</button></div>
    </div>
    <div style={{flex:1,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onWheel={wheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} style={{position:'relative',width:VP_W,height:VP_H,overflow:'hidden',border:'1px solid #1d2a3d',cursor:dragRef.current?'grabbing':'grab',touchAction:'none'}}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} onClick={handleClick} style={{display:'block',position:'absolute',left:0,top:0,transformOrigin:'0 0',transform:`translate(${-viewport.x*zoom}px,${-viewport.y*zoom}px) scale(${zoom})`}} />
        {tooltip&&<div style={{position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',background:'rgba(7,11,20,.9)',border:'1px solid #1d2a3d',color:'#c9a961',padding:'4px 12px',borderRadius:8,fontSize:'.72rem',fontFamily:'monospace',pointerEvents:'none'}}>{tooltip}</div>}
        <div style={{position:'absolute',right:10,bottom:10,display:'flex',gap:4}}><button onClick={()=>setZoom(z=>Math.max(MIN_ZOOM,z-.15))}>−</button><button onClick={()=>centerOn(figPos.col,figPos.row)}>F</button><button onClick={()=>setZoom(z=>Math.min(MAX_ZOOM,z+.15))}>+</button></div>
      </div>
    </div>
    <div style={{padding:'.4rem 1rem',background:'#070b14',borderTop:'1px solid #1d2a3d',display:'flex',gap:'1.5rem'}}><span style={{color:'#64748b',fontFamily:'monospace',fontSize:'.62rem'}}>KAMERA {Math.round(zoom*100)}%</span><span style={{color:'#64748b',fontFamily:'monospace',fontSize:'.62rem'}}>FIGUR {Math.round(figPos.col)},{Math.round(figPos.row)}</span><span style={{color:'#64748b',fontFamily:'monospace',fontSize:'.62rem'}}>{streets.length} Straßen-Tiles · {entities.length} Gebäude</span></div>
  </div>
}
