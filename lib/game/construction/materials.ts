// lib/game/construction/materials.ts
// Baustoffe und Stücklisten (NOXIA-MAT-0001, Thomas 28.10.2026: „richtiger Verbrauch,
// das ist auch für die Welt jenseits der Erde wichtig“; Request
// coordination/open/20261028-0040-core-to-core-construction-materials.md).
//
// Stufe 1 (dieser Stand): ortsunabhängiger Katalog, Stückliste je Bautyp und Aufteilung
// des heutigen Baupreises in Material (Zukauf) und Arbeit. Die Baustelle verbraucht noch
// nichts aus einem Lager; das folgt mit den Inventaren für die neuen Güter.
// Mengen je m² Geschossfläche und Preise sind vorläufig (Request 0042 an den Knowledge Graph).

export type MaterialId = 'beton' | 'ziegel' | 'schotter' | 'sand' | 'zement' | 'schnittholz' | 'rundholz' | 'stahl' | 'bruchstein' | 'regolith'

export interface Material {
  id: MaterialId
  /** Gut im Inventar (`resource_type`, Migration 20261106020000) */
  resource: string
  name: string
  unit: 't' | 'm³'
  /** Spielpreis je Einheit in Cr (vorläufig, relativ zueinander) */
  price: number
  /** Woraus es entsteht (Kette, NOXIA-MAT-0001) */
  from: string
}

export const MATERIALS: Readonly<Record<MaterialId, Material>> = {
  beton: { id: 'beton', resource: 'concrete', name: 'Beton', unit: 't', price: 3, from: 'Zement, Kies, Sand, Wasser' },
  ziegel: { id: 'ziegel', resource: 'bricks', name: 'Ziegel', unit: 't', price: 3, from: 'Lehm, Energie' },
  schotter: { id: 'schotter', resource: 'gravel', name: 'Schotter', unit: 't', price: 1, from: 'Bruchstein (Brecher)' },
  sand: { id: 'sand', resource: 'sand', name: 'Sand', unit: 't', price: 1, from: 'Sandgrube' },
  zement: { id: 'zement', resource: 'cement', name: 'Zement', unit: 't', price: 8, from: 'Kalkstein, viel Energie' },
  schnittholz: { id: 'schnittholz', resource: 'lumber', name: 'Schnittholz', unit: 'm³', price: 10, from: 'Rundholz (Sägewerk)' },
  rundholz: { id: 'rundholz', resource: 'roundwood', name: 'Rundholz', unit: 'm³', price: 5, from: 'Wald (Holzeinschlag)' },
  stahl: { id: 'stahl', resource: 'steel', name: 'Stahl', unit: 't', price: 25, from: 'Metall (Stahlwerk)' },
  bruchstein: { id: 'bruchstein', resource: 'stone', name: 'Bruchstein', unit: 't', price: 1, from: 'Steinbruch' },
  regolith: { id: 'regolith', resource: 'regolith', name: 'Regolith, gesintert', unit: 't', price: 4, from: 'Regolith, viel Energie' },
}

export type BuildForm = 'massiv' | 'halle' | 'holz' | 'habitat' | 'feld'

/** Material je m² Geschossfläche (Bodenplatte bei Feldern/Pads) */
const PER_M2: Record<BuildForm, Partial<Record<MaterialId, number>>> = {
  // Massivhaus: Beton/Ziegel ≈ 1 t, Dachstuhl ≈ 0,07 m³, Stahl ≈ 30 kg
  massiv: { beton: 0.6, ziegel: 0.4, schnittholz: 0.07, stahl: 0.03 },
  // Stahlhalle: Bodenplatte ≈ 0,5 t, Stahl ≈ 50 kg
  halle: { beton: 0.5, schotter: 0.1, stahl: 0.05 },
  holz: { beton: 0.3, schnittholz: 0.3, stahl: 0.01 },
  // Habitat außerhalb der Erde: Regolith gesintert, Stahl/Aluminium
  habitat: { regolith: 0.8, stahl: 0.06 },
  // Solarfeld, Landeplatz: Schotterbett und Gestelle
  feld: { schotter: 0.15, stahl: 0.01 },
}

/** Bauform eines Bautyps (am Ort). */
export function buildFormFor(typeId: string, location = 'earth'): BuildForm {
  const key = typeId.toLowerCase()
  if (location !== 'earth' && /habitat|cafe|bar|restaurant|hotel|bank|clinic|medical|lab|gallery|school|admin/.test(key)) return 'habitat'
  if (/solar|pad|field|feld/.test(key)) return 'feld'
  if (/warehouse|storage|lager|spaceport|mine|factory|fabrik|hall|depot|scanner/.test(key)) return 'halle'
  if (/cabin|hut|holz|resonance/.test(key)) return 'holz'
  return 'massiv'
}

export interface BillLine { material: MaterialId; amount: number }

/** Stückliste: Mengen auf ganze Einheiten (wie im Inventar), angefangene aufgerundet. */
export function billOfMaterials(typeId: string, footprintM2: number, levels = 1, location = 'earth'): BillLine[] {
  const form = buildFormFor(typeId, location)
  const area = Math.max(0, footprintM2) * Math.max(1, form === 'feld' ? 1 : levels)
  return (Object.entries(PER_M2[form]) as Array<[MaterialId, number]>)
    .map(([material, perM2]) => {
      const raw = perM2 * area
      return { material, amount: raw > 0 && raw < 1 ? 1 : Math.ceil(raw - 0.05) }
    })
    .filter(line => line.amount > 0)
}

export function materialValue(bill: readonly BillLine[]) {
  return bill.reduce((sum, line) => sum + line.amount * MATERIALS[line.material].price, 0)
}

/**
 * Heutiger Baupreis aufgeteilt in Material (Zukauf zum Spielpreis) und Arbeit.
 * Der Gesamtpreis bleibt gleich (Übergang, NOXIA-MAT-0001 Punkt 5); Material höchstens 80 %.
 */
export function costSplit(totalCost: number, bill: readonly BillLine[]) {
  const material = Math.min(Math.round(materialValue(bill)), Math.round(totalCost * 0.8))
  return { material, labor: Math.max(0, totalCost - material) }
}

const fmt = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/** „96 t Beton, 9 m³ Schnittholz, 4 t Stahl“ – die größten Posten zuerst. */
export function billText(bill: readonly BillLine[], max = 3) {
  return [...bill]
    .sort((a, b) => b.amount * MATERIALS[b.material].price - a.amount * MATERIALS[a.material].price)
    .slice(0, max)
    .map(line => `${fmt(line.amount)} ${MATERIALS[line.material].unit} ${MATERIALS[line.material].name}`)
    .join(', ')
}

/** Material zum Inventargut (z. B. „lumber“) – null, wenn unbekannt. */
export function materialForResource(resource: string): Material | null {
  return Object.values(MATERIALS).find(material => material.resource === resource) ?? null
}

/** Stückliste für die Datenbank (`take_construction_materials`). */
export function billForStock(bill: readonly BillLine[]) {
  return bill.map(line => ({ resource: MATERIALS[line.material].resource, amount: line.amount, price: MATERIALS[line.material].price }))
}

/** Forstwirtschaft und Holzhandel (vorläufig, NOXIA-MAT-0001) */
export const FORESTRY = {
  /** Ankaufspreis der Gemeinde je m³ Rundholz */
  roundwoodBuyPrice: 5,
  /** Lohnschnitt je m³ Rundholz (Ausbeute 60 % Schnittholz) */
  sawFeePerM3: 2,
  /** Aufforstung je ha (Pflanzgut, Arbeit) */
  replantFeePerHa: 40,
} as const
