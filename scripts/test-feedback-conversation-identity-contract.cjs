/** Static cross-branch identity gate. No database access, no world writes.
 * Run after bringing PR #578's civic reader and PR #544's intake together.
 * A green result proves only that both routes use the same verified auth UUID,
 * NOT that the underlying DB column is a UUID referencing auth.users.
 */
'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const owner = read('lib/game/evolution/conversationSourceOwnership.server.ts')
const post = read('app/api/game/feedback/post.ts')
const civicPath = 'app/api/game/civic-signals/route.ts'
assert.match(owner, /\.eq\('player_profile_id', verifiedOwnerId\)/, 'ownership lookup must filter by verified auth identity')
assert.match(post, /verifiedBearerUserId\(req\)/, 'feedback must authenticate')
assert.match(post, /parseAuthenticatedFeedbackPost\(/, 'feedback must verify source ownership')
assert.match(post, /sourceKind === 'direct'/, 'direct and conversation sources remain distinct')
assert.match(post, /private_source_ref: parsed.privateSourceRef/, 'verified private provenance must be persisted')
assert.match(post, /status: 'submitted_for_review'/, 'conversation feedback stays review-only')
assert.doesNotMatch(post, /(?:emitCoreEvent|applyWorldMutation|castVote)\s*\(/, 'intake must not execute civic or world commands')
if (fs.existsSync(path.join(root, civicPath))) {
  const civic = read(civicPath)
  assert.match(civic, /verifiedBearerUserId\(req\)/, 'civic reader must authenticate')
  assert.match(civic, /\.eq\('player_profile_id', profileId\)/, 'civic reader must use same auth identity')
  console.log('Cross-route auth identity contract passed (static only; database mapping unverified)')
} else {
  console.log('Feedback-side identity checks passed; civic reader PR #578 not present on this branch')
}
