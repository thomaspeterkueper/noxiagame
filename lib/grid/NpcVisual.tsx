'use client'

import React from 'react'

export type NpcRole='science'|'engineering'|'operations'|'habitat'|'general'
export type NpcGenderPresentation='feminine'|'masculine'|'androgynous'
export type NpcBodyFrame='slender'|'average'|'broad'
export interface NpcAppearance {
  genderPresentation?:NpcGenderPresentation
  bodyFrame?:NpcBodyFrame
  skinToneCode?:string
  hairStyleCode?:string
  hairColorCode?:string
  facialHairCode?:string
  visibleAgeBand?:'child'|'teen'|'young_adult'|'adult'|'older'
}
export interface NpcVisualProfile{skin:string;hair:string;suit:string;accent:string;role:NpcRole;variant:number;genderPresentation:NpcGenderPresentation;bodyFrame:NpcBodyFrame;hairStyle:string;facialHair:string;ageBand:string}

const SKIN:Record<string,string>={skin_1:'#f0c7a1',skin_2:'#dba77d',skin_3:'#c58c66',skin_4:'#a66d4d',skin_5:'#805139',skin_6:'#5f3d2c'}
const HAIR:Record<string,string>={dark:'#241c19',brown:'#51382b',light:'#b8aa91',red:'#7c4630',grey:'#807a72'}
const SUIT:Record<NpcRole,string>={science:'#d9e6e9',engineering:'#c78b39',operations:'#557f9a',habitat:'#78946a',general:'#9b8b72'}
const ACCENT:Record<NpcRole,string>={science:'#49c6e5',engineering:'#f0b84c',operations:'#72a9cf',habitat:'#8fc878',general:'#c7b88d'}

function h(s:string){let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)}return x>>>0}
export function npcRole(role?:string|null):NpcRole{const r=(role??'').toLowerCase();if(/research|science|lab|fors|akadem|scient/.test(r))return'science';if(/engineer|tech|mine|drill|water|solar|wart|bau/.test(r))return'engineering';if(/log|trade|admin|oper|pilot|transport/.test(r))return'operations';if(/home|habitat|care|social|resident/.test(r))return'habitat';return'general'}

export function npcVisual(id:string,role?:string|null,appearance?:NpcAppearance):NpcVisualProfile{
  const n=h(id),r=npcRole(role)
  return{
    skin:SKIN[appearance?.skinToneCode??'']??SKIN['skin_'+(1+n%6)],
    hair:HAIR[appearance?.hairColorCode??'']??HAIR.dark,
    suit:SUIT[r],accent:ACCENT[r],role:r,variant:(n>>>8)%4,
    genderPresentation:appearance?.genderPresentation??'androgynous',
    bodyFrame:appearance?.bodyFrame??'average',
    hairStyle:appearance?.hairStyleCode??'short',
    facialHair:appearance?.facialHairCode??'none',
    ageBand:appearance?.visibleAgeBand??'adult',
  }
}

