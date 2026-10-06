'use client'

import type { ReactNode } from 'react'
import type { LocalSurfacePoint } from '@/lib/game/spatial/localSurfaceScene'

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

export function WalkablePlayer({point,label}:{point:LocalSurfacePoint;label?:string}){
  const p=projectSurfacePoint(point)
  const labelWidth=label?Math.max(44,Math.min(118,label.length*6.1+16)):0
  return <g transform={`translate(${p.x} ${p.y-9})`}>
    <ellipse cy="11" rx="8" ry="3.5" fill="#000" opacity=".28"/>
    <circle cy="-4" r="4.5" fill="#f0c49c" stroke="#493c18" strokeWidth="1.2"/>
    <path d="M-6 12 Q0 0 6 12 L5 20 L-5 20 Z" fill="#d4ad43" stroke="#594717" strokeWidth="1.2"/>
    {label&&<g pointerEvents="none" transform="translate(0 -20)"><rect x={-labelWidth/2} y="-12" width={labelWidth} height="14" rx="4" fill="#173845ee" stroke="#e4bd4b" strokeWidth=".9"/><text x="0" y="-2.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff7d8">{label}</text></g>}
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

const ACTOR_SKIN:Record<string,string>={
  skin_1:'#f4d2bd',
  skin_2:'#e8b995',
  skin_3:'#cf9670',
  skin_4:'#ac7251',
  skin_5:'#815039',
  skin_6:'#573526',
}
const ACTOR_HAIR:Record<string,string>={
  dark:'#252321',
  brown:'#67452f',
  light:'#c7a76f',
  red:'#944d32',
  grey:'#96928c',
}
const ACTOR_CLOTHES=['#2e6274','#466a52','#6b586d','#725c3f','#4f6079','#58686c']

function actorHash(value:string){
  let h=2166136261
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0
}

function actorClothingColor(appearance:WalkableActorAppearance|undefined,visualSeed:string){
  const profile=appearance?.clothingProfile
  const requested=typeof profile?.primaryColor==='string'?profile.primaryColor:typeof profile?.color==='string'?profile.color:null
  if(requested&&/^#[0-9a-f]{6}$/i.test(requested))return requested
  return ACTOR_CLOTHES[actorHash(visualSeed)%ACTOR_CLOTHES.length]
}

function ActorHair({style,color}:{style:string;color:string}){
  if(style==='shaved')return <path d="M-3.7 -5.2 Q0 -7.2 3.7 -5.2" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
  if(style==='long')return <><path d="M-4 -5 Q-5 -1 -4 4 L-2.2 3 Q-3 -1 0 -6.4 Q3 -1 2.2 3 L4 4 Q5 -1 4 -5 Q0 -8 -4 -5Z" fill={color}/><path d="M-3.5 -5 Q0 -7.6 3.5 -5 L3 -2.8 Q0 -5 -3 -2.8Z" fill={color}/></>
  if(style==='curly')return <g fill={color}><circle cx="-2.8" cy="-5.1" r="2"/><circle cx="0" cy="-6.1" r="2.2"/><circle cx="2.8" cy="-5.1" r="2"/><circle cx="-3.7" cy="-2.9" r="1.5"/><circle cx="3.7" cy="-2.9" r="1.5"/></g>
  if(style==='braided')return <><path d="M-3.6 -5 Q0 -7.5 3.6 -5 L3 -2.7 Q0 -4.8 -3 -2.7Z" fill={color}/><path d="M3.1 -2.5 Q5 0 3.4 2 Q5 4 3.6 6" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>
  return <path d="M-3.8 -5 Q0 -7.4 3.8 -5 L3.3 -2.7 Q0 -4.6 -3.3 -2.7Z" fill={color}/>
}

function ActorBody({appearance,clothingColor}:{appearance:WalkableActorAppearance|undefined;clothingColor:string}){
  const frame=appearance?.bodyFrame??'average'
  const presentation=appearance?.genderPresentation??'androgynous'
  const shoulder=frame==='slender'?4.7:frame==='broad'?7:5.7
  const hip=frame==='slender'?4.3:frame==='broad'?6.1:5
  const waist=presentation==='feminine'?Math.max(3.5,shoulder-1.7):presentation==='masculine'?Math.max(4.3,shoulder-.6):(shoulder+hip)/2-.5
  return <path
    d={`M-${shoulder} 5 Q-${waist} 9 -${hip} 15 L-${Math.max(3.4,hip-.6)} 19 L${Math.max(3.4,hip-.6)} 19 L${hip} 15 Q${waist} 9 ${shoulder} 5 Q0 1 -${shoulder} 5Z`}
    fill={clothingColor}
    stroke="#173845"
    strokeWidth="1"
  />
}

export function WalkableActor({
  point,label,selected=false,onClick,appearance,visualSeed='actor',
}:{
  point:LocalSurfacePoint
  label?:string
  selected?:boolean
  onClick?:()=>void
  appearance?:WalkableActorAppearance
  visualSeed?:string
}){
  const p=projectSurfacePoint(point)
  const labelWidth=label?Math.max(42,Math.min(112,label.length*6.1+14)):0
  const age=appearance?.visibleAgeBand??'adult'
  const scale=age==='child'?.72:age==='teen'?.86:age==='older'?.96:1
  const skin=ACTOR_SKIN[appearance?.skinToneCode??'']??ACTOR_SKIN.skin_3
  const hair=ACTOR_HAIR[appearance?.hairColorCode??'']??ACTOR_HAIR.dark
  const clothing=actorClothingColor(appearance,visualSeed)
  const headRadius=age==='child'?4.4:4
  return <g transform={`translate(${p.x} ${p.y-8})`} onClick={onClick} style={onClick?{cursor:'pointer'}:undefined}>
    <ellipse cy="10" rx={7*scale} ry={3*scale} fill="#000" opacity=".25"/>
    <g transform={`scale(${scale}) translate(0 ${(1-scale)*6})`}>
      {appearance?.hairStyleCode==='long'&&<ActorHair style="long" color={hair}/>}
      <circle cy="-3" r={headRadius} fill={skin} stroke={selected?'#e4bd4b':'#173845'} strokeWidth={selected?1.5:1}/>
      {appearance?.hairStyleCode!=='long'&&<ActorHair style={appearance?.hairStyleCode??'short'} color={hair}/>}
      {appearance?.facialHairCode&&appearance.facialHairCode!=='none'&&<path d="M-2.8 -.8 Q0 2.2 2.8 -.8 Q2.2 3.3 0 3.6 Q-2.2 3.3 -2.8 -.8Z" fill={hair} opacity=".9"/>}
      <ActorBody appearance={appearance} clothingColor={clothing}/>
      {age==='older'&&<path d="M-2.4 -1.8 H-0.5 M.5 -1.8 H2.4 M-.5 -1.8 H.5" stroke="#40515a" strokeWidth=".65" opacity=".8"/>}
      {selected&&<ellipse cy="10" rx="9" ry="12" fill="none" stroke="#e4bd4b" strokeWidth="1.2" strokeDasharray="2 2"/>}
    </g>
    {label&&<g pointerEvents="none" transform="translate(0 -18)"><rect x={-labelWidth/2} y="-12" width={labelWidth} height="14" rx="4" fill={selected?'#173845ee':'#071521d9'} stroke={selected?'#e4bd4b':'#57717d'} strokeWidth=".8"/><text x="0" y="-2.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#edf4f5">{label}</text></g>}
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
