// lib/worldlab/plants.ts
// Pflanzen der Erdkarte (Thomas, 05.11.2026: „Bäume, am besten mit echten Namen,
// Eiche, Buche, Weide, Kirsche, Birke usw., Büsche, Blumen“).
//
// Verzeichnis der Arten und ihr Aussehen im Jahreslauf. Die Spieluhr läuft nach
// echter Zeit; deshalb tragen die Bäume das Laub des echten Tages: im November
// kupferne Buchen und gelbe Birken, im Winter kahle Kronen, im April blühende Kirschen.
// Die Jahreszeiten sind für Mitteleuropa gerechnet (Tag im Jahr); auf der
// Südhalbkugel um ein halbes Jahr versetzt, in warmen Breiten immer belaubt.

export type PlantId =
  | 'fichte' | 'kiefer' | 'laerche' | 'buche' | 'eiche' | 'birke' | 'ahorn' | 'linde' | 'kastanie'
  | 'weide' | 'erle' | 'kirsche' | 'apfel' | 'pappel' | 'platane' | 'esche' | 'hainbuche' | 'robinie' | 'laubbaum' | 'nadelbaum'
  | 'hasel' | 'holunder' | 'liguster'

export type PlantForm = 'dome' | 'broad' | 'slender' | 'cone' | 'larch' | 'pine' | 'column' | 'weeping' | 'small' | 'bush' | 'hedge'

export interface PlantSpecies {
  id: PlantId
  name: string
  latin?: string
  form: PlantForm
  /** Typische Höhe ausgewachsen (m) */
  heightM: number
  /** Immergrün: keine Jahreszeiten im Laub */
  evergreen?: boolean
  /** Tag im Jahr: Austrieb, Beginn der Färbung, volle Färbung, Laubfall */
  leafOut: number; colorStart: number; colorPeak: number; leafFall: number
  summer: string
  autumn: string
  /** Anteil braunes Laub, das über Winter hängen bleibt (junge Buchen, Eichen) */
  keepBrown?: number
  bark: string
  blossom?: { from: number; to: number; color: string }
  fruit?: { from: number; to: number; color: string }
  /** Ein Satz über die Art, für die Tafel */
  note: string
}

const D = { leafOut: 115, colorStart: 280, colorPeak: 300, leafFall: 320 }

