import { describe, expect, it } from 'vitest'
import { CATTLE, CROPS, crushFee, fieldState, forestState, herdState, parcelLooks, quarryFee, quarryState } from './landWork'

const DAY = 86_400_000
const now = Date.parse('2026-11-06T12:00:00Z')
const ago = (d: number) => new Date(now - d * DAY).toISOString()

describe('Wald', () => {
  const start = { stockM3: 640, growthM3Year: 20, areaHa: 2 }
  it('nachhaltig: Zuwachs seit dem Kauf, höchstens zwei Spieljahre', () => {
    expect(forestState(null, start, ago(45), now).harvestableM3).toBe(30)
    expect(forestState(null, start, ago(200), now).harvestableM3).toBe(40)
  })
  it('Jungwald wächst nach Aufforstung von null an und ist zehn Spieljahre gesperrt', () => {
    const row = { stock_m3: 0, growth_m3_year: 20, last_harvest_at: null, cleared_at: ago(400), replanted_at: ago(310), updated_at: ago(310) }
    const s = forestState(row, start, ago(500), now)
    expect(s.stockM3).toBe(207)
    expect(s.harvestableM3).toBe(40)
    expect(s.look).toBeNull()
    const young = forestState({ ...row, replanted_at: ago(10), updated_at: ago(10) }, start, ago(500), now)
    expect(young.harvestableM3).toBe(0)
    expect(young.look).toBe('young')
    expect(forestState({ ...row, replanted_at: null }, start, ago(500), now).look).toBe('clearing')
  })
  it('Vorrat wächst nicht über einen ausgewachsenen Wald hinaus', () => {
    const row = { stock_m3: 630, growth_m3_year: 20, last_harvest_at: ago(100), cleared_at: null, replanted_at: null, updated_at: ago(100) }
    expect(forestState(row, start, ago(500), now).stockM3).toBe(640)
  })
})

describe('Feld', () => {
  const area = 20_000
  it('Saat bis Reife, volle Ernte, dann halbe, dann verdorben', () => {
    const sown = (d: number) => ({ crop: 'wheat', sown_at: ago(d), ripe_at: ago(d - CROPS.wheat.growDays), harvested_at: null })
    expect(fieldState(null, area, now)).toMatchObject({ status: 'empty', canSow: true })
    expect(fieldState(sown(10), area, now)).toMatchObject({ status: 'growing', canHarvest: false, look: 'sown' })
    expect(fieldState(sown(24), area, now)).toMatchObject({ status: 'ripe', expectedT: 15, look: 'ripe' })
    expect(fieldState(sown(30), area, now)).toMatchObject({ status: 'late', expectedT: 7 })
    expect(fieldState(sown(40), area, now)).toMatchObject({ status: 'spoiled', canSow: true })
    expect(fieldState({ ...sown(24), harvested_at: ago(1) }, area, now)).toMatchObject({ status: 'harvested', canSow: true, look: 'stubble' })
  })
  it('Saatgut und Ertrag je Frucht', () => {
    const options = fieldState(null, area, now).options
    expect(options.find(o => o.crop === 'wheat')).toMatchObject({ fee: 70, yieldT: 15, value: 165 })
    expect(options.find(o => o.crop === 'potatoes')).toMatchObject({ fee: 260, yieldT: 80, value: 400 })
    expect(fieldState(null, 1000, now).options.map(o => o.crop)).toEqual(['potatoes'])
  })
})

describe('Weide', () => {
  it('zählt Tiere, schlachtreife und freie Plätze', () => {
    const s = herdState({ cohorts: [{ n: 3, since: ago(CATTLE.matureDays + 1) }, { n: 2, since: ago(5) }] }, 30_000, now)
    expect(s).toMatchObject({ count: 5, mature: 3, capacity: 6, free: 1 })
    expect(Date.parse(s.nextMatureAt!)).toBe(now + (CATTLE.matureDays - 5) * DAY)
  })
})

describe('Steinbruch', () => {
  it('Abbau wächst mit der Zeit bis vier Spielmonate und endet mit dem Vorrat', () => {
    expect(quarryState(null, 10_000, ago(2), now)).toMatchObject({ reserveT: 50_000, extractableT: 80, fee: 48 })
    expect(quarryState(null, 10_000, ago(60), now).extractableT).toBe(400)
    expect(quarryState({ reserve_t: 30, last_extract_at: ago(5) }, 10_000, ago(60), now).extractableT).toBe(30)
    expect(quarryFee(5)).toBe(3)
    expect(crushFee(5)).toBe(3)
  })
})

describe('Aussehen auf der Karte', () => {
  it('Lichtung, Jungwald, Feld, Weide', () => {
    const looks = parcelLooks(
      [{ parcel_id: 'a', cleared_at: ago(5), replanted_at: null }, { parcel_id: 'b', cleared_at: ago(50), replanted_at: ago(40) }, { parcel_id: 'c', cleared_at: ago(500), replanted_at: ago(400) }],
      [{ parcel_id: 'd', crop: 'wheat', sown_at: ago(3), ripe_at: ago(-19), harvested_at: null }, { parcel_id: 'e', crop: 'wheat', sown_at: ago(30), ripe_at: ago(8), harvested_at: ago(7) }],
      [{ parcel_id: 'f', cohorts: [{ n: 4, since: ago(2) }] }, { parcel_id: 'g', cohorts: [] }],
      now,
    )
    expect(Object.fromEntries([...looks].map(([id, look]) => [id, look.look]))).toEqual({ a: 'clearing', b: 'young', d: 'sown', e: 'stubble', f: 'pasture' })
    expect(looks.get('f')!.animals).toBe(4)
    expect(looks.get('d')!.crop).toBe('wheat')
  })
})
