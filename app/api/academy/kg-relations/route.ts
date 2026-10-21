import { NextRequest, NextResponse } from 'next/server'
import { fetchSsfKnowledgeModules } from '@/lib/ssfKnowledge'
import { normalizeKgRelations } from '@/lib/knowledge/academyKgRelations'

export async function GET(request: NextRequest) {
  const moduleId = request.nextUrl.searchParams.get('moduleId')
  if (!moduleId || moduleId.length > 150) return NextResponse.json({ edges: [], status: 'invalid_module' }, { status: 400 })
  const base = process.env.KG_BASE_URL
  if (!base) return NextResponse.json({ edges: [], status: 'not_configured' })
  let url: URL
  try {
    url = new URL(base)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe KG URL')
  } catch {
    return NextResponse.json({ edges: [], status: 'invalid_configuration' }, { status: 503 })
  }
  const modules = await fetchSsfKnowledgeModules()
  const module = modules.find(m => m.id === moduleId || m.legacyId === moduleId)
  if (!module) return NextResponse.json({ edges: [], status: 'module_unavailable' })
  const ids = [...new Set(module.sourceEntityIds)].filter(id => typeof id === 'string' && id.length > 0 && id.length < 150).slice(0, 5)
  const edges = []
  for (const id of ids) {
    try {
      const endpoint = new URL(url.toString())
      endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + '/api/query/relations/' + encodeURIComponent(id)
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(3500), next: { revalidate: 300 } })
      if (response.ok) edges.push(...normalizeKgRelations(await response.json(), id))
    } catch { /* KG connection failure never blocks Academy */ }
  }
  return NextResponse.json({ edges: edges.slice(0, 50), status: edges.length ? 'ready' : 'no_verified_relations' })
}
