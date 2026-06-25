import { NextResponse } from 'next/server';
import { completeLearningModule, initialKnowledgeProgress, getUnlockedBuildings } from '@/lib/knowledge';

const demoCompletedModules = [
  'LRN:SSF:MAT-1001',
  'LRN:SSF:MAT-1002',
  'LRN:SSF:PHY-1201',
  'LRN:SSF:PHY-1101',
] as const;

export async function GET() {
  const progress = demoCompletedModules.reduce(
    (currentProgress, moduleId) => completeLearningModule(currentProgress, moduleId),
    initialKnowledgeProgress,
  );

  return NextResponse.json({
    source: 'noxia-local-demo',
    intendedSource: 'solarsciencefoundation.org',
    userId: 'demo',
    completedModules: progress.completedModules,
    unlocks: progress.unlocked,
    buildings: getUnlockedBuildings(progress).map((building) => building.id),
  });
}
