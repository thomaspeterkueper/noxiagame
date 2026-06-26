import { getNoxiaKnowledgeState } from './service';

export async function getSafeNoxiaKnowledgeState(userId: string) {
  try {
    const state = await getNoxiaKnowledgeState(userId);
    return {
      source: state.source ?? 'local',
      completedModules: state.completedModules ?? [],
      unlocked: state.unlocked ?? [],
    };
  } catch {
    return {
      source: 'fallback',
      completedModules: [],
      unlocked: [],
    };
  }
}
