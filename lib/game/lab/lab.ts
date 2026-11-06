/**
 * Labor-Kern (Thomas, 06.11.2026: „Labor … gerade wenn wir an Stationen außerhalb der Erde denken ist wichtig:
 * Analysen, Lernen, Experimentieren“). Ein Labor kann etwas, wenn sein Raum die Fähigkeit hat (Innenraum-Vorlage
 * `laboratory-standard-01`: research.sample.register, .basic-analysis, research.geoscience, research.spectroscopy.raman-ir)
 * und der Spieler dafür gelernt hat (Freischaltung, `lib/knowledge`: Lernen erlaubt einen Versuch, es behauptet nie einen Befund).
 * Rein und ohne Oberfläche, damit Grabung, Erdlabor und Stationslabors dieselbe Schleife nutzen:
 *   Probe nehmen → Analyse wählen → Befund (Messung) → Deutung → ggf. an ein besseres Labor schicken.
 */
export type LabCapability = 'research.sample.register' | 'research.sample.basic-analysis' | 'research.geoscience' | 'research.spectroscopy.raman-ir'

export interface LabAnalysis {
  id: string
  label: string
  capability: LabCapability
  /** Freischaltung, die der Spieler braucht (UNL:…); ohne Angabe genügt die Fähigkeit des Labors */
  requiresUnlock?: string
}

export const ANALYSES: Record<string, LabAnalysis> = {
  basic: { id: 'basic', label: 'Basisanalyse', capability: 'research.sample.basic-analysis' },
  geo: { id: 'geo', label: 'Geowissenschaftliche Analyse', capability: 'research.geoscience' },
  raman: { id: 'raman', label: 'Raman-/IR-Spektroskopie', capability: 'research.spectroscopy.raman-ir' },
}

/** Feldlabor (Grabung, Außenposten): Probe aufnehmen, Basis und Geo. Spektroskopie nur im Stationslabor. */
export const FIELD_LAB: readonly LabCapability[] = ['research.sample.register', 'research.sample.basic-analysis', 'research.geoscience']
/** Standardlabor (Vorlage laboratory-standard-01). */
export const STANDARD_LAB: readonly LabCapability[] = [...FIELD_LAB, 'research.spectroscopy.raman-ir']

export type AnalysisStatus = 'ready' | 'needs-lab' | 'needs-learning'

export function analysisStatus(analysis: LabAnalysis, capabilities: readonly LabCapability[], unlocked: readonly string[]): AnalysisStatus {
  if (!capabilities.includes(analysis.capability)) return 'needs-lab'
  if (analysis.requiresUnlock && !unlocked.includes(analysis.requiresUnlock)) return 'needs-learning'
  return 'ready'
}

/** Befund: was gemessen wurde (Messung) getrennt von dem, was die Grabung daraus schließt (Deutung). */
export interface Finding { analysisId: string; measurement: string; interpretation?: string }

export interface LabSample { id: string; label: string; source: string; findings: Finding[] }

export function runAnalysis(sample: LabSample, analysisId: string, capabilities: readonly LabCapability[], unlocked: readonly string[]): { ok: true; finding: Finding } | { ok: false; reason: AnalysisStatus | 'no-result' } {
  const analysis = ANALYSES[analysisId]
  if (!analysis) return { ok: false, reason: 'no-result' }
  const status = analysisStatus(analysis, capabilities, unlocked)
  if (status !== 'ready') return { ok: false, reason: status }
  const finding = sample.findings.find(f => f.analysisId === analysisId)
  return finding ? { ok: true, finding } : { ok: false, reason: 'no-result' }
}
