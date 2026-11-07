import { describe, expect, it } from 'vitest'
import { approvedTrainingForInstance, proposeTraining, reviewTraining } from './training'
const base = { id: 'proposal:1', legacyIdentityId: 'legacy:1', createdByUserId: 'user:1',
  target: 'style' as const, proposedText: 'Prefer concise answers', sourceIds: [] as string[], createdAt: '2026-11-03' }
describe('Living Legacy owner training', () => {
  it('keeps suggestions pending until explicitly approved', () => {
    const p = proposeTraining(base)
    expect(p.status).toBe('proposed')
    expect(approvedTrainingForInstance([p], 'legacy:1')).toEqual([])
  })
  it('only allows owner to approve', () => {
    const p = proposeTraining(base)
    expect(() => reviewTraining(p, {proposalId:p.id,approved:true,reviewedByUserId:'stranger',reviewedAt:'2026-11-03'}, 'user:1')).toThrow('owner')
    const approved = reviewTraining(p,{proposalId:p.id,approved:true,reviewedByUserId:'user:1',reviewedAt:'2026-11-03'},'user:1')
    expect(approvedTrainingForInstance([approved],'legacy:1')).toHaveLength(1)
  })
  it('requires sources for historical corrections', () => {
    expect(() => proposeTraining({...base, target:'historical-correction'})).toThrow('source')
  })
  it('does not permit repeated approval', () => {
    const p = proposeTraining(base)
    const decision = {proposalId:p.id,approved:true,reviewedByUserId:'user:1',reviewedAt:'2026-11-03'}
    expect(() => reviewTraining(reviewTraining(p,decision,'user:1'),decision,'user:1')).toThrow('already reviewed')
  })
})
