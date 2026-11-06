import { describe, expect, it } from 'vitest'
import { venuePath, isVenueBlocked } from '../hospitality/venues'
import { SERVICE_LAYOUTS, SERVICE_STAFF, cleanCaseText, serviceKindFor, serviceOpen, serviceStaffFacts, type ServiceKind } from './publicServices'

describe('public services', () => {
  const kinds = Object.keys(SERVICE_LAYOUTS) as ServiceKind[]
  it('every room can be walked: entrance to service point and every seat', () => {
    for (const k of kinds) {
      const l = SERVICE_LAYOUTS[k]
      expect(isVenueBlocked(l, l.servicePoint), k + ' service point free').toBe(false)
      expect(venuePath(l, l.start, l.servicePoint).length, k + ' path').toBeGreaterThan(2)
      for (const s of l.spots.filter(s => s.kind === 'seat')) expect(venuePath(l, l.start, s).length, k + ' ' + s.id).toBeGreaterThan(1)
    }
  })
  it('staff stand on existing spots', () => {
    for (const k of kinds) for (const s of SERVICE_STAFF[k]) expect(SERVICE_LAYOUTS[k].spots.some(p => p.id === s.spotId), k + ' ' + s.spotId).toBe(true)
  })
  it('maps OSM amenities', () => {
    expect(serviceKindFor('police')).toBe('police'); expect(serviceKindFor('clinic')).toBe('hospital'); expect(serviceKindFor('dentist')).toBe('doctors'); expect(serviceKindFor('cafe')).toBeNull()
  })
  it('practice hours, the rest always open', () => {
    expect(serviceOpen('doctors', new Date('2026-11-05T09:00:00Z'))).toBe(true)  // Do 10 Uhr
    expect(serviceOpen('doctors', new Date('2026-11-05T12:30:00Z'))).toBe(false) // 13:30 Mittag
    expect(serviceOpen('doctors', new Date('2026-11-07T09:00:00Z'))).toBe(false) // Samstag
    expect(serviceOpen('hospital', new Date('2026-11-07T02:00:00Z'))).toBe(true)
  })
  it('staff send real emergencies to real help and invent nothing', () => {
    const p = serviceStaffFacts('police', SERVICE_STAFF.police[0], { incidents: [], ownCases: [] })
    expect(p.some(f => f.includes('110'))).toBe(true); expect(p.some(f => f.includes('erfinde keine'))).toBe(true)
    const d = serviceStaffFacts('doctors', SERVICE_STAFF.doctors[1], { incidents: [], ownCases: [{ kind: 'termin', text: 'Kopfweh' }] })
    expect(d.some(f => f.includes('keine Diagnose')) && d.some(f => f.includes('116 117'))).toBe(true); expect(d.some(f => f.includes('Kopfweh'))).toBe(true)
  })
  it('case text cleaned', () => {
    expect(cleanCaseText('ab')).toBeNull()
    expect(cleanCaseText('Ruf mich an 0171 2345678')).toBe('Ruf mich an xxx')
  })
})
