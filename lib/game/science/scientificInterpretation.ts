import { resourceMethod } from '@/lib/game/resourceScanning'
import type { ProspectingObservable } from '@/lib/game/resourceObservationPlanning'

export type ScientificInterpretationStatus = 'working' | 'alternative' | 'disfavored' | 'strongly_supported'

export type ScientificInterpretation = {
  id: string
  label: string
  status: ScientificInterpretationStatus
  support: 'low' | 'moderate' | 'high' | 'very_high'
  basis: string
  falsifier: string
}

export type ScientificInterpretationContext = {
  resourceType: string
  evidenceClass: 'modeled' | 'sampled' | 'direct' | 'engineering'
  finding?: string | null
}

const METAL_TYPES = new Set(['metal','iron_ore','copper_ore','nickel','cobalt','zinc','lead','titanium','zirconium','gold'])
const WATER_TYPES = new Set(['water','groundwater','ice'])

export function observablesForResource(resourceType: string): ProspectingObservable[] {
  if (METAL_TYPES.has(resourceType)) return ['density_contrast', 'magnetic_field_anomaly']
  if (WATER_TYPES.has(resourceType)) return ['spectral_reflectance', 'subsurface_structure']
  const method = resourceMethod(resourceType)
  if (method === 'density') return ['density_contrast', 'magnetic_field_anomaly']
  if (method === 'spectral') return ['spectral_reflectance']
  if (method === 'subsurface') return ['subsurface_structure']
  return ['regional_remote_sensing']
}

function supportByEvidence(evidenceClass: ScientificInterpretationContext['evidenceClass']) {
  if (evidenceClass === 'engineering') return { primary: 'very_high' as const, alternative: 'low' as const, artifact: 'low' as const, status: 'strongly_supported' as const }
  if (evidenceClass === 'direct') return { primary: 'high' as const, alternative: 'moderate' as const, artifact: 'low' as const, status: 'strongly_supported' as const }
  if (evidenceClass === 'sampled') return { primary: 'moderate' as const, alternative: 'moderate' as const, artifact: 'low' as const, status: 'working' as const }
  return { primary: 'moderate' as const, alternative: 'moderate' as const, artifact: 'moderate' as const, status: 'working' as const }
}

export function deriveScientificInterpretations(context: ScientificInterpretationContext): ScientificInterpretation[] {
  const support = supportByEvidence(context.evidenceClass)
  const findingBasis = context.finding ? `Bisheriger Befund: ${context.finding}` : 'Bisher nur indirekter bzw. modellierter Hinweis; keine eindeutige Stoffbestimmung.'

  if (WATER_TYPES.has(context.resourceType)) {
    return [
      {
        id: 'volatile-bearing-material',
        label: 'Flüchtigkeits- oder wasserführendes Material',
        status: support.status,
        support: support.primary,
        basis: findingBasis,
        falsifier: 'Direkte Probe oder Bohrkern zeigt weder gebundenes Wasser noch Eis-/Hydrat-Signatur.',
      },
      {
        id: 'hydrated-mineral-alternative',
        label: 'Hydratisierte Mineralphase ohne nutzbare Eislinse',
        status: 'alternative',
        support: support.alternative,
        basis: 'Spektrale oder strukturelle Hinweise können gebundenes Wasser anzeigen, ohne frei gewinnbares Eis zu belegen.',
        falsifier: 'Mineralogische Analyse trennt Hydratbindung eindeutig von der beobachteten Signatur.',
      },
      {
        id: 'structural-model-artifact',
        label: 'Strukturelle Anomalie oder Modellartefakt',
        status: context.evidenceClass === 'modeled' ? 'alternative' : 'disfavored',
        support: support.artifact,
        basis: 'Topographie, Regolithstruktur oder Modellannahmen können eine indirekte Signatur erzeugen.',
        falsifier: 'Unabhängige Messmethoden und direkte Proben reproduzieren denselben Befund.',
      },
    ]
  }

  if (METAL_TYPES.has(context.resourceType)) {
    return [
      {
        id: 'metal-enriched-zone',
        label: 'Metallangereicherte Regolith- oder Brekzienzone',
        status: support.status,
        support: support.primary,
        basis: findingBasis,
        falsifier: 'Direkte Probe oder Bohrkern zeigt keine gegenüber dem Hintergrund erhöhte Metallfraktion.',
      },
      {
        id: 'dense-impact-breccia',
        label: 'Dichte Impaktbrekzie ohne relevante Metallanreicherung',
        status: 'alternative',
        support: support.alternative,
        basis: 'Dichte- und magnetische Anomalien sind nicht eindeutig auf einen wirtschaftlich relevanten Metallgehalt zurückzuführen.',
        falsifier: 'Kompositionsanalyse weist eine konsistente Metallanreicherung über mehrere Proben nach.',
      },
      {
        id: 'block-or-model-artifact',
        label: 'Lokaler Block, Strukturkontrast oder Modellartefakt',
        status: context.evidenceClass === 'modeled' ? 'alternative' : 'disfavored',
        support: support.artifact,
        basis: 'Ein einzelner dichter Block oder die Modellauflösung kann ein prospektähnliches Signal erzeugen.',
        falsifier: 'Räumlich getrennte Messungen und Bohrkern-Evidenz zeigen eine zusammenhängende Zone.',
      },
    ]
  }

  return [
    {
      id: 'resource-enrichment',
      label: `Lokale Anreicherung: ${context.resourceType.replaceAll('_', ' ')}`,
      status: support.status,
      support: support.primary,
      basis: findingBasis,
      falsifier: 'Direkte Probenanalyse reproduziert die erwartete Materialsignatur nicht.',
    },
    {
      id: 'geologic-alternative',
      label: 'Alternative lithologische oder strukturelle Ursache',
      status: 'alternative',
      support: support.alternative,
      basis: 'Dasselbe indirekte Signal kann durch andere Material- oder Strukturkontraste entstehen.',
      falsifier: 'Unabhängige Messkanäle schließen die alternative Materialklasse aus.',
    },
    {
      id: 'model-artifact',
      label: 'Mess-/Modellartefakt',
      status: context.evidenceClass === 'modeled' ? 'alternative' : 'disfavored',
      support: support.artifact,
      basis: 'Ein modellierter oder einzelkanaliger Hinweis bleibt bis zur unabhängigen Replikation mehrdeutig.',
      falsifier: 'Mehrere unabhängige Beobachtungen und direkte Evidenz stimmen überein.',
    },
  ]
}
