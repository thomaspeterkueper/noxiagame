// lib/worldlab/buildingUse.ts
// Heutige Nutzung eines realen Gebäudes aus OSM (W-4, Thomas 25.10.2026):
// Wohnhaus, Laden, Bar „Metropol“ … für die Gebäudetafel der Weltkarte.
//
// In den Kacheldaten steht eine kurze Kennung (`u` am Block), damit die Kachel
// klein bleibt: Präfix + OSM-Wert, z. B. „a:bar“ (amenity), „s:bakery“ (shop),
// „t:hotel“ (tourism), „o:insurance“ (office), „c:carpenter“ (craft),
// „b:apartments“ (building). Die Bezeichnung entsteht erst in der Tafel.

import { landmarkLabel } from './landmarks'
import type { BlockKind } from './simplify'

/** Bezeichnungen für `building=*` (nur, was eine Nutzung verrät; „yes“ sagt nichts). */
const BUILDING_LABEL: Record<string, string> = {
  house: 'Wohnhaus', detached: 'Wohnhaus', residential: 'Wohnhaus', bungalow: 'Wohnhaus', semidetached_house: 'Doppelhaushälfte',
  terrace: 'Reihenhaus', apartments: 'Mehrfamilienhaus', dormitory: 'Wohnheim', farm: 'Bauernhaus', cabin: 'Hütte', houseboat: 'Hausboot',
  retail: 'Laden', commercial: 'Geschäftshaus', office: 'Bürogebäude', kiosk: 'Kiosk', supermarket: 'Supermarkt', hotel: 'Hotel',
  industrial: 'Industriebau', manufacture: 'Fabrik', factory: 'Fabrik', warehouse: 'Lager', hangar: 'Halle', service: 'Technikgebäude',
  garage: 'Garage', garages: 'Garagen', carport: 'Carport', parking: 'Parkhaus', shed: 'Schuppen', hut: 'Hütte', barn: 'Scheune',
  farm_auxiliary: 'Nebengebäude (Hof)', greenhouse: 'Gewächshaus', stable: 'Stall', cowshed: 'Stall', sty: 'Stall', riding_hall: 'Reithalle',
  church: 'Kirche', chapel: 'Kapelle', cathedral: 'Dom', mosque: 'Moschee', synagogue: 'Synagoge', temple: 'Tempel', monastery: 'Kloster',
  school: 'Schule', kindergarten: 'Kindergarten', university: 'Universität', college: 'Hochschule', hospital: 'Krankenhaus',
  public: 'öffentliches Gebäude', civic: 'öffentliches Gebäude', government: 'Amt', townhall: 'Rathaus', fire_station: 'Feuerwache',
  train_station: 'Bahnhof', transportation: 'Verkehrsgebäude', sports_hall: 'Sporthalle', sports_centre: 'Sportzentrum', stadium: 'Stadion',
  grandstand: 'Tribüne', pavilion: 'Pavillon', toilets: 'Toiletten', bunker: 'Bunker', castle: 'Burg / Schloss', ruins: 'Ruine',
}

const OFFICE_LABEL: Record<string, string> = {
  insurance: 'Versicherung', lawyer: 'Kanzlei', notary: 'Notar', tax_advisor: 'Steuerberater', estate_agent: 'Makler', architect: 'Architekt',
  company: 'Firma', government: 'Amt', it: 'IT-Firma', association: 'Verein',
}
const CRAFT_LABEL: Record<string, string> = {
  carpenter: 'Tischlerei', electrician: 'Elektriker', plumber: 'Installateur', painter: 'Maler', roofer: 'Dachdecker', metal_construction: 'Metallbau',
  brewery: 'Brauerei', winery: 'Weingut', confectionery: 'Konditorei', tailor: 'Schneiderei', shoemaker: 'Schuhmacher', photographer: 'Fotograf',
}

/** Tags, die eine Nutzung des ganzen Hauses angeben – vor `building=*`. */
const USE_KEYS: Array<[string, string]> = [['amenity', 'a'], ['shop', 's'], ['tourism', 't'], ['office', 'o'], ['craft', 'c']]

/** Kurze Kennung der Nutzung aus den OSM-Angaben eines Gebäudes – oder undefined. */
export function buildingUseCode(properties: Record<string, unknown>): string | undefined {
  for (const [key, prefix] of USE_KEYS) {
    const value = properties[key]
    if (typeof value === 'string' && /^[a-z_]{2,30}$/.test(value.trim()) && value !== 'yes') return `${prefix}:${value.trim()}`
  }
  const building = String(properties.building ?? properties.visual_class ?? '').trim().toLowerCase()
  return BUILDING_LABEL[building] ? `b:${building}` : undefined
}

/** Lokale im Sinne von R-13: schon Café, Bar, Restaurant oder Hotel – nicht umbaubar. */
export function isVenueUse(code: string | undefined): boolean {
  return code === 'a:cafe' || code === 'a:bar' || code === 'a:pub' || code === 'a:restaurant' || code === 't:hotel' || code === 't:guest_house'
}

function labelFor(code: string): string | null {
  const [prefix, value = ''] = code.split(':')
  if (prefix === 'a') { const label = landmarkLabel(value); return label === 'Wahrzeichen' ? null : label }
  if (prefix === 's') return landmarkLabel('shop', { shop: value })
  if (prefix === 't') { const label = landmarkLabel(value); return label === 'Wahrzeichen' ? (value === 'apartment' ? 'Ferienwohnung' : null) : label }
  if (prefix === 'o') return OFFICE_LABEL[value] ?? 'Büro'
  if (prefix === 'c') return CRAFT_LABEL[value] ?? 'Handwerk'
  if (prefix === 'b') return BUILDING_LABEL[value] ?? null
  return null
}

export interface UseLine {
  /** Text für die Tafel, z. B. „Bar „Metropol““ oder „Wohnhaus“. */
  text: string
  /** false: OSM sagt nichts – die Zeile nennt nur die Bauform. */
  known: boolean
}

const SHAPE: Record<BlockKind, string> = { house: 'Wohnhaus', row: 'Mehrfamilienhaus', hall: 'Halle', factory: 'Fabrik', church: 'Kirche', shed: 'Schuppen' }

/**
 * Nutzungszeile der Gebäudetafel. Vorrang: Angabe am Gebäude selbst
 * (amenity/shop/…), dann ein Laden oder Lokal im Haus (OSM-Punkt), dann `building=*`.
 * Ohne Angabe nennt die Zeile die Bauform und sagt, dass sie geschätzt ist.
 */
export function buildingUseLine(input: { code?: string; name?: string; kind: BlockKind; poi?: { name: string; label: string } }): UseLine {
  const own = input.code && !input.code.startsWith('b:') ? labelFor(input.code) : null
  if (own) return { text: input.name ? `${own} „${input.name}“` : own, known: true }
  if (input.poi) return { text: `${input.poi.label} „${input.poi.name}“`, known: true }
  const building = input.code ? labelFor(input.code) : null
  if (building) return { text: building, known: true }
  return { text: `keine Angabe in OSM (Bauform: ${SHAPE[input.kind]})`, known: false }
}

/** „120 m² Grundfläche · 2 Geschosse“ */
export function buildingSizeLine(areaM2: number, levels: number): string {
  const area = Math.max(1, Math.round(areaM2))
  const floors = Math.max(1, Math.round(levels))
  return `${area.toLocaleString('de-DE')} m² Grundfläche · ${floors} ${floors === 1 ? 'Geschoss' : 'Geschosse'}`
}
