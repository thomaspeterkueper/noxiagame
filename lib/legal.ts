/**
 * KUEPER · NOXIA
 * Path: lib/legal.ts
 * Version: 1.1.0 · 2026-09-22
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

type ImpressumRegistry = {
  responsible?: Partial<Pick<ImpressumData, 'name' | 'address' | 'email'>>;
  updated?: string;
};

const FALLBACK_IMPRESSUM: ImpressumData = {
  name: 'Thomas Peter Küper',
  address: 'Mörfelder Landstraße 103, 60598 Frankfurt am Main, Deutschland',
  email: 't.kueper@camaleo.de',
  updated: '2026-07-19',
};

function resolveTemplate(text: string, impressum: ImpressumData): string {
  return text
    .replace(/\{\{\s*impressum\.responsible\.name\s*\}\}/g, impressum.name)
    .replace(/\{\{\s*impressum\.responsible\.address\s*\}\}/g, impressum.address)
    .replace(/\{\{\s*impressum\.responsible\.email\s*\}\}/g, impressum.email)
    .replace(/\{\{\s*impressum\.updated\s*\}\}/g, impressum.updated);
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchImpressum(): Promise<ImpressumData> {
  const raw = await fetchText(`${KG_RAW}/registry/legal/impressum-master.json`);
  if (!raw) return FALLBACK_IMPRESSUM;

  try {
    const parsed = JSON.parse(raw) as ImpressumRegistry;
    return {
      name: parsed.responsible?.name ?? FALLBACK_IMPRESSUM.name,
      address: parsed.responsible?.address ?? FALLBACK_IMPRESSUM.address,
      email: parsed.responsible?.email ?? FALLBACK_IMPRESSUM.email,
      updated: parsed.updated ?? FALLBACK_IMPRESSUM.updated,
    };
  } catch {
    return FALLBACK_IMPRESSUM;
  }
}

export async function fetchLegalContent(): Promise<LegalContent> {
  const [impressum, privacyRaw, termsRaw] = await Promise.all([
    fetchImpressum(),
    fetchText(`${KG_RAW}/registry/legal/datenschutz.de.md`),
    fetchText(`${KG_RAW}/registry/legal/terms.de.md`),
  ]);

  const unavailable = 'Rechtlicher Inhalt konnte aus der kanonischen Quelle vorübergehend nicht geladen werden.';

  return {
    impressum,
    privacy: resolveTemplate(privacyRaw ?? unavailable, impressum),
    terms: resolveTemplate(termsRaw ?? unavailable, impressum),
    status: 'draft_productive',
  };
}