export const PLANTS: Record<PlantId, PlantSpecies> = {
  fichte:   { id: 'fichte', name: 'Fichte', latin: 'Picea abies', form: 'cone', heightM: 26, evergreen: true, ...D, summer: '#30563a', autumn: '#30563a', bark: '#5a4030', note: 'Häufigster Baum im Sauerland – viele Bestände sind seit 2018 dem Borkenkäfer zum Opfer gefallen.' },
  kiefer:   { id: 'kiefer', name: 'Waldkiefer', latin: 'Pinus sylvestris', form: 'pine', heightM: 22, evergreen: true, ...D, summer: '#3f6440', autumn: '#3f6440', bark: '#a8643a', note: 'Oben am Stamm orangerote Rinde, die Krone sitzt hoch wie ein Schirm.' },
  laerche:  { id: 'laerche', name: 'Europäische Lärche', latin: 'Larix decidua', form: 'larch', heightM: 24, leafOut: 105, colorStart: 285, colorPeak: 300, leafFall: 318, summer: '#6f9a4e', autumn: '#d9a53a', bark: '#6a4a34', note: 'Der einzige heimische Nadelbaum, der im Herbst golden wird und seine Nadeln abwirft.' },
  buche:    { id: 'buche', name: 'Rotbuche', latin: 'Fagus sylvatica', form: 'dome', heightM: 25, leafOut: 120, colorStart: 280, colorPeak: 300, leafFall: 322, summer: '#5f8f46', autumn: '#b8662e', keepBrown: 0.18, bark: '#8a8a82', note: 'Glatte, silbergraue Rinde; ohne den Menschen wäre Deutschland großenteils Buchenwald.' },
  eiche:    { id: 'eiche', name: 'Stieleiche', latin: 'Quercus robur', form: 'broad', heightM: 24, leafOut: 125, colorStart: 290, colorPeak: 310, leafFall: 332, summer: '#577f3e', autumn: '#a8782e', keepBrown: 0.25, bark: '#5c4632', note: 'Kann über 800 Jahre alt werden; ihre Eicheln fressen Eichelhäher, Wildschweine und Eichhörnchen.' },
  birke:    { id: 'birke', name: 'Hängebirke', latin: 'Betula pendula', form: 'slender', heightM: 20, leafOut: 105, colorStart: 265, colorPeak: 285, leafFall: 305, summer: '#7fa84e', autumn: '#e0b83a', bark: '#ecebe4', note: 'Wächst als eine der ersten auf freien Flächen, auch dort, wo Fichten abgestorben sind.' },
  ahorn:    { id: 'ahorn', name: 'Bergahorn', latin: 'Acer pseudoplatanus', form: 'dome', heightM: 25, leafOut: 110, colorStart: 275, colorPeak: 295, leafFall: 315, summer: '#5c8c44', autumn: '#e09a2a', bark: '#7d776c', note: 'Seine Früchte segeln als „Nasenzwicker“ mit zwei Flügeln davon.' },
  linde:    { id: 'linde', name: 'Winterlinde', latin: 'Tilia cordata', form: 'dome', heightM: 25, leafOut: 115, colorStart: 270, colorPeak: 290, leafFall: 310, summer: '#6a9447', autumn: '#d8b23e', bark: '#6b6157', note: 'Herzförmige Blätter, duftende Blüten im Juli; früher stand die Dorflinde in der Ortsmitte.' },
  kastanie: { id: 'kastanie', name: 'Rosskastanie', latin: 'Aesculus hippocastanum', form: 'dome', heightM: 22, leafOut: 100, colorStart: 255, colorPeak: 275, leafFall: 300, summer: '#4f8040', autumn: '#b7792f', bark: '#6a5848', blossom: { from: 125, to: 145, color: '#f6f1e6' }, note: 'Weiße Blütenkerzen im Mai, im Herbst glänzend braune Kastanien – nicht essbar.' },
  weide:    { id: 'weide', name: 'Silberweide', latin: 'Salix alba', form: 'weeping', heightM: 18, leafOut: 95, colorStart: 290, colorPeak: 310, leafFall: 330, summer: '#93ad6a', autumn: '#c9c056', bark: '#7a6c58', note: 'Steht gern am Wasser; aus ihrer Rinde wurde früher Salicylsäure gewonnen.' },
  erle:     { id: 'erle', name: 'Schwarzerle', latin: 'Alnus glutinosa', form: 'dome', heightM: 20, leafOut: 110, colorStart: 300, colorPeak: 315, leafFall: 332, summer: '#4d7a3c', autumn: '#6d7a3e', bark: '#4f463e', note: 'Wächst an Bächen; ihr Laub fällt fast grün ab.' },
  kirsche:  { id: 'kirsche', name: 'Vogelkirsche', latin: 'Prunus avium', form: 'small', heightM: 12, leafOut: 108, colorStart: 265, colorPeak: 285, leafFall: 305, summer: '#5f9046', autumn: '#d2552e', bark: '#6e4a3e', blossom: { from: 100, to: 120, color: '#f7f2f4' }, fruit: { from: 165, to: 185, color: '#8e1f2a' }, note: 'Blüht im April weiß, noch vor dem Austrieb; im Herbst färbt sie sich rot.' },
  apfel:    { id: 'apfel', name: 'Apfelbaum', latin: 'Malus domestica', form: 'small', heightM: 8, leafOut: 115, colorStart: 285, colorPeak: 300, leafFall: 320, summer: '#5f8f46', autumn: '#c9a23a', bark: '#6a5240', blossom: { from: 112, to: 135, color: '#f6dbe4' }, fruit: { from: 232, to: 290, color: '#c8352c' }, note: 'Auf Streuobstwiesen und in Gärten; Äpfel reifen von August bis Oktober.' },
  pappel:   { id: 'pappel', name: 'Pyramidenpappel', latin: "Populus nigra 'Italica'", form: 'column', heightM: 28, leafOut: 110, colorStart: 280, colorPeak: 295, leafFall: 310, summer: '#5f8c42', autumn: '#e6c93a', bark: '#6f675c', note: 'Schmal wie eine Säule; oft in Reihen an Wegen und Feldrändern gepflanzt.' },
  platane:  { id: 'platane', name: 'Ahornblättrige Platane', latin: 'Platanus × hispanica', form: 'dome', heightM: 28, leafOut: 120, colorStart: 285, colorPeak: 305, leafFall: 325, summer: '#5f8f46', autumn: '#b89a4a', bark: '#a9a48a', note: 'Rinde blättert in Platten ab und wird fleckig; ein häufiger Stadt- und Alleebaum.' },
  esche:    { id: 'esche', name: 'Gemeine Esche', latin: 'Fraxinus excelsior', form: 'dome', heightM: 30, leafOut: 130, colorStart: 285, colorPeak: 298, leafFall: 312, summer: '#6a9447', autumn: '#c9c26a', bark: '#7d786c', note: 'Treibt spät aus; viele Eschen sind am Eschentriebsterben erkrankt.' },
  hainbuche:{ id: 'hainbuche', name: 'Hainbuche', latin: 'Carpinus betulus', form: 'dome', heightM: 20, leafOut: 112, colorStart: 285, colorPeak: 300, leafFall: 322, summer: '#5f8f46', autumn: '#d0a540', keepBrown: 0.15, bark: '#8d8c84', note: 'Trotz des Namens keine Buche, sondern ein Birkengewächs; beliebt als Hecke.' },
  robinie:  { id: 'robinie', name: 'Robinie', latin: 'Robinia pseudoacacia', form: 'broad', heightM: 22, leafOut: 130, colorStart: 285, colorPeak: 300, leafFall: 315, summer: '#7fa356', autumn: '#d8c45a', bark: '#6a5a48', blossom: { from: 145, to: 160, color: '#f5f1e2' }, note: 'Aus Nordamerika eingeführt, duftende weiße Blütentrauben im Juni.' },
  laubbaum: { id: 'laubbaum', name: 'Laubbaum', form: 'dome', heightM: 18, ...D, summer: '#5c8c44', autumn: '#c08a36', bark: '#6a4a34', note: 'Art hier nicht bekannt.' },
  nadelbaum:{ id: 'nadelbaum', name: 'Nadelbaum', form: 'cone', heightM: 22, evergreen: true, ...D, summer: '#33593c', autumn: '#33593c', bark: '#5a4030', note: 'Art hier nicht bekannt.' },
  hasel:    { id: 'hasel', name: 'Haselstrauch', latin: 'Corylus avellana', form: 'bush', heightM: 4, leafOut: 100, colorStart: 280, colorPeak: 295, leafFall: 315, summer: '#6a9447', autumn: '#d2b043', bark: '#6a5240', note: 'Blüht schon im Februar mit gelben Kätzchen; Haselnüsse reifen im September.' },
  holunder: { id: 'holunder', name: 'Schwarzer Holunder', latin: 'Sambucus nigra', form: 'bush', heightM: 5, leafOut: 95, colorStart: 275, colorPeak: 295, leafFall: 315, summer: '#5f8c42', autumn: '#a7963e', bark: '#7a6a58', blossom: { from: 145, to: 165, color: '#f3ecd2' }, fruit: { from: 230, to: 262, color: '#2a1d2c' }, note: 'Cremeweiße Dolden im Juni, schwarze Beeren im Spätsommer – roh nicht essen.' },
  liguster: { id: 'liguster', name: 'Ligusterhecke', latin: 'Ligustrum vulgare', form: 'hedge', heightM: 2, leafOut: 100, colorStart: 330, colorPeak: 345, leafFall: 365, keepBrown: 0, summer: '#476f3a', autumn: '#4f6f3c', bark: '#5a4a3a', note: 'Klassische Gartenhecke; behält ihr Laub bis weit in den Winter.' },
}

