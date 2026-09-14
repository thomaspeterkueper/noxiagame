import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
const passes = [];

function check(label, condition, detail) {
  if (condition) passes.push(label);
  else failures.push(`${label}: ${detail}`);
}

function hasAll(content, tokens) {
  return tokens.every((token) => content.includes(token));
}

const service = read('lib/knowledge/service.ts');
const source = read('lib/knowledge/source.ts');
const safeState = read('lib/knowledge/safeState.ts');
const registry = read('lib/knowledge/unlockRegistry.ts');
const requirements = read('lib/knowledge/buildRequirements.ts');
const knowledgeRoute = read('app/api/game/knowledge/route.ts');
const buildRoute = read('app/api/game/build/route.ts');
const unlocks = read('lib/knowledge/unlocks.ts');
const finance = read('supabase/migrations/20260910090000_atomic_finance_asset_commands.sql');

check(
  'knowledge source modes remain explicit',
  hasAll(source, ["KnowledgeSourceMode = 'local' | 'ssf'", "return mode === 'ssf' ? 'ssf' : 'local'"]),
  'local and SSF source selection are no longer explicit',
);

check(
  'SSF outage fails closed',
  hasAll(service, ["source: 'ssf-unavailable'", 'completedModules: []', 'unlocked: []', 'buildings: []', 'return getUnavailableSsfKnowledgeState(userId)']),
  'remote failure can grant or inherit gameplay knowledge',
);

const catchStart = service.indexOf('} catch (error) {');
const catchEnd = catchStart >= 0 ? service.indexOf('\n    }\n', catchStart) : -1;
const catchBlock = catchStart >= 0 && catchEnd > catchStart ? service.slice(catchStart, catchEnd) : '';
check(
  'SSF failure never falls back to demo progression',
  catchBlock.length > 0 && !catchBlock.includes('getLocalKnowledgeState'),
  'remote catch path still invokes local/demo knowledge',
);

check(
  'local demo progression remains explicit-only',
  service.includes("if (getKnowledgeSourceMode() === 'ssf')") && service.includes('return getLocalKnowledgeState(userId);'),
  'local demo behavior was removed or made ambiguous',
);

check(
  'safe knowledge fallback is privilege-free',
  hasAll(safeState, ["source: 'fallback'", 'completedModules: []', 'unlocked: []']),
  'safe fallback grants modules or unlocks',
);

check(
  'NOXIA remains unlock semantic authority',
  hasAll(registry, ['NOXIA ist Source of Truth fuer Identitaet, Scope und Spielwirkung.', 'export const UNLOCK_REGISTRY', 'requiresUnlocks:', 'resolveGrantableUnlocks']),
  'unlock identity/prerequisite authority is no longer explicit in NOXIA',
);

check(
  'unlock prerequisite resolution remains fail-closed',
  hasAll(registry, ['getMissingUnlockPrerequisites(id, unlocked).length === 0', 'const blocked: BlockedUnlock[] = pending.map']),
  'candidate unlocks can bypass prerequisite resolution',
);

check(
  'build requirements use explicit persisted-style unlock IDs',
  hasAll(requirements, ['const REQUIRED_UNLOCK', 'progress.unlocked.includes(requiredUnlock as any)', "'BLD:NOX:mars-habitat-1': 'UNL:NOX:mars-habitat'"]),
  'build requirements no longer resolve against explicit unlock IDs',
);

check(
  'knowledge API authenticates before progression mutation',
  knowledgeRoute.indexOf('const user = await getUserFromRequest(req)') >= 0 && knowledgeRoute.indexOf("if (!user) return NextResponse.json({ error: 'Unauthorized' }") >= 0,
  'knowledge mutations may execute without authenticated user resolution',
);

check(
  'module completion separates completion points and unlock sync',
  hasAll(knowledgeRoute, [".from('academy_completions')", 'const alreadyCompleted = Boolean(existing)', 'if (!alreadyCompleted) {', "p_reason:     `module_complete:${moduleId}`", 'pointsAwarded = level']),
  'module completion no longer protects first-award semantics',
);

check(
  'SSF candidates are resolved by NOXIA before persistence',
  hasAll(knowledgeRoute, ['resolveGrantableUnlocks(candidateIds, existingIds)', ".from('player_unlocks')", 'const toInsert = resolved.grantable.map']),
  'upstream candidates can be persisted without NOXIA prerequisite resolution',
);

check(
  'SSF sync failure does not synthesize unlocks',
  knowledgeRoute.includes("console.error('[knowledge] SSF unlock check failed (non-fatal):'") && !knowledgeRoute.includes('getLocalKnowledgeState'),
  'unlock sync failure path appears to manufacture fallback entitlements',
);

check(
  'persisted feature unlocks are player-scoped',
  hasAll(unlocks, [".from('player_unlocks')", ".eq('profile_id', profileId)", ".select('unlock_id')"]),
  'player unlock reads are no longer scoped by profile',
);

const knowledgeGateAt = buildRoute.indexOf('const knowledge = await getNoxiaKnowledgeState(user.id)');
const requirementAt = buildRoute.indexOf('const gate = getBuildRequirements(buildableId');
const startCommandAt = buildRoute.indexOf('const result = await startBuildCommand');
check(
  'normal build authorization gates before atomic build start',
  knowledgeGateAt >= 0 && requirementAt > knowledgeGateAt && startCommandAt > requirementAt && buildRoute.includes("if (!gate.ok) return NextResponse.json({ error: `Wissen fehlt:"),
  'normal building start can precede the server-side knowledge gate',
);

check(
  'knowledge unlock does not bypass world and occupancy feasibility',
  hasAll(buildRoute, ['allowed_locations.includes(locationSlug)', "error: 'Kachel ist bereits bebaut.'", "error: 'Unzureichende Credits.'", 'startBuildCommand({']),
  'build path no longer keeps knowledge separate from physical/economic feasibility',
);

check(
  'database-critical bank credit rechecks academy completion',
  hasAll(finance, ["from public.academy_completions", "module_id = 'ECO-L0-000001'", 'NOXIA_BANK_CREDIT_CLEARANCE_REQUIRED:ECO-L0-000001']),
  'bank-credit command no longer rechecks its learning prerequisite in the database',
);

check(
  'knowledge points remain separate from player unlock persistence',
  knowledgeRoute.includes(".select('knowledge_points')") && knowledgeRoute.includes(".from('player_unlocks')") && knowledgeRoute.includes("award_knowledge"),
  'knowledge points and unlock persistence are no longer represented separately',
);

if (failures.length) {
  console.error('NOXIA Core research/knowledge/unlock invariant check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nIf this is an intentional architecture change, update docs/core/RESEARCH_KNOWLEDGE_UNLOCK_MAP.md and this guard together.');
  process.exit(1);
}

console.log(`NOXIA Core research/knowledge/unlock invariant check passed (${passes.length} checks).`);
for (const label of passes) console.log(`- ${label}`);
