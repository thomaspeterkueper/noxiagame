import { describe, expect, it } from 'vitest'
import { createInteriorForBuildingInstance, createInteriorForStationInstance } from './bindings'
import { validateInteriorInstance } from './instances'
import { findInteriorRoute } from './navigation'
import { LABORATORY_STANDARD_INTERIOR } from './templates/laboratoryStandard'
import { ORBITAL_TRANSFER_STATION_INTERIOR } from './templates/orbitalTransferStation'

describe('interior host abstraction', () => {
  it('keeps existing building bindings compatible', () => {
    const result = createInteriorForBuildingInstance(
      { id: 'BLD:LAB:100', buildingTypeId: 'laboratory' },
      { interiorInstanceId: 'INT:LAB:100' },
    )

    expect(result?.host).toEqual({ kind: 'building', id: 'BLD:LAB:100' })
    expect(result?.interior.buildingInstanceId).toBe('BLD:LAB:100')
    expect(result?.interior.host.kind).toBe('building')
  })

  it('binds an orbital station without pretending it is a building', () => {
    const result = createInteriorForStationInstance(
      { id: 'STA:PHOBOS:001', stationSlug: 'phobos' },
      ORBITAL_TRANSFER_STATION_INTERIOR,
      'INT:STA:PHOBOS:001',
    )

    expect(result.host).toEqual({ kind: 'station', id: 'STA:PHOBOS:001' })
    expect(result.interior.host.kind).toBe('station')
    expect(result.interior.buildingInstanceId).toBeUndefined()
    expect(validateInteriorInstance(ORBITAL_TRANSFER_STATION_INTERIOR, result.interior)).toEqual([])
  })

  it('uses the same navigation engine for station decks', () => {
    const result = createInteriorForStationInstance(
      { id: 'STA:KEPLER:001', stationSlug: 'kepler' },
      ORBITAL_TRANSFER_STATION_INTERIOR,
      'INT:STA:KEPLER:001',
    )

    const route = findInteriorRoute(
      ORBITAL_TRANSFER_STATION_INTERIOR,
      result.interior,
      'dock-airlock',
      'depot',
    )

    expect(route?.rooms).toEqual([
      'dock-airlock',
      'transfer-corridor',
      'habitat-hub',
      'service-spine',
      'depot',
    ])
  })

  it('rejects a station instance against a building-only template', () => {
    const result = createInteriorForStationInstance(
      { id: 'STA:TEST:001', stationSlug: 'test' },
      LABORATORY_STANDARD_INTERIOR,
      'INT:STA:TEST:001',
    )

    const issues = validateInteriorInstance(LABORATORY_STANDARD_INTERIOR, result.interior)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: 'host-mismatch' })
  })
})