export type PlantRegion = 'central' | 'warm' | 'other'

/** Welche Artenliste passt: Mitteleuropa, warme Breiten oder sonst (dann nur „Laub-“ und „Nadelbaum“). */
export function plantRegion(lat: number, lon: number): PlantRegion {
  if (Math.abs(lat) < 36) return 'warm'
  if (lat >= 43 && lat <= 62 && lon >= -11 && lon <= 32) return 'central'
  return 'other'
}

export interface Foliage {
  /** Dichte des Laubs 0 (kahl) … 1 */
  leaf: number
  /** Farbe des Laubs */
  color: string
  blossom?: string
  fruit?: string
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  const k = Math.max(0, Math.min(1, t))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('')
}

/** Tag im Jahr (1 … 366) in UTC; auf der Südhalbkugel um ein halbes Jahr versetzt. */
export function plantDay(utcMs: number, lat: number): number {
  const date = new Date(utcMs)
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const day = Math.floor((utcMs - start) / 86_400_000) + 1
  return lat < 0 ? ((day + 182 - 1) % 365) + 1 : day
}

/** Laub einer Art an einem Tag. */
export function foliage(species: PlantSpecies, day: number, region: PlantRegion = 'central'): Foliage {
  const out: Foliage = { leaf: 1, color: species.summer }
  if (species.blossom && day >= species.blossom.from && day <= species.blossom.to && region !== 'warm') out.blossom = species.blossom.color
  if (species.fruit && day >= species.fruit.from && day <= species.fruit.to && region !== 'warm') out.fruit = species.fruit.color
  if (species.evergreen || region === 'warm') return out
  const { leafOut, colorStart, colorPeak, leafFall } = species
  const brown = '#8a6034', keep = species.keepBrown ?? 0
  const young = mixHex(species.summer, '#b8d870', 0.45)
  if (day < leafOut - 14 || day > leafFall) return { ...out, leaf: keep, color: keep ? brown : species.summer }
  if (day < leafOut) {
    const t = (day - (leafOut - 14)) / 14
    return { ...out, leaf: Math.max(keep, 0.15 + 0.6 * t), color: young }
  }
  if (day < leafOut + 20) return { ...out, color: mixHex(young, species.summer, (day - leafOut) / 20) }
  if (day < colorStart) return out
  if (day < colorPeak) return { ...out, color: mixHex(species.summer, species.autumn, (day - colorStart) / (colorPeak - colorStart)) }
  // Nach der vollen Färbung fällt das Laub; was hängen bleibt, wird braun.
  const t = (day - colorPeak) / Math.max(1, leafFall - colorPeak)
  return { ...out, leaf: Math.max(keep, 1 - t * 0.85), color: mixHex(species.autumn, keep ? brown : species.autumn, t * 0.6) }
}

/** Ein Satz zum Aussehen heute, z. B. „Laub färbt sich“. */
export function foliageText(species: PlantSpecies, day: number, region: PlantRegion = 'central'): string {
  const f = foliage(species, day, region)
  if (f.blossom) return 'blüht gerade'
  if (f.fruit) return species.id === 'apfel' ? 'trägt Äpfel' : species.id === 'kirsche' ? 'trägt Kirschen' : 'trägt Früchte'
  if (species.evergreen || region === 'warm') return 'immergrün'
  if (day > species.leafFall || day < species.leafOut - 14) return (species.keepBrown ?? 0) > 0 ? 'kahl, ein paar braune Blätter hängen noch' : 'kahl, im Winterzustand'
  if (day < species.leafOut + 20) return 'treibt frisch aus'
  if (day < species.colorStart) return 'voll belaubt'
  if (day < species.colorPeak) return 'Laub färbt sich'
  return f.leaf > 0.5 ? 'in voller Herbstfarbe' : 'verliert das Laub'
}
