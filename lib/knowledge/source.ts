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
