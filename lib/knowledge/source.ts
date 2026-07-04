// source.ts
// Aktualisiert: 04.07.2026 — Header ergänzt; KNOWLEDGE_SOURCE-Env-Switch
// Version:      0.1.0
export type KnowledgeSourceMode = 'local' | 'ssf';

export function getKnowledgeSourceMode(): KnowledgeSourceMode {
  const mode = process.env.KNOWLEDGE_SOURCE;
  return mode === 'ssf' ? 'ssf' : 'local';
}

export function getSolarScienceFoundationBaseUrl(): string {
  return process.env.SSF_API_BASE_URL ?? 'https://solarsciencefoundation.org';
}

export function isSsfKnowledgeSourceEnabled(): boolean {
  return getKnowledgeSourceMode() === 'ssf';
}
