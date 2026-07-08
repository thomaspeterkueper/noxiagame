// source.ts
// Aktualisiert: 08.07.2026 — SSF_BASE_URL als kanonische SSF-Basis-URL
// Version:      0.2.0

export type KnowledgeSourceMode = 'local' | 'ssf';

const DEFAULT_SSF_BASE_URL = 'https://solarsciencefoundation.vercel.app';

export function getKnowledgeSourceMode(): KnowledgeSourceMode {
  const mode = process.env.KNOWLEDGE_SOURCE;
  return mode === 'ssf' ? 'ssf' : 'local';
}

export function getSolarScienceFoundationBaseUrl(): string {
  // SSF_BASE_URL ist kanonisch. SSF_API_BASE_URL bleibt nur als
  // rückwärtskompatibler Alias erhalten und verwendet denselben Default.
  return process.env.SSF_BASE_URL ?? process.env.SSF_API_BASE_URL ?? DEFAULT_SSF_BASE_URL;
}

export function isSsfKnowledgeSourceEnabled(): boolean {
  return getKnowledgeSourceMode() === 'ssf';
}
