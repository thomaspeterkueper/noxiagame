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
  | 'held-by'
  | 'derived-from'

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


export const PHAISTOS_PROVENANCE: ProvenanceGraph = {
  id: 'prov:earth:phaistos',
  assertions: [
    {
      id: 'phaistos:site',
      layer: 'site',
      subjectId: 'earth-gr-phaistos',
      sourceRef: 'NOXIA:earth-landmarks',
      summary: 'Phaistos is the archaeological site anchor on Crete.',
      confidence: 'documented',
    },
    {
      id: 'phaistos:artifact:disc',
      layer: 'artifact',
      subjectId: 'artifact:phaistos-disc',
      sourceRef: 'Heraklion-Archaeological-Museum:Phaistos-Disc',
      summary: 'The Phaistos Disc is a real archaeological artifact associated with Phaistos and held by the Heraklion Archaeological Museum.',
      confidence: 'documented',
    },
    {
      id: 'phaistos:observation:signs',
      layer: 'observation',
      subjectId: 'artifact:phaistos-disc',
      sourceRef: 'Heraklion-Archaeological-Museum:Phaistos-Disc',
      summary: 'The artifact carries a spiral arrangement of impressed signs; the observation is distinct from any proposed decipherment.',
      confidence: 'documented',
    },
    {
      id: 'phaistos:dating:museum-context',
      layer: 'dating',
      subjectId: 'artifact:phaistos-disc',
      sourceRef: 'Heraklion-Archaeological-Museum:Phaistos-Disc',
      summary: 'Dating/context claims belong to a separate assertion layer and may be refined without changing artifact identity.',
      confidence: 'documented',
    },
    {
      id: 'phaistos:interpretation:decipherment',
      layer: 'interpretation',
      subjectId: 'artifact:phaistos-disc',
      sourceRef: 'NOXIA:interpretation-boundary',
      summary: 'Proposed readings or decipherments are interpretations and are not promoted to archaeological ground truth.',
      confidence: 'contested',
    },
    {
      id: 'phaistos:fiction:mishkenaz',
      layer: 'fiction-canon',
      subjectId: 'artifact:phaistos-disc',
      sourceRef: 'KUEPER:MISHKENAZ',
      summary: 'MISHKENAZ may construct a fictional conservation/linguistic history around the disc while remaining explicitly fiction canon.',
    },
    {
      id: 'phaistos:fiction:vladikavkaz-fragment',
      layer: 'fiction-canon',
      subjectId: 'artifact:mishkenaz-vladikavkaz-fragment',
      sourceRef: 'KUEPER:MISHKENAZ',
      summary: 'The Vladikavkaz fragment and its disappearance are MISHKENAZ canon, not a real archaeological claim.',
    },
  ],
  edges: [
    { from: 'phaistos:artifact:disc', to: 'phaistos:site', relation: 'recovered-from' },
    { from: 'phaistos:observation:signs', to: 'phaistos:artifact:disc', relation: 'observes' },
    { from: 'phaistos:dating:museum-context', to: 'phaistos:artifact:disc', relation: 'dates' },
    { from: 'phaistos:interpretation:decipherment', to: 'phaistos:observation:signs', relation: 'interprets' },
    { from: 'phaistos:fiction:mishkenaz', to: 'phaistos:artifact:disc', relation: 'fictionalizes' },
    { from: 'phaistos:fiction:vladikavkaz-fragment', to: 'phaistos:fiction:mishkenaz', relation: 'derived-from' },
  ],
}

export const SENCKENBERG_YIN_HUA_PROVENANCE: ProvenanceGraph = {
  id: 'prov:earth:senckenberg-yin-hua',
  assertions: [
    {
      id: 'senckenberg:site',
      layer: 'site',
      subjectId: 'earth-de-frankfurt-senckenberg',
      sourceRef: 'Senckenberg:official',
      summary: 'The Senckenberg institution/museum in Frankfurt is the real-world geographic and institutional anchor.',
      confidence: 'documented',
    },
    {
      id: 'yinhua:fiction:adar-collection',
      layer: 'fiction-canon',
      subjectId: 'fiction:YIN-HUA:Adar-collection',
      sourceRef: 'KUEPER:YIN-HUA',
      summary: 'The Adar collection is a fictional archive collection in the YIN HUA canon and is not asserted to be a real Senckenberg holding.',
    },
    {
      id: 'yinhua:fiction:bronze-key',
      layer: 'fiction-canon',
      subjectId: 'fiction:YIN-HUA:bronze-key',
      sourceRef: 'KUEPER:YIN-HUA',
      summary: 'The bronze key is a fictional artifact within the Adar-collection narrative.',
    },
    {
      id: 'yinhua:fiction:nameless-score',
      layer: 'fiction-canon',
      subjectId: 'fiction:YIN-HUA:nameless-score',
      sourceRef: 'KUEPER:YIN-HUA',
      summary: 'Die Namenlose Partitur is a fictional musical/documentary object in YIN HUA canon.',
    },
    {
      id: 'yinhua:fiction:archaeoacoustics',
      layer: 'interpretation',
      subjectId: 'fiction:YIN-HUA:nameless-score',
      sourceRef: 'KUEPER:YIN-HUA',
      summary: 'Archaeoacoustic conclusions inside the novel are character/research interpretations unless independently backed by real-world evidence.',
      confidence: 'provisional',
    },
  ],
  edges: [
    { from: 'yinhua:fiction:adar-collection', to: 'senckenberg:site', relation: 'fictionalizes' },
    { from: 'yinhua:fiction:bronze-key', to: 'yinhua:fiction:adar-collection', relation: 'held-by' },
    { from: 'yinhua:fiction:nameless-score', to: 'yinhua:fiction:adar-collection', relation: 'held-by' },
    { from: 'yinhua:fiction:archaeoacoustics', to: 'yinhua:fiction:nameless-score', relation: 'interprets' },
  ],
}
