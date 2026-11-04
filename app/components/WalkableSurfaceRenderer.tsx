'use client'

import type { ReactNode } from 'react'
import type { LocalSurfacePoint } from '@/lib/game/spatial/localSurfaceScene'
import { KieselG, useKieselMotion, useMyFigureId } from '@/lib/figures/KieselFigure'
import { kieselLookFor, type KieselPose } from '@/lib/figures/kiesel'

export type SurfaceScreenPoint={x:number;y:number}

export const WALKABLE_VIEW={width:1200,height:760,isoX:.92,isoY:.46}

export function projectSurfacePoint(point:LocalSurfacePoint):SurfaceScreenPoint{
  return{
    x:WALKABLE_VIEW.width/2+(point.xM-point.yM)*WALKABLE_VIEW.isoX,
    y:WALKABLE_VIEW.height/2+(point.xM+point.yM)*WALKABLE_VIEW.isoY,
  }
}

export function surfaceCameraOffset(
  focus:LocalSurfacePoint,
  options?:{marginX?:number;marginY?:number},
):SurfaceScreenPoint{
  const point=projectSurfacePoint(focus)
  const marginX=Math.max(80,Math.min(WALKABLE_VIEW.width/2-40,options?.marginX??260))
  const marginY=Math.max(70,Math.min(WALKABLE_VIEW.height/2-40,options?.marginY??160))
  const minX=marginX
  const maxX=WALKABLE_VIEW.width-marginX
  const minY=marginY
  const maxY=WALKABLE_VIEW.height-marginY
  return{
    x:point.x<minX?minX-point.x:point.x>maxX?maxX-point.x:0,
    y:point.y<minY?minY-point.y:point.y>maxY?maxY-point.y:0,
  }
}

export function surfaceCameraTransform(focus:LocalSurfacePoint,options?:{marginX?:number;marginY?:number}){
  const offset=surfaceCameraOffset(focus,options)
  return `translate(${offset.x.toFixed(1)} ${offset.y.toFixed(1)})`
}

