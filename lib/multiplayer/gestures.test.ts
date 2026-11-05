import { describe, expect, it } from 'vitest'
import { acceptedBy, besidePartner, faceTowards, gestureState, invitesFor, jointState, npcJointDecision, parseGestureCommand, poseNow, type NpcJointContext } from './gestures'

const base: NpcJointContext = { companion: false, staff: false, working: false, minor: false, sitting: false, danceFloor: true, dancing: false, npcHasDrink: true, playerHasDrink: true, mourning: false, condoled: false, refusedTalk: false }

describe('gestures', () => {
  it('reads chat commands', () => {
    expect(parseGestureCommand('/winken')).toEqual({ kind: 'gesture', name: 'winken' })
    expect(parseGestureCommand(' / Prost!')).toEqual({ kind: 'gesture', name: 'prost' })
    expect(parseGestureCommand('/tanzen mit')).toEqual({ kind: 'joint', name: 'paartanz' })
    expect(parseGestureCommand('/hand')).toEqual({ kind: 'joint', name: 'handschlag' })
    expect(parseGestureCommand('/trösten')).toEqual({ kind: 'joint', name: 'troesten' })
    expect(parseGestureCommand('winken')).toBeNull(); expect(parseGestureCommand('/quatsch')).toBeNull()
  })
  it('short gestures end, dancing lasts', () => {
    const w = gestureState('winken', 1000)
    expect(poseNow(w, 2000)).toBe('winken'); expect(poseNow(w, 9000)).toBeNull()
    expect(poseNow(gestureState('tanzen', 0), 10 ** 7)).toBe('tanzen')
  })
  it('invite and accept between players', () => {
    const invite = { to: 'b', action: 'paartanz' as const, at: 1000 }
    expect(invitesFor([{ profileId: 'a', invite }], 'b', 2000)).toHaveLength(1)
    expect(invitesFor([{ profileId: 'a', invite }], 'b', 40_000)).toHaveLength(0)
    expect(acceptedBy([{ profileId: 'b', pose: jointState('paartanz', 'a', 1500) }], invite, 'a')?.profileId).toBe('b')
    expect(acceptedBy([{ profileId: 'b', pose: jointState('umarmen', 'a', 1500) }], invite, 'a')).toBeNull()
    expect(besidePartner({ x: 10, y: 0 }, { x: 100, y: 50 }).x).toBeLessThan(100)
    expect(faceTowards({ x: 10 }, { x: 100 })).toBe('se')
  })
  it('residents decide by what they know', () => {
    expect(npcJointDecision('handschlag', base).ok).toBe(true)
    expect(npcJointDecision('umarmen', base).ok).toBe(false)
    expect(npcJointDecision('umarmen', { ...base, companion: true }).ok).toBe(true)
    expect(npcJointDecision('anstossen', { ...base, npcHasDrink: false }).ok).toBe(false)
    expect(npcJointDecision('paartanz', { ...base, danceFloor: false }).ok).toBe(false)
    expect(npcJointDecision('paartanz', { ...base, minor: true }).ok).toBe(false)
    expect(npcJointDecision('paartanz', { ...base, working: true }).ok).toBe(false)
    expect(npcJointDecision('troesten', { ...base, mourning: true }).ok).toBe(true)
    expect(npcJointDecision('troesten', base).ok).toBe(false)
    expect(npcJointDecision('handschlag', { ...base, refusedTalk: true }).ok).toBe(false)
  })
})

import { FOLLOW_JOINTS, sidePose } from './gestures'
describe('walking together', () => {
  it('arm and hand in hand: by command, only with the companion, the right hand', () => {
    expect(parseGestureCommand('/hand in hand')).toEqual({ kind: 'joint', name: 'handinhand' })
    expect(parseGestureCommand('/in den Arm')).toEqual({ kind: 'joint', name: 'armnehmen' })
    expect(parseGestureCommand('/hand')).toEqual({ kind: 'joint', name: 'handschlag' })
    expect(FOLLOW_JOINTS.has('handinhand') && FOLLOW_JOINTS.has('armnehmen') && !FOLLOW_JOINTS.has('umarmen')).toBe(true)
    expect(npcJointDecision('handinhand', base).ok).toBe(false)
    expect(npcJointDecision('handinhand', { ...base, companion: true }).ok).toBe(true)
    expect(npcJointDecision('armnehmen', { ...base, companion: true, minor: true }).ok).toBe(false)
    expect(npcJointDecision('armnehmen', { ...base, mourning: true, condoled: true }).ok).toBe(true)
    expect(sidePose('handinhand', 'se', { x: 0 }, { x: 30 })).toBe('handinhand')
    expect(sidePose('handinhand', 'se', { x: 30 }, { x: 0 })).toBe('handinhand_l')
    expect(sidePose('handinhand', 'sw', { x: 30 }, { x: 0 })).toBe('handinhand')
  })
})
