import { describe, expect, it } from 'vitest'
import { ANALYSES, FIELD_LAB, STANDARD_LAB, analysisStatus, runAnalysis, type LabSample } from './lab'

const sample: LabSample = { id: 'S1', label: 'Probe', source: 'G9', findings: [{ analysisId: 'basic', measurement: 'm', interpretation: 'd' }, { analysisId: 'raman', measurement: 'r' }] }

describe('Labor-Kern', () => {
  it('Feldlabor kann keine Spektroskopie, Standardlabor schon', () => {
    expect(analysisStatus(ANALYSES.raman, FIELD_LAB, [])).toBe('needs-lab')
    expect(analysisStatus(ANALYSES.raman, STANDARD_LAB, [])).toBe('ready')
    expect(analysisStatus(ANALYSES.basic, FIELD_LAB, [])).toBe('ready')
  })
  it('Lernvoraussetzung sperrt, bis freigeschaltet', () => {
    const gated = { ...ANALYSES.geo, requiresUnlock: 'UNL:NOX:x' }
    expect(analysisStatus(gated, FIELD_LAB, [])).toBe('needs-learning')
    expect(analysisStatus(gated, FIELD_LAB, ['UNL:NOX:x'])).toBe('ready')
  })
  it('Analyse liefert den Befund oder den Grund', () => {
    const ok = runAnalysis(sample, 'basic', FIELD_LAB, [])
    expect(ok.ok && ok.finding.measurement).toBe('m')
    expect(runAnalysis(sample, 'raman', FIELD_LAB, [])).toEqual({ ok: false, reason: 'needs-lab' })
    expect(runAnalysis(sample, 'geo', FIELD_LAB, [])).toEqual({ ok: false, reason: 'no-result' })
    expect(runAnalysis(sample, 'unbekannt', FIELD_LAB, [])).toEqual({ ok: false, reason: 'no-result' })
  })
})
