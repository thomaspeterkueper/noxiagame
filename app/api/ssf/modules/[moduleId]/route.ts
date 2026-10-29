// app/api/ssf/modules/[moduleId]/route.ts
// Aktualisiert: 29.10.2026 — Prüfung ohne Lösungen ausliefern; bewertet wird auf dem
//                              Server (app/api/game/knowledge, complete_module)
// Version:      1.1.0

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

  // Lösungen und Erklärungen bleiben auf dem Server, sonst stünde die Prüfung im Browser.
  return NextResponse.json({
    schema: 'NOXIA-SSF-MODULE-1.0',
    module: {
      ...module,
      assessment: module.assessment.map(q => ({ ...q, correctOption: -1, explanation: '' })),
    },
  })
}
