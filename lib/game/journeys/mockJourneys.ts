import type { Journey } from './types'

export const mockJourneys: Journey[] = [
  {
    id: 'journey-water-ares-vallis',
    kgRef: 'KUE:JOURNEY:NOXIA:WATER:ARES_VALLIS',
    title: 'Wasser unter Ares Vallis',
    summary:
      'Die Kolonie entdeckt Hinweise auf unterirdisches Eis und entwickelt daraus eine stabile Wassergewinnung.',
    domain: 'science',
    steps: [
      {
        id: 'observe-ice-signature',
        title: 'Eissignatur beobachten',
        description: 'Sensoren melden ungewöhnliche Reflexionswerte im Regolith.',
        kind: 'observe',
      },
      {
        id: 'build-water-extractor',
        title: 'Wasserextraktor errichten',
        description: 'Baue einen Wasserextraktor in Reichweite der Fundstelle.',
        kind: 'build',
        requires: ['observe-ice-signature'],
      },
      {
        id: 'analyze-water-sample',
        title: 'Probe analysieren',
        description: 'Untersuche die erste gewonnene Probe im Forschungslabor.',
        kind: 'analyze',
        requires: ['build-water-extractor'],
      },
      {
        id: 'research-deep-drilling',
        title: 'Tiefenbohrung verstehen',
        description: 'Entwickle ein Modell für tieferliegende Reservoirs.',
        kind: 'research',
        requires: ['analyze-water-sample'],
      },
    ],
    rewards: [
      {
        kind: 'technology',
        id: 'tech-deep-water-extraction',
        label: 'Tiefenwassergewinnung',
      },
      {
        kind: 'insight',
        id: 'insight-subsurface-ice',
        label: 'Unterirdische Eisreservoirs',
      },
    ],
  },
  {
    id: 'journey-first-research-chain',
    kgRef: 'KUE:JOURNEY:NOXIA:RESEARCH:FIRST_CHAIN',
    title: 'Vom Fund zur Erkenntnis',
    summary:
      'Eine erste wissenschaftliche Kette zeigt, wie Beobachtung, Analyse und Forschung neue Möglichkeiten freischalten.',
    domain: 'science',
    steps: [
      {
        id: 'observe-mineral-pattern',
        title: 'Mineralmuster entdecken',
        description: 'Eine ungewöhnliche Kristallstruktur wird im Erzvorkommen registriert.',
        kind: 'observe',
      },
      {
        id: 'analyze-mineral-pattern',
        title: 'Struktur analysieren',
        description: 'Das Labor untersucht die Probe auf mechanische und elektrische Eigenschaften.',
        kind: 'analyze',
        requires: ['observe-mineral-pattern'],
      },
      {
        id: 'research-adaptive-materials',
        title: 'Adaptive Materialien erforschen',
        description: 'Die Kolonie leitet aus der Struktur ein neues Materialmodell ab.',
        kind: 'research',
        requires: ['analyze-mineral-pattern'],
      },
    ],
    rewards: [
      {
        kind: 'technology',
        id: 'tech-adaptive-materials',
        label: 'Adaptive Materialien',
      },
      {
        kind: 'insight',
        id: 'insight-crystal-lattice-anomaly',
        label: 'Kristallgitter-Anomalie',
      },
    ],
  },
]
