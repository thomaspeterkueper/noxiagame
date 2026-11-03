import { describe, expect, it } from 'vitest'
import { canAddJournalEntry, canApproveLegacyExport, canReadJournalEntry, visibleJournalEntries, type Journal, type JournalEntry } from './journal'
const journal: Journal = { id: 'journal:1', ownerUserId: 'mother', title: 'My Life', archived: false }
const entry: JournalEntry = {
  id: 'entry:1', journalId: journal.id, authorUserId: 'mother', kind: 'interview',
  content: 'A childhood memory', recordedAt: '2026-11-03', eventDate: null, visibility: 'private',
  personReferences: [], sourceReferences: [], approvalId: null,
}
const guest = { journal, callerUserId: 'relative', membership: {
  journalId: journal.id, userId: 'relative', role: 'editor' as const,
  acceptedAt: '2026-11-03', revokedAt: null,
} }
describe('Standalone private journal invariants', () => {
  it('is private by default even for an invited editor', () => {
    expect(canReadJournalEntry(guest, entry)).toBe(false)
    expect(visibleJournalEntries(guest, [entry])).toEqual([])
    expect(canReadJournalEntry({journal,callerUserId:'mother'},entry)).toBe(true)
  })
  it('allows an accepted editor to add entries but not approve legacy export', () => {
    expect(canAddJournalEntry(guest)).toBe(true)
    const approved = {...entry,visibility:'approved-for-legacy' as const,approvalId:'approval:1',sourceReferences:['source:1']}
    expect(canApproveLegacyExport(guest,approved)).toBe(false)
    expect(canApproveLegacyExport({journal,callerUserId:'mother'},approved)).toBe(true)
  })
  it('blocks revoked membership and unaccepted invitations', () => {
    expect(canReadJournalEntry({...guest,membership:{...guest.membership,revokedAt:'2026-11-04'}},{...entry,visibility:'invited'})).toBe(false)
    expect(canAddJournalEntry({...guest,membership:{...guest.membership,acceptedAt:null}})).toBe(false)
  })
  it('never exports unsourced or unapproved entries', () => {
    expect(canApproveLegacyExport({journal,callerUserId:'mother'},{...entry,visibility:'approved-for-legacy'})).toBe(false)
  })
  it('does not depend on game NPCs, ticks or world location', () => {
    expect(canReadJournalEntry({journal,callerUserId:'mother'},entry)).toBe(true)
  })
})
