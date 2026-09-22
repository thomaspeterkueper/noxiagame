/**
 * KUEPER · NOXIA
 * Path: lib/legal.ts
 * Version: 1.0.0 · 2026-07-10
 * Source: REQ-KG-LEGAL-ACCESS-20260710
 */

const KG_RAW = 'https://raw.githubusercontent.com/thomaspeterkueper/kueper-knowledge-graph/main';

export interface ImpressumData {
  name: string;
  address: string;
  email: string;
  updated: string;
}

export interface LegalContent {
  impressum: ImpressumData;
  privacy: string;
  terms: string;
  status: 'draft_productive' | 'released';
}

function resolveTemplate(text: string, impressum: ImpressumData): string {
  return text
    .replace(/\{\{\s*impressum\.responsible\.name\s*\}\}/g, impressum.name)
    .replace(/\{\{\s*impressum\.responsible\.address\s*\}\}/g, impressum.address)
    .replace(/\{\{\s*impressum\.responsible\.email\s*\}\}/g, impressum.email)
    .replace(/\{\{\s*impressum\.updated\s*\}\}/g, impressum.updated);
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${KG_RAW}/${path}`, {});
  if (!response.ok) throw new Error(`Legal source ${path} returned HTTP ${response.status}`);
  return response.text();
}

async function fetchJson<T>(path: string): Promise<T> {
  const raw = await fetchText(path);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Legal source ${path} did not return valid JSON`);
  }
}

export async function fetchLegalContent(): Promise<LegalContent> {
  const [impressumRaw, privacyRaw, termsRaw] = await Promise.all([
    fetchJson<{ responsible?: Partial<ImpressumData>; updated?: string }>('registry/legal/impressum-master.json'),
    fetchText('registry/legal/datenschutz.de.md'),
    fetchText('registry/legal/terms.de.md'),
  ]);

  const impressum: ImpressumData = {
    name: impressumRaw.responsible?.name ?? '',
    address: impressumRaw.responsible?.address ?? '',
    email: impressumRaw.responsible?.email ?? '',
    updated: impressumRaw.updated ?? '2026-07-10',
  };

  return {
    impressum,
    privacy: resolveTemplate(privacyRaw, impressum),
    terms: resolveTemplate(termsRaw, impressum),
    status: 'draft_productive',
  };
}
