import {describe,it,expect,vi} from 'vitest'
import {persistEpistemicObservations,consolidateSleepingEpistemicTraces} from './personEpistemicPersistence'
import type {Observation} from './observation'

const sample:Observation={id:'00000000-0000-4000-8000-000000000001',observerId:'npc-a',subjectRef:'cafe',attribute:'status',value:'open',source:{type:'person',id:'npc-b'},modality:'reported',observedAtTick:100,confidence:.7,salience:.5}

describe('epistemic persistence when optional tables are not deployed',()=>{
 it('reports missing trace table rather than claiming a successful write',async()=>{
  const upsert=vi.fn().mockResolvedValue({error:{message:'relation person_epistemic_traces does not exist'}})
  const from=vi.fn().mockReturnValue({upsert})
  const result=await persistEpistemicObservations({from},[sample])
  expect(from).toHaveBeenCalledWith('person_epistemic_traces')
  expect(result.written).toBe(0)
  expect(result.error).toContain('does not exist')
 })
 it('does not try consolidation writes after missing trace table read',async()=>{
  const limit=vi.fn().mockResolvedValue({data:null,error:{message:'relation person_epistemic_traces does not exist'}})
  const order=vi.fn().mockReturnValue({limit})
  const gte=vi.fn().mockReturnValue({order})
  const inFn=vi.fn().mockReturnValue({gte})
  const select=vi.fn().mockReturnValue({in:inFn})
  const from=vi.fn().mockReturnValue({select})
  const result=await consolidateSleepingEpistemicTraces({from},{sleepingPersonIds:['npc-a'],tick:100})
  expect(result.written).toBe(0)
  expect(result.error).toContain('does not exist')
  expect(from).toHaveBeenCalledTimes(1)
 })
 it('skips database access for empty input',async()=>{
  const from=vi.fn()
  expect(await persistEpistemicObservations({from},[])).toEqual({written:0,error:null})
  expect(await consolidateSleepingEpistemicTraces({from},{sleepingPersonIds:[],tick:100})).toEqual({considered:0,written:0,error:null})
  expect(from).not.toHaveBeenCalled()
 })
})
