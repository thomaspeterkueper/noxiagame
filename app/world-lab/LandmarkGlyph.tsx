// app/world-lab/LandmarkGlyph.tsx
// Ein schlichtes Zeichen je Art eines Wahrzeichens (wie in der begehbaren
// Erdszene; dort nicht exportiert, die Datei bleibt unverändert).

export default function LandmarkGlyph({ kind, tags, size = 54 }: { kind: string; tags?: Record<string, string>; size?: number }) {
  const ink = { fill: 'none', stroke: '#17313c', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  let d: string
  switch (kind) {
    case 'library': d = 'M-6 -4 Q-3 -6 0 -4 Q3 -6 6 -4 V5 Q3 3 0 5 Q-3 3 -6 5 Z M0 -4 V5'; break
    case 'place_of_worship': d = (tags?.religion ?? '') === 'christian' ? 'M0 -7 V-2 M-2 -5 H2 M-5 6 V0 L0 -3 L5 0 V6 Z M-1.5 6 V3 H1.5 V6' : 'M-5 6 V0 Q0 -8 5 0 V6 Z M-1.5 6 V3 H1.5 V6'; break
    case 'museum': case 'gallery': case 'townhall': case 'university': case 'theatre': case 'arts_centre': d = 'M-6 -2 L0 -6 L6 -2 Z M-4 -2 V4 M0 -2 V4 M4 -2 V4 M-6 5 H6'; break
    case 'castle': case 'fort': case 'city_gate': d = 'M-6 6 V-5 H-3.5 V-3 H-1.2 V-5 H1.2 V-3 H3.5 V-5 H6 V6 Z M-1.5 6 V2 Q0 0 1.5 2 V6'; break
    case 'ruins': case 'archaeological_site': d = 'M-6 6 V-1 L-4 -3 V6 M-1 6 V-5 H1 V6 M4 6 V1 L6 -1 V6 M-7 6 H7'; break
    case 'monument': case 'memorial': d = 'M0 -7 L2 -4 L1.2 4 H-1.2 L-2 -4 Z M-4 6 H4 M-3 4 H3'; break
    case 'tower': case 'lighthouse': case 'observatory': d = 'M-2 6 L-1.2 -3 H1.2 L2 6 Z M-2.5 -3 H2.5 M0 -3 V-7 M-5 -6 L-2.5 -5 M5 -6 L2.5 -5'; break
    case 'viewpoint': case 'attraction': d = 'M-7 5 L-2 -3 L1 1 L3 -1 L7 5 Z M3 -5 A1.4 1.4 0 1 0 3.01 -5'; break
    case 'hospital': d = 'M-5 -5 H5 V5 H-5 Z M0 -3 V3 M-3 0 H3'; break
    case 'station': d = 'M-4 -5 H4 Q5 -5 5 -4 V2 Q5 3 4 3 H-4 Q-5 3 -5 2 V-4 Q-5 -5 -4 -5 Z M-5 -1 H5 M-3 6 L-2 3 M3 6 L2 3'; break
    default: d = 'M0 -6 L1.8 -1.8 L6 -1.8 L2.6 1 L4 5.5 L0 2.8 L-4 5.5 L-2.6 1 L-6 -1.8 L-1.8 -1.8 Z'
  }
  return <svg viewBox="-14 -14 28 28" width={size} height={size} aria-hidden="true"><circle r="12" fill="#f4ecd2" stroke="#17313c" strokeWidth="1.2"/><path {...ink} d={d}/></svg>
}
