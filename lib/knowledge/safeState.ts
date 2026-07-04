// safeState.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; Safe-State-Fallback
// Version:      0.1.0
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
