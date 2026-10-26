import { describe, expect, it } from 'vitest'
import { normalizeKgRelations } from './academyKgRelations'

describe('Academy KG relation contract', () => {
  const record = { from: 'ENTITY:A', to: 'ENTITY:B', relation: 'RELATES_TO' }
  const response = (id: string, outgoing: unknown[], incoming: unknown[] = []) => ({
    ok: true, schema: 'KUEPER-KG-QUERY-0.1', query: 'findRelations', data: { id, outgoing, incoming },
  })
  it('accepts grounded edges connected to the queried KG entity', () => {
    expect(normalizeKgRelations(response('ENTITY:A', [record]), 'ENTITY:A')).toEqual([
      { ...record, source: 'KG' },
    ])
  })
  it('rejects missing, wrong, or unrelated relations', () => {
    expect(normalizeKgRelations(response('ENTITY:C', [record]), 'ENTITY:A')).toEqual([])
    expect(normalizeKgRelations(response('ENTITY:A', [record]), 'ENTITY:A')).toHaveLength(1)
    expect(normalizeKgRelations(response('ENTITY:A', [{ from: 'X', to: 'Y', relation: 'R' }]), 'ENTITY:A')).toEqual([])
    expect(normalizeKgRelations({ ok: false, data: { id: 'ENTITY:A', outgoing: [record] } }, 'ENTITY:A')).toEqual([])
    expect(normalizeKgRelations({ ...response('ENTITY:A', [record]), query: 'unexpected' }, 'ENTITY:A')).toEqual([])
  })
  it('rejects unknown schema versions and self-loop records', () => {
    expect(normalizeKgRelations({ ...response('ENTITY:A', [record]), schema: 'UNRECOGNIZED' }, 'ENTITY:A')).toEqual([])
    expect(normalizeKgRelations(response('ENTITY:A', [{ from: 'ENTITY:A', to: 'ENTITY:A', relation: 'RELATES_TO' }]), 'ENTITY:A')).toEqual([])
  })
  it('deduplicates incoming and outgoing without inferring new edges', () => {
    expect(normalizeKgRelations(response('ENTITY:A', [record, record], [record]), 'ENTITY:A')).toHaveLength(1)
  })
})
