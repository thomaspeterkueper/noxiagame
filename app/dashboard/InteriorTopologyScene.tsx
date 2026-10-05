'use client'

import { useEffect, useMemo } from 'react'
import type { InteriorTemplate, RoomId } from '@/lib/game/buildings/interiors/types'

type Props = { template: InteriorTemplate; roomId: RoomId; onRoomChange: (roomId: RoomId) => void }

function roomGrid(index:number){
  const col=index%2, row=Math.floor(index/2)
  return {x:40+col*220,y:36+row*140,w:180,h:100}
}

export default function InteriorTopologyScene({template,roomId,onRoomChange}:Props){
  const layout=useMemo(()=>new Map(template.rooms.map((room,index)=>[room.id,roomGrid(index)])),[template])
  const adjacent=useMemo(()=>{
    const out:string[]=[]
    for(const portal of template.portals){
      if(portal.fromRoomId===roomId)out.push(portal.toRoomId)
      else if(portal.toRoomId===roomId)out.push(portal.fromRoomId)
    }
    return out
  },[template,roomId])

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return
      const key=event.key.toLowerCase()
      if(!['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s'].includes(key)||!adjacent.length)return
      event.preventDefault()
      const currentIndex=template.rooms.findIndex(room=>room.id===roomId)
      const next=adjacent.map(id=>({id,index:template.rooms.findIndex(room=>room.id===id)})).sort((a,b)=>Math.abs(a.index-currentIndex)-Math.abs(b.index-currentIndex)||a.index-b.index)[0]?.id
      if(next)onRoomChange(next)
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[adjacent,onRoomChange,roomId,template.rooms])

  return <div className="topology-scene">
    <svg viewBox="0 0 480 300" role="img" aria-label={template.name}>
      <rect width="480" height="300" fill="#1b2b31"/>
      {template.portals.map(portal=>{
        const a=layout.get(portal.fromRoomId),b=layout.get(portal.toRoomId)
        if(!a||!b)return null
        const ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2
        return <g key={portal.id}><path d={'M '+ax+' '+ay+' L '+bx+' '+by} stroke={portal.kind==='airlock'?'#d8b759':'#6f8d96'} strokeWidth="10" opacity=".55"/><path d={'M '+ax+' '+ay+' L '+bx+' '+by} stroke="#23363c" strokeWidth="5"/></g>
      })}
      {template.rooms.map(room=>{
        const box=layout.get(room.id)!
        const active=room.id===roomId,reachable=adjacent.includes(room.id)
        return <g key={room.id} onClick={()=>reachable&&onRoomChange(room.id)} style={{cursor:reachable?'pointer':'default'}}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" fill={active?'#3d5d67':'#30464d'} stroke={active?'#d9b85d':reachable?'#7fa2ac':'#506870'} strokeWidth={active?3:1.5}/>
          <text x={box.x+12} y={box.y+24} fill={active?'#fff1b8':'#dbe6e4'} fontSize="13" fontWeight="700">{room.name}</text>
          <text x={box.x+12} y={box.y+42} fill="#8ea3aa" fontSize="9">{room.kind}</text>
          <text x={box.x+12} y={box.y+74} fill="#7fc0c7" fontSize="8">{(room.capabilities??[]).slice(0,3).join(' · ')}</text>
        </g>
      })}
      {(()=>{const box=layout.get(roomId);if(!box)return null;return <g transform={'translate('+(box.x+box.w/2)+' '+(box.y+box.h/2+18)+')'}><circle cy="-8" r="6" fill="#e8c39e" stroke="#283133"/><path d="M-8 13 Q0 -2 8 13 L7 22 L-7 22 Z" fill="#d4ad43" stroke="#4b3b17"/></g>})()}
    </svg>
    <div className="topology-help">Pfeile/WASD oder benachbarten Raum anklicken · Wege folgen realen Portalen</div>
    <style jsx>{`
      .topology-scene{position:relative;height:300px;border:1px solid #6f7f80;border-radius:10px;background:#1b2b31;overflow:hidden}
      .topology-scene svg{width:100%;height:100%;display:block}
      .topology-help{position:absolute;left:10px;bottom:8px;padding:4px 6px;border:1px solid #506870;border-radius:5px;background:#102027dd;color:#9fb1b7;font:8px monospace}
    `}</style>
  </div>
}