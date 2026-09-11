'use client'

import { preferredHoldingZone } from '@/lib/game/arrivalControl'
import { getShipDockingProfile } from '@/lib/game/shipDockingProfiles'

export default function ArrivalControlPanel({
  stationSlug,
  shipTypeId,
}: {
  stationSlug: string
  shipTypeId: string
}) {
  const shipProfile = getShipDockingProfile(shipTypeId)
  if (!shipProfile) return null

  const holdingZone = preferredHoldingZone(stationSlug, shipProfile.vesselClass)
  if (!holdingZone) return null

  return (
    <div style={{ marginTop: 10, padding: '10px 11px', background: '#0a1620', border: '1px solid #2b4053', borderRadius: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <strong style={{ fontSize: 10, color: '#7fb8de', fontFamily: 'monospace', letterSpacing: '.08em' }}>
          ARRIVAL CONTROL
        </strong>
        <span style={{ fontSize: 9, color: '#64788a' }}>Core-Queue noch nicht live</span>
      </div>

      <div style={{ marginTop: 7, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 6 }}>
        <div style={{ padding: 7, background: '#0b1924', borderRadius: 6, border: '1px solid #22384a' }}>
          <div style={{ fontSize: 9, color: '#64788a' }}>Holding Zone</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#d6e2ec', fontWeight: 700 }}>{holdingZone.label}</div>
        </div>
        <div style={{ padding: 7, background: '#0b1924', borderRadius: 6, border: '1px solid #22384a' }}>
          <div style={{ fontSize: 9, color: '#64788a' }}>Traffic Class</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#c9a961', fontFamily: 'monospace' }}>{holdingZone.zoneClass}</div>
        </div>
        <div style={{ padding: 7, background: '#0b1924', borderRadius: 6, border: '1px solid #22384a' }}>
          <div style={{ fontSize: 9, color: '#64788a' }}>Kapazität</div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#d6e2ec' }}>{holdingZone.maxConcurrent} gleichzeitig</div>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: '#8aa0b5', lineHeight: 1.45 }}>
        Transitende → Rendezvous → Holding → Portfreigabe → Approach → Docked. Die Holding-Zone ist ein lokaler Rendezvous-/Traffic-Control-Korridor im Stationsbezugssystem, kein automatisch angenommener stabiler Orbit um den Zielkörper.
      </div>

      <div style={{ marginTop: 6, fontSize: 9, color: '#64788a' }}>
        Eine echte Queue-Position, Wartezeit oder Portfreigabe wird erst angezeigt, sobald Core diese Werte persistent liefert.
      </div>
    </div>
  )
}
