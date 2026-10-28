// lib/worldlab/landUse.ts
// Was man auf einem Flurstück tun kann – aus seiner realen Nutzung im Kataster
// (NOXIA-MAT-0001, Thomas 28.10.2026: Rohstoffe kommen aus dem Land, das man besitzt).
// Die Mengen sind vorläufige Größenordnungen (Request an den Knowledge Graph:
// coordination/open/20261028-0042-core-to-kg-material-parameters.md).

export type LandUseKind = 'forest' | 'farmland' | 'grassland' | 'quarry' | 'building' | 'garden' | 'water' | 'traffic' | 'public' | 'other'

export interface LandUse {
  kind: LandUseKind
  /** Anzeigename, z. B. „Wald (Nadelholz)“ */
  label: string
  /** Was das Flurstück hergibt (geschätzt) und was man darauf tun kann */
  potential: string[]
  /** Bewirtschaftung, die mit NOXIA-MAT-0001 kommt (Holzeinschlag, Feldbau, Weide, Abbau) */
  activity: string | null
}

/** Vorläufige Werte (NOXIA-MAT-0001) */
export const FOREST_STOCK_M3_PER_HA = { conifer: 350, broadleaf: 280, mixed: 320 }
export const FOREST_GROWTH_M3_PER_HA_YEAR = 10
export const WHEAT_T_PER_HA = 7.5
export const CATTLE_PER_HA = 2

const fmt = (value: number) => Math.round(value).toLocaleString('de-DE')

/** Nutzung (Art, Bezeichnung) → Art der Bewirtschaftung. */
export function landUseKind(usage: string | null | undefined, detail?: string | null): LandUseKind {
  const art = String(usage ?? '').toLowerCase(), bez = String(detail ?? '').toLowerCase()
  if (!art) return 'other'
  if (/wald|gehölz/.test(art)) return 'forest'
  if (/tagebau|grube|steinbruch|abbau/.test(art + ' ' + bez)) return 'quarry'
  if (/landwirtschaft|acker|grünland|wiese|weide/.test(art)) {
    if (/grünland|wiese|weide/.test(bez + ' ' + art)) return 'grassland'
    if (/acker/.test(bez + ' ' + art)) return 'farmland'
    return 'farmland'
  }
  if (/gewässer|fluss|see|bach|hafenbecken/.test(art)) return 'water'
  if (/straße|strasse|weg|platz|bahn|verkehr|flug|schiff/.test(art)) return 'traffic'
  if (/friedhof|besonderer funktionaler|öffentlich/.test(art)) return 'public'
  if (/wohnbau|gemischt|industrie|gewerbe|handel/.test(art)) return 'building'
  if (/sport|freizeit|erholung|grünanlage|park|garten/.test(art)) return 'garden'
  return 'other'
}

/** Nutzung und Möglichkeiten eines Flurstücks (Fläche in m²). */
export function landUse(usage: string | null | undefined, detail: string | null | undefined, areaM2: number): LandUse {
  const kind = landUseKind(usage, detail)
  const ha = Math.max(0, areaM2) / 10_000
  const label = usage ? usage + (detail && detail !== usage ? ` (${detail})` : '') : 'unbekannt'
  switch (kind) {
    case 'forest': {
      const type = /nadel/i.test(detail ?? '') ? 'conifer' : /laub/i.test(detail ?? '') ? 'broadleaf' : 'mixed'
      const stock = ha * FOREST_STOCK_M3_PER_HA[type], growth = ha * FOREST_GROWTH_M3_PER_HA_YEAR
      return { kind, label, potential: [`Holzvorrat ≈ ${fmt(stock)} m³`, `Zuwachs ≈ ${fmt(growth)} m³ im Jahr – so viel lässt sich dauerhaft schlagen`], activity: 'Holzeinschlag (nachhaltig oder Kahlschlag mit Aufforstung)' }
    }
    case 'farmland':
      return { kind, label, potential: [`Weizen ≈ ${fmt(ha * WHEAT_T_PER_HA)} t je Ernte (Juli–August)`], activity: 'Feldbau: säen, ernten, ins Lager' }
    case 'grassland':
      return { kind, label, potential: [`Weide für ≈ ${fmt(ha * CATTLE_PER_HA)} Rinder`, 'oder Heu als Futter'], activity: 'Weide und Tierhaltung' }
    case 'quarry':
      return { kind, label, potential: ['Gestein für Schotter, Mauerwerk und Beton'], activity: 'Gesteinsabbau (mit Abbaurecht)' }
    case 'building':
      return { kind, label, potential: ['Bauland'], activity: null }
    case 'garden':
      return { kind, label, potential: ['Grünfläche, Garten'], activity: null }
    case 'water':
      return { kind, label, potential: ['Gewässer'], activity: null }
    case 'traffic':
      return { kind, label, potential: ['Verkehrsfläche'], activity: null }
    case 'public':
      return { kind, label, potential: ['öffentliche Fläche'], activity: null }
    default:
      return { kind, label, potential: [], activity: null }
  }
}
