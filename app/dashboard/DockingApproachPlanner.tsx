'use client'

import { useEffect, useMemo, useState } from 'react'
import { getDockingApproachOptions } from '@/lib/game/dockingApproach'
import { getShipDockingProfile } from '@/lib/game/shipDockingProfiles'

export default function DockingApproachPlanner({
  stationSlug,
  shipTypeId,
}: {
  stationSlug: string
  shipTypeId: string
}) {
  const shipProfile = getShipDockingProfile(shipTypeId)
  const options = useMemo(
    () => shipProfile ? getDockingApproachOptions(stationSlug, shipProfile.vesselClass) : [],
    [stationSlug, shipProfile],
  )
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedPortId(options[0]?.port.id ?? null)
  }, [stationSlug, shipTypeId, options])

  if (!shipProfile || options.length === 0) return null

  const selected = options.find(option => option.port.id === selectedPortId)?.port ?? null

  return (
    <div style={{ marginTop: 10, padding: '9px 10px', background: '#0a1721', border: '1px solid #294052', borderRadius: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <strong style={{ fontSize: 10, color: '#c9a961', fontFamily: 'monospace', letterSpacing: '.08em' }}>
          ANFLUGZIEL PLANEN
        </strong>
        <span style={{ fontSize: 9, color: '#64788a' }}>lokal · keine Reservierung</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
        {options.map(({ port, exactClassMatch }) => {
          const selectedNow = port.id === selectedPortId
          return (
            <button
              key={port.id}
              type="button"
              onClick={() => setSelectedPortId(port.id)}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                border: `1px solid ${selectedNow ? '#c9a961' : '#294052'}`,
                background: selectedNow ? 'rgba(201,169,97,.12)' : '#0b1924',
                color: selectedNow ? '#e2c978' : '#8aa0b5',
                fontSize: 10,
              }}
            >
              {port.label}{exactClassMatch ? ' · bevorzugt' : ''}
            </button>
          )
        })}
      </div>

      {selected && (
        <div style={{ marginTop: 7, fontSize: 10, color: '#8aa0b5', lineHeight: 1.4 }}>
          Geplantes Ziel: <strong style={{ color: '#d6e2ec' }}>{selected.label}</strong>. Diese Auswahl speichert keinen Portzustand und blockiert keinen anderen Verkehr. Sobald Core die persistente Reservierung liefert, wird genau hier der echte Reservierungs-Command angebunden.
        </div>
      )}
    </div>
  )
}
