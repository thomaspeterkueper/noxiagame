import { describe, expect, it } from 'vitest'
import { resolveRoomFunctions, roomHasCapability } from './resolution'
import { LABORATORY_STANDARD_INTERIOR } from '../templates/laboratoryStandard'
import { ORBITAL_TRANSFER_STATION_INTERIOR } from '../templates/orbitalTransferStation'

describe('interior capability and function registry', () => {
  it('resolves laboratory measurement functions separately from interpretation', () => {
    const room = LABORATORY_STANDARD_INTERIOR.rooms.find(candidate => candidate.id === 'analysis-lab')
    expect(room).toBeTruthy()
    if (!room) return

    const resolved = resolveRoomFunctions(room)

    expect(resolved.unknownCapabilityIds).toEqual([])
    expect(resolved.capabilityIds).toContain('research.sample.basic-analysis')
    expect(resolved.capabilityIds).toContain('research.spectroscopy.raman-ir')
    expect(resolved.functions.map(fn => fn.id)).toContain('sample.basic-analysis')
    expect(resolved.functions.map(fn => fn.id)).toContain('sample.raman-ir-analysis')
    expect(resolved.capabilities.filter(capability => capability.measurementCapability)).not.toHaveLength(0)
    expect(resolved.capabilities.some(capability => capability.interpretationCapability)).toBe(false)
  })

  it('resolves stored-data reanalysis as an interpretation capability', () => {
    const room = LABORATORY_STANDARD_INTERIOR.rooms.find(candidate => candidate.id === 'data-room')
    expect(room).toBeTruthy()
    if (!room) return

    const resolved = resolveRoomFunctions(room)
    expect(resolved.capabilityIds).toContain('research.data.reanalysis')
    expect(resolved.capabilities.some(capability => capability.interpretationCapability)).toBe(true)
    expect(resolved.functions.map(fn => fn.id)).toContain('data.reanalyse')
  })

  it('uses the same registry for orbital station services', () => {
    const cargoLock = ORBITAL_TRANSFER_STATION_INTERIOR.rooms.find(candidate => candidate.id === 'cargo-lock')
    const depot = ORBITAL_TRANSFER_STATION_INTERIOR.rooms.find(candidate => candidate.id === 'depot')
    expect(cargoLock).toBeTruthy()
    expect(depot).toBeTruthy()
    if (!cargoLock || !depot) return

    expect(roomHasCapability(cargoLock, 'cargo.transfer')).toBe(true)
    expect(resolveRoomFunctions(cargoLock).functions.map(fn => fn.id)).toContain('cargo.transfer')
    expect(resolveRoomFunctions(depot).functions.map(fn => fn.id)).toContain('station.depot.open')
  })

  it('surfaces unknown legacy or misspelled capabilities instead of silently accepting them', () => {
    const resolved = resolveRoomFunctions({
      id: 'room-x',
      levelId: 'level-x',
      name: 'Room X',
      kind: 'other',
      capabilities: ['research.sample.register', 'unknown.capability'],
    })

    expect(resolved.capabilityIds).toEqual(['research.sample.register'])
    expect(resolved.unknownCapabilityIds).toEqual(['unknown.capability'])
  })
})
