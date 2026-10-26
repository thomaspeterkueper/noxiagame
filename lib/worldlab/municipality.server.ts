// lib/worldlab/municipality.server.ts
// Wer verkauft? Die Stadt oder Gemeinde, in der das Grundstück liegt – nicht der
// öffentliche Akteur der ganzen Erde (Thomas, 26.10.2026: „nicht tharsis hub als
// besitzer sondern stadt sundern“). Das Geld bucht weiter der öffentliche Akteur.
//
// Name aus dem Kataster („Sundern (Sauerl.)“) oder der Anschrift (addr:city);
// „Stadt“, wenn OSM den Ort als town/city führt, sonst „Gemeinde“.

import type { Supabase } from './buildingOffer.server'

/** „Sundern (Sauerl.)“ → „Sundern“, „Rostock, Hanse- und Universitätsstadt“ → „Rostock“ */
export function municipalityBaseName(name: string) {
  return name.replace(/\s*\(.*?\)\s*/g, ' ').split(',')[0].trim()
}

const cache = new Map<string, string>()

export async function municipalityLabel(supabase: Supabase, name: string | null | undefined): Promise<string | null> {
  const raw = String(name ?? '').trim()
  if (!raw) return null
  const base = municipalityBaseName(raw)
  if (!base) return null
  if (cache.has(base)) return cache.get(base)!
  let town = /stadt/i.test(raw)
  if (!town) {
    const { data } = await supabase.from('region_features').select('properties')
      .eq('feature_type', 'settlement').eq('properties->>name', base).limit(5)
    town = (data ?? []).some(row => /^(town|city)$/.test(String((row.properties as Record<string, unknown> | null)?.place ?? '')))
  }
  const label = `${town ? 'Stadt' : 'Gemeinde'} ${base}`
  cache.set(base, label)
  return label
}
