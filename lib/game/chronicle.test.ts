import { describe, expect, it } from 'vitest'
import { economyChronicle, personChronicle, type ChronicleLookups } from './chronicle'

const l: ChronicleLookups = {
  currentTick: 100,
  personName: id => ({ a: 'Asha Menon', b: 'Tomas Eriksen', c: 'Farah Rahimi' } as Record<string, string>)[id ?? ''],
  actorName: id => ({ f1: 'Boann', f2: 'Belenus AG' } as Record<string, string>)[id],
  locationName: id => ({ mars: 'Mars', phobos: 'Phobos' } as Record<string, string>)[id ?? ''],
  buildingName: id => (id ? 'Habitat' : undefined),
}

describe('personChronicle', () => {
  it('führt die zwei Zeilen einer Begegnung zusammen und nennt Konflikte zuerst', () => {
    const items = personChronicle([
      { tick: 100, event_type: 'social_interaction', actor_person_id: 'a', related_person_id: 'c', location_id: 'mars', payload: { encounterId: 'e2', tileEntityId: 't' } },
      { tick: 97, event_type: 'person_conflict', actor_person_id: 'a', related_person_id: 'b', location_id: 'mars', payload: { encounterId: 'e1', tileEntityId: 't' } },
      { tick: 97, event_type: 'person_conflict', actor_person_id: 'b', related_person_id: 'a', location_id: 'mars', payload: { encounterId: 'e1', tileEntityId: 't' } },
    ], l)
    expect(items).toHaveLength(2)
    expect(items[0].text).toBe('Streit zwischen Asha Menon und Tomas Eriksen · Habitat, Mars · vor 3 Std.')
    expect(items[1].text).toBe('Asha Menon und Farah Rahimi sind sich begegnet · Habitat, Mars')
  })
  it('bleibt leer, wenn nichts passiert ist oder Namen fehlen', () => {
    expect(personChronicle([], l)).toEqual([])
    expect(personChronicle([{ tick: 1, event_type: 'person_conflict', actor_person_id: 'x', related_person_id: 'y', location_id: null, payload: null }], l)).toEqual([])
  })
})

describe('economyChronicle', () => {
  it('summiert Produktion und meldet Verkäufe', () => {
    const items = economyChronicle([
      { tick: 100, kind: 'produce', resource: 'energy', goods_delta: 4, credit_delta: 28, actor_id: 'f2', location_id: 'mars' },
      { tick: 100, kind: 'produce', resource: 'energy', goods_delta: 4, credit_delta: 28, actor_id: 'f2', location_id: 'mars' },
      { tick: 100, kind: 'sell', resource: 'water', goods_delta: -14, credit_delta: 1400, actor_id: 'f1', location_id: 'phobos' },
    ], l)
    expect(items.map(i => i.text)).toEqual([
      'Boann verkaufte 14 t Wasser · Phobos',
      'Belenus AG erzeugte 8 t Energie · Mars',
    ])
  })
})
