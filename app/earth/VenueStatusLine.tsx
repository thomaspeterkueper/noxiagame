'use client'

// app/earth/VenueStatusLine.tsx
// Aufgabe 11 der Gastronomie: in der Gebäudetafel der Weltkarte bei einem Lokal
// sagen, ob es jetzt offen ist – mit Uhrzeit und Öffnungszeit, nach denselben
// Regeln wie im Lokal (lib/game/hospitality/venueStatus.ts). Daten wie drinnen:
// Stunde aus /api/game/hospitality/guests, Personal aus /api/game/population.

import { useEffect, useState } from 'react'
import { getSessionInfo } from '@/lib/supabase/auth'
import { SOCIAL_INFRASTRUCTURE } from '@/lib/game/settlements/tiers'
import { venueHoursFor, venueKindForBuildingType } from '@/lib/game/hospitality/venues'
import { venueStatusLine } from '@/lib/game/hospitality/venueStatus'

export default function VenueStatusLine({ entityId, typeId }: { entityId: string; typeId: string }) {
  const [colonyHour, setColonyHour] = useState<number | null>(null)
  const [staffCount, setStaffCount] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const kind = venueKindForBuildingType(typeId)
  const arrivalPoint = SOCIAL_INFRASTRUCTURE[kind]?.arrivalPoint === true
  const hours = venueHoursFor(kind, arrivalPoint)

  useEffect(() => {
    let live = true
    setLoaded(false); setColonyHour(null); setStaffCount(null)
    ;(async () => {
      try {
        const { token } = await getSessionInfo()
        const headers = { Authorization: 'Bearer ' + token }
        const [guests, people] = await Promise.all([
          fetch('/api/game/hospitality/guests?tileEntityId=' + encodeURIComponent(entityId), { headers, cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/game/population?tileEntityId=' + encodeURIComponent(entityId), { headers, cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        ])
        if (!live) return
        if (typeof guests?.hour === 'number') setColonyHour(guests.hour)
        if (Array.isArray(people?.residents)) {
          setStaffCount(people.residents.filter((r: { assignments?: Array<{ type: string; tileEntityId?: string }> }) => r.assignments?.some(a => a.type === 'work' && a.tileEntityId === entityId)).length)
        }
      } finally { if (live) setLoaded(true) }
    })()
    return () => { live = false }
  }, [entityId])

  if (!loaded) return <div className="row"><span>Ob geöffnet ist, wird nachgesehen …</span></div>
  // Das Startcafé geht nach der Uhr des Spielers, alle anderen nach Koloniezeit.
  const hour = hours.clock === 'player' ? new Date().getHours() : colonyHour
  const status = venueStatusLine({ kind, hours, hour, staffCount })
  return <div className="row"><span>{status.open === true ? '● ' : status.open === false ? '○ ' : ''}{status.text}</span></div>
}
