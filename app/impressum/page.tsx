/**
 * NOXIA · Impressum · 2026-07-10
 * Content: KG registry/legal/impressum-master.json
 */
import { fetchLegalContent } from '../../lib/legal';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum · noχ¹ᐃ',
};

export default async function ImpressumPage() {
  const content = await fetchLegalContent();
  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
            {content.status === 'draft_productive' && (
        <div className="mb-6 p-3 text-sm border border-yellow-400 bg-yellow-50 text-yellow-800">
          ⚠ Entwurf — nicht juristisch freigegeben.
        </div>
      )}
      <h1 className="text-3xl font-bold mb-6">Impressum</h1>
      <p className="font-semibold">{content.impressum.name}</p>
      <p>{content.impressum.address}</p>
      <p>E-Mail: <a href={`mailto:${content.impressum.email}`} className="underline">
        {content.impressum.email}
      </a></p>
      <p className="mt-6 text-sm text-gray-500">
        Verantwortlicher im Sinne des § 5 TMG und Art. 4 Nr. 7 DSGVO.
        Stand: {content.impressum.updated}
      </p>
    </main>
  );
}