export function surfacePathD(points:LocalSurfacePoint[]){
  return points.map((point,index)=>{
    const p=projectSurfacePoint(point)
    return `${index?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }).join(' ')
}

export function surfacePolygonD(points:LocalSurfacePoint[]){return `${surfacePathD(points)} Z`}

export function surfacePointsAttr(points:SurfaceScreenPoint[],dy=0){
  return points.map(point=>`${point.x},${point.y+dy}`).join(' ')
}

export function surfaceBuildingTop(center:LocalSurfacePoint,widthM:number,depthM:number){
  return[
    {xM:center.xM-widthM/2,yM:center.yM-depthM/2},
    {xM:center.xM+widthM/2,yM:center.yM-depthM/2},
    {xM:center.xM+widthM/2,yM:center.yM+depthM/2},
    {xM:center.xM-widthM/2,yM:center.yM+depthM/2},
  ].map(projectSurfacePoint)
}

export function WalkableSurfaceSvg({children,className}:{children:ReactNode;className?:string}){
  return <svg className={className} viewBox={`0 0 ${WALKABLE_VIEW.width} ${WALKABLE_VIEW.height}`} preserveAspectRatio="xMidYMid slice">{children}</svg>
}

export function WalkableRoute({points,target}:{points:LocalSurfacePoint[];target:LocalSurfacePoint}){
  const to=projectSurfacePoint(target)
  return <g pointerEvents="none">
    <path d={surfacePathD(points)} fill="none" stroke="#f1d57a" strokeWidth="2" strokeDasharray="7 5" strokeLinecap="round" opacity=".92"/>
    <circle cx={to.x} cy={to.y} r="9" fill="none" stroke="#f1d57a" strokeWidth="2"/>
  </g>
}

/**
 * Spielfigur auf Erdkarte und Oberflächen – seit 04.11.2026 als Kiesel (Blickrichtung
 * und Gehen aus der Bewegung; draußen auf Mond, Phobos, Deimos im Druckanzug).
 */
export function WalkablePlayer({point,label,suited=false,seed,pose}:{point:LocalSurfacePoint;label?:string;suited?:boolean;seed?:string;pose?:KieselPose}){
  const myId=useMyFigureId()
  const p=projectSurfacePoint(point)
  const labelWidth=label?Math.max(44,Math.min(118,label.length*6.1+16)):0
  const m=useKieselMotion(p.x,p.y)
  return <g transform={`translate(${p.x} ${p.y-9})`}>
    <ellipse cy="11" rx="9" ry="3.5" fill="#e4bd4b" opacity=".35"/>
    <g transform="translate(0 11)"><KieselG look={kieselLookFor({id:seed??myId},suited?'space':null)} dir={m.dir} pose={pose??(m.moving?'gehen':'stehen')} moving={m.moving} height={38}/></g>
    {label&&<g pointerEvents="none" transform="translate(0 -26)"><rect x={-labelWidth/2} y="-12" width={labelWidth} height="14" rx="4" fill="#173845ee" stroke="#e4bd4b" strokeWidth=".9"/><text x="0" y="-2.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff7d8">{label}</text></g>}
  </g>
}

export type WalkableActorAppearance={
  genderPresentation?:'feminine'|'masculine'|'androgynous'
  bodyFrame?:'slender'|'average'|'broad'
  skinToneCode?:string
  hairStyleCode?:string
  hairColorCode?:string
  facialHairCode?:string
  visibleAgeBand?:'child'|'teen'|'young_adult'|'adult'|'older'
  clothingProfile?:Record<string,unknown>
}

/** Bewohner auf Erdkarte und Oberflächen – seit 04.11.2026 als Kiesel. */
export function WalkableActor({
  point,label,selected=false,onClick,appearance,visualSeed='actor',suited=false,work=null,pose,
}:{
  point:LocalSurfacePoint
  label?:string
  selected?:boolean
  onClick?:()=>void
  appearance?:WalkableActorAppearance
  visualSeed?:string
  /** Draußen auf Mond, Phobos, Deimos: Druckanzug mit Helm. */
  suited?:boolean
  /** Was die Person gerade arbeitet (für die Kleidung), z. B. 'cafe', 'engineer'. */
  work?:string|null
  pose?:KieselPose
}){
  const p=projectSurfacePoint(point)
  const labelWidth=label?Math.max(42,Math.min(112,label.length*6.1+14)):0
  const m=useKieselMotion(p.x,p.y)
  const look=kieselLookFor({id:visualSeed,appearance},suited?'space':work)
  return <g transform={`translate(${p.x} ${p.y-8})`} onClick={onClick} style={onClick?{cursor:'pointer'}:undefined}>
    <g transform="translate(0 10)"><KieselG look={look} dir={m.dir} pose={pose??(m.moving?'gehen':'stehen')} moving={m.moving} height={34}/></g>
    {selected&&<ellipse cy="10" rx="9" ry="3.6" fill="none" stroke="#e4bd4b" strokeWidth="1.4"/>}
    {label&&<g pointerEvents="none" transform="translate(0 -24)"><rect x={-labelWidth/2} y="-12" width={labelWidth} height="14" rx="4" fill={selected?'#173845ee':'#071521d9'} stroke={selected?'#e4bd4b':'#57717d'} strokeWidth=".8"/><text x="0" y="-2.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#edf4f5">{label}</text></g>}
  </g>
}

export function WalkableObject({point,selected=false}:{point:LocalSurfacePoint;selected?:boolean}){
  const p=projectSurfacePoint(point)
  return <g transform={`translate(${p.x} ${p.y})`}>
    <ellipse cy="8" rx="8" ry="3" fill="#000" opacity=".28"/>
    <rect x="-6" y="-4" width="12" height="9" rx="2" fill={selected?'#e0c05e':'#d3ad45'} stroke={selected?'#fff0a8':'#4f411b'}/>
    <circle cx="-5" cy="6" r="2" fill="#242b2b"/><circle cx="5" cy="6" r="2" fill="#242b2b"/>
  </g>
}


export function WalkableTrain({point,label}:{point:LocalSurfacePoint;label?:string}){
  const p=projectSurfacePoint(point)
  return <g transform={`translate(${p.x} ${p.y-5})`} pointerEvents="none">
    <ellipse cy="9" rx="15" ry="4" fill="#000" opacity=".28"/>
    <path d="M-15 3 L-11 -7 L10 -7 L15 3 L12 8 L-12 8 Z" fill="#aeb6b8" stroke="#263238" strokeWidth="1.3"/>
    <rect x="-8" y="-5" width="6" height="4" rx="1" fill="#385664"/>
    <rect x="1" y="-5" width="6" height="4" rx="1" fill="#385664"/>
    <circle cx="-9" cy="8" r="2.3" fill="#202729"/>
    <circle cx="9" cy="8" r="2.3" fill="#202729"/>
    {label&&<text x="0" y="-11" textAnchor="middle" fontSize="7" fontWeight="700" fill="#f3f4f4">{label}</text>}
  </g>
}
