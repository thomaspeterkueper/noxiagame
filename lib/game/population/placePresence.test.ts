import { describe, expect, it } from 'vitest'
import { doingFromAction, peopleAtPlace, type PresenceRow } from './placePresence'

const church = { lat: 51.33, lon: 8.0 }
const rows: PresenceRow[] = [
  { id: 'katrin', displayName: 'Katrin Vogelsang', lat: 51.33, lon: 8.0, sourceKind: 'region_feature_anchor', publicRole: 'Pfarrerin · Lukaskirche', activityState: 'working', lastAction: 'preach', placeOsm: 'osm:way:264006197' },
  { id: 'mika', displayName: 'Mika Berger', lat: 51.33, lon: 8.0, sourceKind: 'region_feature_anchor', publicRole: 'Café', activityState: 'socialising', lastAction: 'visit:service', placeOsm: 'osm:way:264006197' },
  { id: 'far', displayName: 'Jemand', lat: 51.34, lon: 8.0, sourceKind: 'building_anchor', activityState: 'resting', lastAction: null, placeOsm: null },
  { id: 'walker', displayName: 'Unterwegs', lat: 51.33, lon: 8.0, sourceKind: 'street_route', activityState: 'travelling', lastAction: null, placeOsm: null },
]

describe('people at a place', () => {
  it('finds host and visitors by OSM id', () => {
    const people = peopleAtPlace(rows, { osm: 'osm:way:264006197', at: church })
    expect(people.map(person => person.id)).toEqual(['katrin', 'mika'])
    expect(people[0]).toMatchObject({ host: true, doing: 'Gottesdienst' })
    expect(people[1]).toMatchObject({ host: false, doing: 'Gottesdienst', role: 'Café' })
  })

  it('falls back to distance for map points without an id', () => {
    const people = peopleAtPlace(rows, { at: church, radiusM: 40 })
    expect(people.map(person => person.id).sort()).toEqual(['katrin', 'mika'])
  })

  it('ignores people on the way and other places', () => {
    expect(peopleAtPlace(rows, { osm: 'osm:way:1', at: church })).toEqual([])
  })

  it('knows the host of a service even when they came from elsewhere', () => {
    const people = peopleAtPlace([
      { id: 'elias', displayName: 'Elias Hartmann', lat: 51.33, lon: 8.0, sourceKind: 'region_feature_anchor', publicRole: 'Pfarrer', activityState: 'socialising', lastAction: 'host:service', placeOsm: 'osm:way:1' },
      { id: 'ana', displayName: 'Ana', lat: 51.33, lon: 8.0, sourceKind: 'region_feature_anchor', activityState: 'socialising', lastAction: 'visit:service', placeOsm: 'osm:way:1' },
    ], { osm: 'osm:way:1', at: church })
    expect(people[0]).toMatchObject({ id: 'elias', host: true, doing: 'Gottesdienst' })
    expect(people[1]).toMatchObject({ host: false })
  })

  it('names what is going on', () => {
    expect(doingFromAction('visit:friday_prayer')).toBe('Freitagsgebet')
    expect(doingFromAction('visit:shabbat')).toBe('Schabbat')
    expect(doingFromAction('sleep')).toBeUndefined()
  })
})
