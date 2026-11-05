// lib/worldlab/plantTags.ts
// Baumart und Waldart aus OpenStreetMap-Merkmalen (Schritt 2 der Pflanzen, 06.11.2026).
// Teil der Kachelerzeugung (TILE_FORMAT_FILES): Ändert sich die Zuordnung,
// müssen die Kacheln neu entstehen.
//
// Einzelbaum/Allee: `species`, `species:de`, `genus`, `taxon`, `leaf_type`.
// Wald: `leaf_type` (Laub-, Nadel-, Mischwald); Gebüsch und Heide als eigene Art Wald.

/** Gattung (lateinisch) → Art im Verzeichnis (plants.ts) */
const GENUS: Record<string, string> = {
  picea: 'fichte', pinus: 'kiefer', larix: 'laerche', fagus: 'buche', quercus: 'eiche', betula: 'birke',
  acer: 'ahorn', tilia: 'linde', aesculus: 'kastanie', salix: 'weide', alnus: 'erle', malus: 'apfel',
  populus: 'pappel', corylus: 'hasel', sambucus: 'holunder', ligustrum: 'liguster',
  platanus: 'platane', fraxinus: 'esche', carpinus: 'hainbuche', robinia: 'robinie',
}
/** Kirschen: Vogel- und Sauerkirsche; Schlehe, Pflaume und Lorbeerkirsche sind andere Prunus. */
const PRUNUS_CHERRY = /^prunus\s+(avium|cerasus|serrulata|padus)/

/** Deutsche Namen (species:de oder deutscher Eintrag in species) */
const GERMAN: Array<[RegExp, string]> = [
  [/rosskastanie/, 'kastanie'], [/fichte/, 'fichte'], [/kiefer|föhre/, 'kiefer'], [/lärche/, 'laerche'],
  [/hainbuche/, 'hainbuche'], [/buche/, 'buche'], [/eiche/, 'eiche'], [/birke/, 'birke'], [/ahorn/, 'ahorn'],
  [/linde/, 'linde'], [/weide/, 'weide'], [/erle/, 'erle'], [/kirsch/, 'kirsche'], [/apfel/, 'apfel'],
  [/pappel/, 'pappel'], [/platane/, 'platane'], [/esche/, 'esche'], [/robinie|akazie/, 'robinie'],
  [/hasel/, 'hasel'], [/holunder/, 'holunder'], [/liguster/, 'liguster'],
]

/**
 * Kurzzeichen der Baumart für die Kachel:
 * eine Art aus plants.ts; „~b“/„~n“, wenn nur Laub- oder Nadelbaum bekannt ist;
 * „laubbaum“/„nadelbaum“, wenn OSM eine Art nennt, die das Verzeichnis nicht kennt; sonst „“.
 */
export function osmTreeCode(properties: Record<string, unknown>): string {
  const text = (key: string) => typeof properties[key] === 'string' ? String(properties[key]).trim().toLowerCase() : ''
  const latin = text('species') || text('taxon'), german = text('species:de'), genus = text('genus')
  for (const name of [german, latin]) for (const [pattern, id] of GERMAN) if (name && pattern.test(name)) return id
  if (latin.startsWith('prunus')) return PRUNUS_CHERRY.test(latin) ? 'kirsche' : 'laubbaum'
  if (latin.startsWith('castanea')) return 'laubbaum'   // Esskastanie: nicht mit der Rosskastanie verwechseln
  const g = (genus || latin.split(/\s+/)[0] || '').replace(/[^a-z]/g, '')
  if (g === 'prunus') return 'laubbaum'
  if (GENUS[g]) return GENUS[g]
  const leaf = text('leaf_type')
  if (g) return leaf === 'needleleaved' ? 'nadelbaum' : 'laubbaum'
  if (leaf === 'broadleaved') return '~b'
  if (leaf === 'needleleaved') return '~n'
  return ''
}

/** Waldart: b Laubwald, n Nadelwald, m Mischwald, s Gebüsch/Heide; undefined unbekannt. */
export function forestLeaf(featureType: string, properties: Record<string, unknown>): 'b' | 'n' | 'm' | 's' | undefined {
  const natural = String(properties.natural ?? properties.visual_class ?? '')
  if (featureType === 'vegetation' && /^(scrub|heath)$/.test(natural)) return 's'
  const leaf = String(properties.leaf_type ?? '')
  if (leaf === 'broadleaved') return 'b'
  if (leaf === 'needleleaved') return 'n'
  if (leaf === 'mixed') return 'm'
  return undefined
}
