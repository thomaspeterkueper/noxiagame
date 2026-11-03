'use client'

// app/earth/RealVenueInterior.tsx
// Echte Lokale der Karte als volle Lokale (Thomas, 03.11.2026: „Lokale zusammenführen“).
// Ein reales Café, eine Bar, Kneipe oder ein Restaurant aus OpenStreetMap öffnet
// dasselbe Lokal wie Metropol oder Balkan Grill: Karte, Bestellen, Arbeiten, Begleitung.
// Das NOXIA-Lokal dazu sucht oder legt /api/game/hospitality/real-venue an.
// Wer laut Simulation gerade dort ist (Anwesenheit am Ort), ist auch drinnen:
// Wer dort arbeitet, steht hinter dem Tresen; die anderen sind Gäste.
// Klappt das nicht, öffnet der einfache Gastraum (`fallback`).

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import CafeWalkableInterior from './CafeWalkableInterior'
import { getSessionInfo } from '@/lib/supabase/auth'
import type { ColonyResident } from '@/lib/store/colonyStateStore'

export type RealVenuePerson = { id: string; name: string; role: string; host: boolean }

type Props = {
  source?: string | null
  amenity: string
  name: string
  at: { lat: number; lon: number }
  people: readonly RealVenuePerson[]
  /** Bewohner der Weltkarte mit Aussehen – für die Figuren drinnen. */
  residents: readonly ColonyResident[]
  companion?: ColonyResident | null
  onClose: () => void
  fallback: ReactNode
}

export default function RealVenueInterior({ source, amenity, name, at, people, residents, companion = null, onClose, fallback }: Props) {
  const [venue, setVenue] = useState<{ id: string; kind: string; name: string | null } | null | 'failed'>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        if (!source) throw new Error('ohne Kennung')
        const { token } = await getSessionInfo()
        const response = await fetch('/api/game/hospitality/real-venue', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, amenity, name, lat: at.lat, lon: at.lon }),
        })
        const data = await response.json().catch(() => null)
        if (live) setVenue(response.ok && data?.id ? { id: String(data.id), kind: String(data.kind), name: data.name ? String(data.name) : null } : 'failed')
      } catch { if (live) setVenue('failed') }
    })()
    return () => { live = false }
  }, [source, amenity, name, at.lat, at.lon])

  // Anwesende als Figuren: wer arbeitet, gehört zum Haus.
  const present = useMemo(() => {
    if (!venue || venue === 'failed') return []
    return people.slice(0, 16).flatMap(person => {
      const base = residents.find(r => r.id === person.id)
      if (!base) return []
      const work = person.host ? [{ type: 'work', roleCode: person.role, tileEntityId: venue.id }] : []
      return [{ ...base, assignments: [...work, ...base.assignments.filter(a => a.type !== 'work')] } as ColonyResident]
    })
  }, [venue, people, residents])

  if (venue === 'failed') return <>{fallback}</>
  if (!venue) return <div style={{ position: 'fixed', inset: 0, zIndex: 2300, background: 'rgba(2,7,12,.82)', display: 'grid', placeItems: 'center', color: '#eef4f1', font: '700 13px system-ui' }}>Lokal wird betreten …</div>
  const label = venue.kind === 'bar' ? 'Bar' : venue.kind === 'restaurant' ? 'Restaurant' : 'Café'
  return <CafeWalkableInterior entityId={venue.id} buildingTypeId={venue.kind} buildingName={`${label} · ${venue.name ?? name}`} companion={companion} onClose={onClose} presentPeople={present} />
}
