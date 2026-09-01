import { describe, expect, it } from 'vitest'
import { mergeDiscoveries, runScannerPipeline, type ScannerGroundTruth } from './domain'

const truth: ScannerGroundTruth = { subjectId:'deposit-7', locationId:'tharsis-hub', kind:'subsurface-deposit', signal:0.9, discoverable:true, tile:{row:4,col:9} }

describe('scanner domain',()=>{
 it('keeps ground truth separate while deriving measurement, interpretation and discovery',()=>{
  const result=runScannerPipeline(truth)
  expect(result.groundTruth).toBe(truth)
  expect(result.measurement.subjectId).toBe(truth.subjectId)
  expect(result.interpretation.classification).toBe('confirmed')
  expect(result.discovery?.discoveryKey).toBe('tharsis-hub:deposit-7')
 })
 it('does not discover when evidence is insufficient',()=>{
  const result=runScannerPipeline({...truth,signal:0.2})
  expect(result.discovery).toBeNull()
 })
 it('merges repeated discoveries idempotently',()=>{
  const discovery=runScannerPipeline(truth).discovery!
  expect(mergeDiscoveries([discovery],[discovery])).toEqual([discovery])
 })
})
