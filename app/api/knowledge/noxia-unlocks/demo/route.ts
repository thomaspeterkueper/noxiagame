import { NextResponse } from 'next/server';
import { getNoxiaKnowledgeState } from '@/lib/knowledge';

export async function GET() {
  const state = await getNoxiaKnowledgeState('demo');

  return NextResponse.json({
    ...state,
    intendedSource: 'solarsciencefoundation.org',
  });
}