export function NpcVisualStyles(){return <style>{`
.npcv{position:relative;width:24px;height:38px;border:0;background:transparent;padding:0;cursor:pointer;filter:drop-shadow(0 3px 2px #0008);--body-scale:1}
.npcv.frame-slender{--body-scale:.86}.npcv.frame-broad{--body-scale:1.14}
.npcv.age-child .head{transform:scale(1.08)}.npcv.age-child .body{height:11px}.npcv.age-child .leg{top:24px;height:7px}
.npcv .sh{position:absolute;left:2px;top:31px;width:20px;height:6px;border-radius:50%;background:#0008}
.npcv .hair{position:absolute;left:7px;top:0;width:10px;height:6px;border-radius:6px 6px 2px 2px;background:var(--hair)}
.npcv.hair-long .hair{left:5px;width:14px;height:13px;border-radius:7px 7px 4px 4px}
.npcv.hair-curly .hair{left:5px;width:14px;height:8px;border-radius:50%}
.npcv.hair-braided .hair{left:5px;width:14px;height:7px;border-radius:6px}.npcv.hair-braided .hair:after{content:'';position:absolute;right:-3px;top:5px;width:3px;height:13px;background:var(--hair);border-radius:3px}
.npcv.hair-shaved .hair{left:7px;top:2px;width:10px;height:2px;border-radius:50%}
.npcv .head{position:absolute;left:7px;top:4px;width:10px;height:10px;border-radius:45% 45% 48% 48%;background:var(--skin);border:1px solid #263442}
.npcv.beard-short .head:after{content:'';position:absolute;left:2px;right:2px;bottom:-1px;height:4px;background:var(--hair);border-radius:0 0 4px 4px;opacity:.85}
.npcv .body{position:absolute;left:5px;top:14px;width:14px;height:14px;background:var(--suit);border:1px solid #263442;transform:scaleX(var(--body-scale));transform-origin:50% 0}
.npcv.gp-masculine .body{clip-path:polygon(5% 0,95% 0,84% 100%,16% 100%);border-radius:2px}
.npcv.gp-feminine .body{clip-path:polygon(16% 0,84% 0,72% 47%,90% 100%,10% 100%,28% 47%);border-radius:4px}
.npcv.gp-androgynous .body{clip-path:polygon(10% 0,90% 0,80% 100%,20% 100%);border-radius:3px}
.npcv .body:after{content:'';position:absolute;left:2px;right:2px;top:4px;height:2px;background:var(--accent)}
.npcv .leg{position:absolute;top:27px;width:5px;height:9px;background:#263848}.npcv .l{left:5px}.npcv .r{left:14px}
.npcv.walking .l{animation:npcwalk .5s infinite alternate}.npcv.walking .r{animation:npcwalk .5s infinite alternate-reverse}
.npcv.selected{filter:drop-shadow(0 0 7px #ffe27b)}
.npcv>span{position:absolute;top:-17px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#07121eea;border:1px solid #52677a;color:#eee0c6;padding:2px 4px;font:7px monospace}.npcv>span small{display:block;color:var(--accent)}
@keyframes npcwalk{from{transform:rotate(-15deg)}to{transform:rotate(15deg)}}
`}</style>}

function classes(v:NpcVisualProfile,moving:boolean,selected:boolean){
  return ['npcv','gp-'+v.genderPresentation,'frame-'+v.bodyFrame,'hair-'+v.hairStyle,'beard-'+v.facialHair,'age-'+v.ageBand,moving?'walking':'',selected?'selected':''].filter(Boolean).join(' ')
}

export function NpcFigure({id,name,role,appearance,moving=false,selected=false,showLabel=false,showRoleLabel=true,onClick}:{id:string;name:string;role?:string|null;appearance?:NpcAppearance;moving?:boolean;selected?:boolean;showLabel?:boolean;showRoleLabel?:boolean;onClick?:()=>void}){
  const v=npcVisual(id,role,appearance)
  return <button className={classes(v,moving,selected)} style={{'--skin':v.skin,'--hair':v.hair,'--suit':v.suit,'--accent':v.accent} as React.CSSProperties} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onClick?.()}} title={showRoleLabel?name+' · '+(role??v.role):name}><i className="sh"/><i className="head"/><i className="hair"/><i className="body"/><i className="leg l"/><i className="leg r"/>{showLabel&&<span>{name}{showRoleLabel&&<small>{role??v.role}</small>}</span>}</button>
}

export function NpcPortrait({id,name,role,appearance}:{id:string;name:string;role?:string|null;appearance?:NpcAppearance}){
  const v=npcVisual(id,role,appearance),hairHeight=v.hairStyle==='long'?18:v.hairStyle==='shaved'?5:13
  return <div style={{display:'flex',gap:10,alignItems:'center',padding:'9px',border:'1px solid #344657',background:'#0b1622'}}><div style={{width:42,height:42,borderRadius:'50%',background:v.skin,border:'3px solid '+v.accent,position:'relative',overflow:'hidden'}}><i style={{position:'absolute',left:v.hairStyle==='long'?4:7,right:v.hairStyle==='long'?4:7,top:0,height:hairHeight,background:v.hair,borderRadius:'50% 50% 20% 20%'}}/>{v.facialHair==='short'&&<i style={{position:'absolute',left:12,right:12,top:22,height:8,background:v.hair,borderRadius:'0 0 6px 6px',opacity:.85}}/>}<i style={{position:'absolute',left:8,right:8,bottom:0,height:12,background:v.suit}}/></div><div><b style={{color:'#f1d57a'}}>{name}</b><small style={{display:'block',color:v.accent,textTransform:'uppercase'}}>{role??v.role}</small></div></div>
}