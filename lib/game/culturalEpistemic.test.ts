import { describe, expect, it } from 'vitest'
import {
  evaluateCesActivation,
  normalizeBeliefState,
  resolveCesQuestion,
  classifyCesMemoryClaim,
  validateCesReceptionGraph,
  validateCesInstitution,
  validateCesControversy,
  normalizeCesControversy,
} from './culturalEpistemic'

describe('CES foundation', () => {
  it('normalizes hot belief state', () => {
    expect(normalizeBeliefState({
      commitment: 2,
      socialBinding: -1,
      revisability: 0.4,
      salience: Number.NaN,
    })).toEqual({
      commitment: 1,
      socialBinding: 0,
      revisability: 0.4,
      salience: 0,
    })
  })

  it('keeps irrelevant events out of belief processing', () => {
    expect(evaluateCesActivation({
      belief: { commitment: 1, socialBinding: 1, revisability: 0, salience: 1 },
      relevance: 0,
    }).active).toBe(false)
  })

  it('can raise salience for a relevant intense event', () => {
    const result = evaluateCesActivation({
      belief: { commitment: 0.5, socialBinding: 0.2, revisability: 0.8, salience: 0.05 },
      relevance: 0.8,
      intensity: 0.8,
    })
    expect(result.active).toBe(true)
    expect(result.effectiveSalience).toBeGreaterThan(0.25)
  })

  it('never resolves an ontologically open question', () => {
    expect(resolveCesQuestion({
      id: 'ultimate-purpose',
      ontology: 'open',
      value: true,
    })).toBeUndefined()
  })

  it('may expose a defined determinate value to authorized internal consumers', () => {
    expect(resolveCesQuestion({
      id: 'reactor-failed',
      ontology: 'determinate',
      value: true,
    })).toBe(true)
  })
  it('detects contested public attribution without rewriting the source', () => {
    expect(classifyCesMemoryClaim({
      id: 'quote-1',
      text: 'A later famous formulation',
      attributedSourceId: 'source-kuper-2032',
      provenanceSourceId: 'pamphlet-2091',
      confidence: 0.8,
    })).toBe('contested_attribution')
  })

  it('fails closed on dangling reception relations', () => {
    expect(validateCesReceptionGraph({
      nodes: [{ id: 'source-1', role: 'source_object', label: 'Archive source' }],
      edges: [{
        fromId: 'missing-interpretation',
        toId: 'source-1',
        relation: 'interprets',
        confidence: 0.7,
        sourceRef: 'event:test',
      }],
    })).toContain('missing from node: missing-interpretation')
  })

  it('requires provenance for reception relations', () => {
    expect(validateCesReceptionGraph({
      nodes: [
        { id: 'source-1', role: 'source_object', label: 'Archive source' },
        { id: 'memory-1', role: 'public_memory', label: 'Public memory' },
      ],
      edges: [{
        fromId: 'memory-1',
        toId: 'source-1',
        relation: 'attributes_to',
        confidence: 0.9,
        sourceRef: '',
      }],
    })).toContain('missing provenance: memory-1->source-1')
  })
  it('keeps resonance centres plural-use by contract', () => {
    expect(validateCesInstitution({
      id: 'rc-luna-01',
      kind: 'resonance_centre',
      name: 'Luna Resonance Centre',
      traditionTags: ['omnizedenz'],
      activityTags: ['dialogue', 'archive', 'meditation'],
      pluralUse: false,
    })).toContain('resonance centre must default to plural use')
  })

  it('does not encode a winning side in controversies', () => {
    const controversy = normalizeCesControversy({
      id: 'shared-dome-01',
      subjectRef: 'place:observation-dome',
      positionIds: ['shared-use', 'dedicated-use'],
      salience: 2,
      openedByEventRef: 'event:allocation-hearing',
    })
    expect(controversy.salience).toBe(1)
    expect(validateCesControversy(controversy, [
      { id: 'shared-use', label: 'Shared use', sourceRef: 'hearing:a' },
      { id: 'dedicated-use', label: 'Dedicated use', sourceRef: 'hearing:b' },
    ])).toEqual([])
    expect(controversy).not.toHaveProperty('winner')
    expect(controversy).not.toHaveProperty('correctPositionId')
  })

  it('requires plural documented positions for a controversy', () => {
    expect(validateCesControversy({
      id: 'c1',
      subjectRef: 'policy:space',
      positionIds: ['only-one'],
      salience: 0.5,
      openedByEventRef: 'event:1',
    }, [{ id: 'only-one', label: 'Only position', sourceRef: 'record:1' }]))
      .toContain('controversy requires at least two positions')
  })
})
