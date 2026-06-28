import { NextResponse } from 'next/server'
import { fetchSsfKnowledgeModules, getSsfBaseUrl } from '@/lib/ssfKnowledge'

export async function GET() {
  const modules = await fetchSsfKnowledgeModules()

  return NextResponse.json({
    schema: 'NOXIA-SSF-MODULES-0.1',
    source: getSsfBaseUrl(),
    modules
  })
}
