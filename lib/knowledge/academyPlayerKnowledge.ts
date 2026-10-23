/** Player-specific projection over SSF modules and KG source references.
 * No competence or unlock is inferred from a reading/completion record.
 */
export type AcademyModule = {
  id: string
  legacyId?: string | null
  pathId?: string | null
  title?: string
  domain?: string
  sourceEntityIds?: string[]
}
export type AcademyKnowledgeItem = {
  id: string
  title: string
  domain: string
  completed: boolean
  sourceEntityIds: string[]
  status: 'available' | 'completed'
}
export function projectPlayerKnowledge(modules: AcademyModule[], completionIds: string[]): AcademyKnowledgeItem[] {
  const completed = new Set(completionIds.filter((s): s is string => typeof s === 'string'))
  const seen = new Set<string>()
  return modules.filter(m => typeof m.id === 'string' && m.id.length > 0).flatMap(m => {
    if (seen.has(m.id)) return []
    seen.add(m.id)
    const done = completed.has(m.id) || (!!m.legacyId && completed.has(m.legacyId))
    return [{
      id: m.id,
      title: m.title || m.id,
      domain: m.domain || 'Weitere Themen',
      completed: done,
      status: done ? 'completed' as const : 'available' as const,
      sourceEntityIds: Array.isArray(m.sourceEntityIds)
        ? [...new Set(m.sourceEntityIds.filter((s): s is string => typeof s === 'string' && s.trim().length > 0))]
        : [],
    }]
  })
}
