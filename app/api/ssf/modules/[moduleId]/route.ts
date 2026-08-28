import { NextRequest, NextResponse } from 'next/server'
import { fetchSsfKnowledgeModule } from '@/lib/ssfKnowledge'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ moduleId: string }> },
) {
  const { moduleId } = await context.params
  const module = await fetchSsfKnowledgeModule(decodeURIComponent(moduleId))

  if (!module) {
    return NextResponse.json({ error: 'module_not_found' }, { status: 404 })
  }

  return NextResponse.json({
    schema: 'NOXIA-SSF-MODULE-1.0',
    module,
  })
}
