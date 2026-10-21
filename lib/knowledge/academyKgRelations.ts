/** Validates the KG findRelations query envelope. Never fabricate graph edges. */
export type AcademyKgEdge = { from: string; to: string; relation: string; source: 'KG' }
export function normalizeKgRelations(payload: unknown, requestedId: string): AcademyKgEdge[] {
  if (!payload || typeof payload !== 'object') return []
  const envelope = payload as Record<string, unknown>
  if (envelope.ok !== true || typeof envelope.schema !== 'string' || envelope.query !== 'findRelations') return []
  const data = envelope.data
  if (!data || typeof data !== 'object') return []
  const result = data as Record<string, unknown>
  if (result.id !== requestedId) return []
  const all = [...(Array.isArray(result.incoming) ? result.incoming : []), ...(Array.isArray(result.outgoing) ? result.outgoing : [])]
  const edges: AcademyKgEdge[] = []
  const seen = new Set<string>()
  for (const raw of all) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const from = item.from, to = item.to
    const relation = typeof item.relation === 'string' ? item.relation : item.type
    if (typeof from !== 'string' || typeof to !== 'string' || typeof relation !== 'string') continue
    if (from !== requestedId && to !== requestedId) continue
    if (![from, to, relation].every(s => s.length > 0 && s.length < 200)) continue
    const key = [from, to, relation].join('|')
    if (!seen.has(key)) { seen.add(key); edges.push({ from, to, relation, source: 'KG' }) }
  }
  return edges.slice(0, 50)
}
