/**
 * NOXIA · Nutzungsbedingungen · 2026-07-10
 * Content: KG registry/legal/terms.de.md
 */
import { fetchLegalContent } from '../../lib/legal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen · noχ¹ᐃ',
};

export default async function NutzungsbedingungenPage() {
  const content = await fetchLegalContent();
  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
            {content.status === 'draft_productive' && (
        <div className="mb-6 p-3 text-sm border border-yellow-400 bg-yellow-50 text-yellow-800">
          ⚠ Entwurf — nicht juristisch freigegeben.
        </div>
      )}
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: content.terms.replace(/\n/g, '<br />') }}
      />
    </main>
  );
}
