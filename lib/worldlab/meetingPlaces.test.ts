import { describe, expect, it } from 'vitest'
import { meetingPlaceLine, meetingPlaces, nearestMeetingPlace, OMNIZEDENZ_MEETING_PLACES } from './meetingPlaces'

const sundernBuilding = { id: 'te-87', typeId: 'resonance_place', name: 'Omnizedenz-Begegnungsstätte Sundern', lat: 51.32801, lon: 8.0043, source: 'osm:way:459501013' }

describe('Omnizedenz meeting places', () => {
  it('links a fixed place to its converted NOXIA building instead of listing it twice', () => {
    const places = meetingPlaces([sundernBuilding, { id: 'cafe', typeId: 'cafe', name: 'Café', lat: 51.3, lon: 8.0 }])
    expect(places).toHaveLength(OMNIZEDENZ_MEETING_PLACES.length)
    expect(places.find(place => place.id === 'sundern-hauptstrasse-87')?.noxiaId).toBe('te-87')
  })

  it('adds built resonance places anywhere', () => {
    const places = meetingPlaces([{ id: 'mars-1', typeId: 'resonance_place', name: 'Tharsis Hub', lat: 0, lon: 0 }])
    expect(places.at(-1)).toMatchObject({ noxiaId: 'mars-1', name: 'Resonanzplatz · Tharsis Hub' })
  })

  it('finds the nearest one', () => {
    const near = nearestMeetingPlace(meetingPlaces(), { lat: 51.3298, lon: 8.0072 })
    expect(near?.place.town).toBe('Sundern')
    expect(near!.distanceM).toBeLessThan(500)
    expect(nearestMeetingPlace(meetingPlaces(), { lat: 50.11, lon: 8.68 })?.place.id).toBe('frankfurt-artlounge')
  })

  it('describes place, address and round in one line', () => {
    expect(meetingPlaceLine(OMNIZEDENZ_MEETING_PLACES[0])).toBe('Omnizedenz-Begegnungsstätte Sundern (Hauptstraße 87, Sundern) – offene Resonanzrunde mittwochs 19–21 Uhr, Gastgeberin/Gastgeber Johanna Lind')
  })
})
