/** Versioned read-only provenance contract for cross-repository research. */
export const ONTOGENESIS_LINKS = Object.freeze({
  contractVersion:"0.1.0",
  origin:"thomaspeterkueper/noxiagame",
  sources:Object.freeze({
    philosophy:Object.freeze({repository:"thomaspeterkueper/omnizedenz.org",task:"EXT-NOXIA-OMNI-20261106-001",authority:"symbol_semantics"}),
    linguistics:Object.freeze({repository:"thomaspeterkueper/mishkenaz.org",task:"EXT-NOXIA-MISH-20261106-001",authority:"language_canon"}),
  }),
  mode:"research_only",
  canonicalWriteback:false,
} as const);
export type ResearchLink = Readonly<{
  eventId:string; episodeIndex:number; symbol:string; mappingVersion:string;
  sourceRepository:string; sourceRevision:string; epistemicStatus:"hypothesis"|"observed"|"disputed";
}>;
/** Reject unverifiable or canon-changing links; do not pretend that GitHub revisions were checked. */
export function validateResearchLink(link:ResearchLink):boolean {
  const sources=Object.values(ONTOGENESIS_LINKS.sources).map(s=>s.repository);
  return !!link.eventId && Number.isSafeInteger(link.episodeIndex) && link.episodeIndex>=0 &&
    !!link.symbol && !!link.mappingVersion && sources.includes(link.sourceRepository) &&
    /^[a-f0-9]{40}$/.test(link.sourceRevision) &&
    ["hypothesis","observed","disputed"].includes(link.epistemicStatus);
}
