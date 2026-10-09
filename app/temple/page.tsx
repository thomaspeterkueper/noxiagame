'use client'

import { useState } from 'react'
import InteriorTopologyScene from '@/app/dashboard/InteriorTopologyScene'
import { DAVARU_TEMPLE_INTERIOR } from '@/lib/game/buildings/interiors/templates/davaruTemple'
import { createInteriorInstance } from '@/lib/game/buildings/interiors/instances'
import { findInteriorRoute } from '@/lib/game/buildings/interiors/navigation'

// Standalone architectural preview: no auth grant, avatar session, or Core occupancy.
// Do not confuse this local room selection with entering the authoritative world.
const previewInstance = createInteriorInstance(DAVARU_TEMPLE_INTERIOR, {
  id: 'preview:davaru-temple', buildingInstanceId: 'preview-only-not-a-core-building',
})
export default function TemplePreviewPage() {
  const [roomId, setRoomId] = useState('entrance')
  const room = DAVARU_TEMPLE_INTERIOR.rooms.find(item => item.id === roomId)
  return <main style={{maxWidth:900,margin:'24px auto',padding:20}}>
    <h1>Tempel des DaVaRu</h1>
    <p>Interaktive Innenraumvorschau · Keine Live-Instanz · Kein ENDIA-Login oder physischer Ortswechsel</p>
    <InteriorTopologyScene
      template={DAVARU_TEMPLE_INTERIOR}
      roomId={roomId}
      occupants={[]}
      onRoomChange={next => {
        if (findInteriorRoute(DAVARU_TEMPLE_INTERIOR, previewInstance, roomId, next)?.steps.length === 1) setRoomId(next)
      }}
    />
    <section aria-live="polite" style={{marginTop:16,padding:16,border:'1px solid #b9c7c7',borderRadius:8}}>
      <h2>{room?.name ?? 'Unbekannter Raum'}</h2>
      <p>{roomId==='entrance'?'Hier beginnt der Besuch.':roomId==='conversation'?'Ein Raum für freiwillige philosophische Gespräche.':roomId==='library'?'Eine künftige Sammlung von Texten und Überlieferungen.':'Ein stiller Garten am Bach.'}</p>
    </section>
  </main>
}
