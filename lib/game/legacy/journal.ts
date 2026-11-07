/** Standalone Living Legacy journal: no dependency on game ticks, coordinates or NPC runtime.
 * All access checks are pure domain gates; the service/API must authenticate the caller.
 */
export type JournalEntryKind = 'text' | 'audio-transcript' | 'photo-caption' | 'interview'
export type JournalEntryVisibility = 'private' | 'invited' | 'approved-for-legacy'
export type JournalRole = 'owner' | 'editor' | 'reader'
export interface Journal {
  id: string
  ownerUserId: string
  title: string
  archived: boolean
}
export interface JournalMembership {
  journalId: string
  userId: string
  role: JournalRole
  acceptedAt: string | null
  revokedAt: string | null
}
export interface JournalEntry {
  id: string
  journalId: string
  authorUserId: string
  kind: JournalEntryKind
  content: string
  recordedAt: string
  eventDate: string | null
  visibility: JournalEntryVisibility
  personReferences: readonly string[]
  sourceReferences: readonly string[]
  approvalId: string | null
}
export interface JournalContext {
  journal: Journal
  callerUserId: string
  membership?: JournalMembership | null
}
function permission(ctx: JournalContext): JournalRole | null {
  if (ctx.callerUserId === ctx.journal.ownerUserId) return 'owner'
  const membership = ctx.membership
  if (!membership || membership.journalId !== ctx.journal.id ||
      membership.userId !== ctx.callerUserId || !membership.acceptedAt || membership.revokedAt) return null
  return membership.role
}
export function canReadJournalEntry(ctx: JournalContext, entry: JournalEntry): boolean {
  if (entry.journalId !== ctx.journal.id) return false
  const role = permission(ctx)
  if (!role) return false
  if (role === 'owner' || entry.authorUserId === ctx.callerUserId) return true
  return entry.visibility !== 'private'
}
export function canAddJournalEntry(ctx: JournalContext): boolean {
  return !ctx.journal.archived && ['owner', 'editor'].includes(permission(ctx) ?? '')
}
export function canApproveLegacyExport(ctx: JournalContext, entry: JournalEntry): boolean {
  return permission(ctx) === 'owner' && entry.journalId === ctx.journal.id &&
    entry.visibility === 'approved-for-legacy' && Boolean(entry.approvalId) &&
    entry.sourceReferences.length > 0
}
export function visibleJournalEntries(ctx: JournalContext, entries: readonly JournalEntry[]): JournalEntry[] {
  return entries.filter(entry => canReadJournalEntry(ctx, entry))
}
