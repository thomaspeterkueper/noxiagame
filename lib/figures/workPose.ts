// lib/figures/workPose.ts
// Arbeit auf der Karte sichtbar machen (W-17 offen: Posen an Arbeitsorten, wie in Siedler).
// Wer vor seinem Arbeitsort steht, zeigt die Tätigkeit des Hauses – nur dort, wo sie
// draußen plausibel ist. Drinnen arbeitende Personen sind auf der Karte nicht zu sehen.

import type { KieselPose } from './kiesel'

/** Pose für einen Arbeitsort (Bautyp, z. B. `mine`, `warehouse`, Baustelle) oder null = einfach stehen. */
export function workPoseFor(workTypeId: string | null | undefined, onSite = false): KieselPose | null {
  if (onSite) return 'haemmern'
  const key = String(workTypeId ?? '').toLowerCase()
  if (!key) return null
  if (/mine|quarry|steinbruch/.test(key)) return 'hacken'
  if (/farm|garden|park|forest|forst|cemetery|friedhof/.test(key)) return 'schaufeln'
  if (/construct|bau|repair|workshop|werkstatt|factory|fabrik|metal|engineer/.test(key)) return 'haemmern'
  if (/warehouse|logistic|depot|lager|market|shop|store|laden/.test(key)) return 'tragen'
  if (/cafe|restaurant|bar|hotel|kitchen/.test(key)) return 'wischen'
  return null
}
