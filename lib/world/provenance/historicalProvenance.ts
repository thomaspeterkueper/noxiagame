/**
 * Source-side provenance for historical, archaeological and cross-universe claims.
 *
 * This does not replace NOXIA's Observation → Knowledge → Evidence → Hypothesis
 * pipeline. It describes what kind of object a source-side statement refers to,
 * so downstream evidence never collapses observation, dating, interpretation,
 * received tradition and fiction into one "fact".
 */
export type ProvenanceLayer =
  | 'site'
  | 'observation'
  | 'artifact'
  | 'dating'
  | 'interpretation'
  | 'received-tradition'
  | 'fiction-canon'

export type ProvenanceRelation =
  | 'located-at'
  | 'observes'
  | 'recovered-from'
  | 'dates'
  | 'interprets'
  | 'transmits'
  | 'inspires'
  | 'fictionalizes'

export type ProvenanceAssertion = {
  id: string
  layer: ProvenanceLayer
  subjectId: string
  sourceRef: string
  summary: string
  confidence?: 'documented' | 'provisional' | 'contested'
}

export type ProvenanceEdge = {
  from: string
  to: string
  relation: ProvenanceRelation
}

/**
 * A graph is intentionally not a truth chain. Multiple observations, datings and
 * interpretations may point at the same site/artifact and may contradict each other.
 */
export type ProvenanceGraph = {
  id: string
  assertions: readonly ProvenanceAssertion[]
  edges: readonly ProvenanceEdge[]
}

export function validateProvenanceGraph(graph: ProvenanceGraph): string[] {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const assertion of graph.assertions) {
    if (ids.has(assertion.id)) errors.push(`duplicate assertion id: ${assertion.id}`)
    ids.add(assertion.id)
  }

  for (const edge of graph.edges) {
    if (!ids.has(edge.from)) errors.push(`unknown edge.from: ${edge.from}`)
    if (!ids.has(edge.to)) errors.push(`unknown edge.to: ${edge.to}`)
  }

  return errors
}

export const DWARKA_PROVENANCE: ProvenanceGraph = {
  id: 'prov:earth:dwarka',
  assertions: [
    {
      id: 'dwarka:site:modern',
      layer: 'site',
      subjectId: 'earth-in-dwarka',
      sourceRef: 'NOXIA:earth-landmarks',
      summary: 'Present-day Dwarka is the geographic anchor.',
      confidence: 'documented',
    },
    {
      id: 'dwarka:observation:offshore',
      layer: 'observation',
      subjectId: 'earth-microregion-dwarka-coast:dwarka-offshore-archaeology',
      sourceRef: 'NIO:marine-archaeology-dwarka',
      summary: 'Marine archaeological observations off the Dwarka coast are evidence objects, not an identity claim for literary Dvārakā.',
      confidence: 'documented',
    },
    {
      id: 'dwarka:interpretation:historical-city',
      layer: 'interpretation',
      subjectId: 'earth-in-dwarka',
      sourceRef: 'NOXIA:interpretation-boundary',
      summary: 'Historical reconstruction from coastal and underwater evidence remains an interpretation and may be contested.',
      confidence: 'contested',
    },
    {
      id: 'dwarka:tradition',
      layer: 'received-tradition',
      subjectId: 'earth-in-dwarka',
      sourceRef: 'KUEPER:received-tradition',
      summary: 'Received traditions about Dvārakā are preserved as tradition rather than promoted to archaeological ground truth.',
    },
    {
      id: 'dwarka:fiction',
      layer: 'fiction-canon',
      subjectId: 'earth-in-dwarka',
      sourceRef: 'KUEPER:Dvaraka-Baumeister-Zyklus',
      summary: 'The novel setting may draw on sites, evidence and traditions without asserting historical identity.',
    },
  ],
  edges: [
    { from: 'dwarka:observation:offshore', to: 'dwarka:site:modern', relation: 'located-at' },
    { from: 'dwarka:interpretation:historical-city', to: 'dwarka:observation:offshore', relation: 'interprets' },
    { from: 'dwarka:tradition', to: 'dwarka:site:modern', relation: 'transmits' },
    { from: 'dwarka:fiction', to: 'dwarka:observation:offshore', relation: 'inspires' },
    { from: 'dwarka:fiction', to: 'dwarka:tradition', relation: 'fictionalizes' },
  ],
}
