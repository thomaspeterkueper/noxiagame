/**
 * Syntactic regression guard for the SSF -> NOXIA unlock persistence boundary.
 *
 * Candidate IDs can be held in an Array or a Set. In either case they must
 * pass through NOXIA's prerequisite resolver before insertion. This guard is
 * intentionally narrow: it is not a runtime authorization proof.
 */
export function ssfUnlockCandidatesResolvedBeforePersistence(source) {
  const resolution = /const\s+resolved\s*=\s*resolveGrantableUnlocks\s*\(\s*(?:\[\s*\.\.\.\s*candidateIds\s*\]|candidateIds)\s*,\s*existingIds\s*\)/g
  const mappings = /const\s+toInsert\s*=\s*resolved\.grantable\.map\s*\(/g
  const writes = /\.from\(\s*['"]player_unlocks['"]\s*\)\s*\.\s*(?:insert|upsert)\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g
  const resolutions = [...source.matchAll(resolution)]
  const grants = [...source.matchAll(mappings)]
  const persisted = [...source.matchAll(writes)]
  return resolutions.length === 1 &&
    grants.length === 1 &&
    persisted.length === 1 &&
    persisted[0][1] === 'toInsert' &&
    resolutions[0].index < grants[0].index &&
    grants[0].index < persisted[0].index
}
