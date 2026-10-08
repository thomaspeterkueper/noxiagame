// lib/game/population/access.ts
// NOXIA-OMNI-0002 — power as a measured quantity.
//
// The canon defines power as the ability to change the possibility space of
// others. Here it is not a value someone has, but a record of what gatekeepers
// actually did: every time a landlord or employer granted or refused access, and
// every time a person turned an offer down. Power then shows as an asymmetry in
// that record, or it does not show at all.

export type AccessKind = 'housing' | 'job'
export type AccessOutcome = 'granted' | 'refused' | 'declined'

/** One decision about access. In shadow mode these are logged without being carried out. */
export interface AccessRecord {
  tick: number
  kind: AccessKind
  personId: string
  /** Dwelling or vacancy. */
  targetId: string
  /** Landlord or employer who decided; for 'declined' the one whose offer was turned down. */
  gatekeeperId: string
  outcome: AccessOutcome
  reason: string
  /**
   * How the decision came about. Only 'market' is behaviour; 'backfill' is data
   * cleanup and 'provided' an assignment nobody decided on. Defaults to 'market'.
   */
  origin?: 'market' | 'provided' | 'backfill'
}

/** Records that are behaviour: neither data cleanup nor plain assignment. */
export function marketRecords(records: readonly AccessRecord[]): AccessRecord[] {
  return records.filter((record) => (record.origin ?? 'market') === 'market')
}

export interface GatekeeperPower {
  gatekeeperId: string
  /** Decisions this gatekeeper made about others. */
  decisions: number
  granted: number
  refused: number
  /** How often their offer was turned down: the other side's freedom to say no. */
  declined: number
  /** Distinct people whose access they decided. */
  peopleAffected: number
  /** Share of their decisions that closed an option. */
  refusalRate: number
}

const round = (value: number): number => Math.round(value * 10_000) / 10_000

/** Who decided how often about whom, strongest gatekeeper first. */
export function gatekeeperPower(allRecords: readonly AccessRecord[]): GatekeeperPower[] {
  const records = marketRecords(allRecords)
  const byGatekeeper = new Map<string, { granted: number; refused: number; declined: number; people: Set<string> }>()
  for (const record of records) {
    const entry = byGatekeeper.get(record.gatekeeperId) ?? { granted: 0, refused: 0, declined: 0, people: new Set<string>() }
    if (record.outcome === 'granted') entry.granted += 1
    else if (record.outcome === 'refused') entry.refused += 1
    else entry.declined += 1
    if (record.outcome !== 'declined') entry.people.add(record.personId)
    byGatekeeper.set(record.gatekeeperId, entry)
  }
  return [...byGatekeeper.entries()]
    .map(([gatekeeperId, entry]) => {
      const decisions = entry.granted + entry.refused
      return {
        gatekeeperId, decisions, granted: entry.granted, refused: entry.refused, declined: entry.declined,
        peopleAffected: entry.people.size, refusalRate: decisions ? round(entry.refused / decisions) : 0,
      }
    })
    .sort((a, b) => (b.peopleAffected - a.peopleAffected) || (b.decisions - a.decisions) || a.gatekeeperId.localeCompare(b.gatekeeperId))
}

export interface AccessSummary {
  /** Options people asked for. */
  requests: number
  /** Share of requests the gatekeeper granted: how much of what exists is really open. */
  accessibleShare: number
  /** Share of offers the person turned down: how much say people have themselves. */
  declinedShare: number
  /** Share of all decisions made by the single strongest gatekeeper. */
  topGatekeeperShare: number
  /** People who were refused at least once and never granted anything. */
  shutOut: number
}

export function summarizeAccess(allRecords: readonly AccessRecord[]): AccessSummary {
  const records = marketRecords(allRecords)
  const decided = records.filter((record) => record.outcome !== 'declined')
  const granted = decided.filter((record) => record.outcome === 'granted')
  const grantedPeople = new Set(granted.map((record) => record.personId))
  const refusedPeople = new Set(decided.filter((record) => record.outcome === 'refused').map((record) => record.personId))
  const power = gatekeeperPower(records)
  const offers = granted.length + records.filter((record) => record.outcome === 'declined').length
  return {
    requests: decided.length,
    accessibleShare: decided.length ? round(granted.length / decided.length) : 1,
    declinedShare: offers ? round(records.filter((record) => record.outcome === 'declined').length / offers) : 0,
    topGatekeeperShare: decided.length && power.length ? round(Math.max(...power.map((entry) => entry.decisions)) / decided.length) : 0,
    shutOut: [...refusedPeople].filter((personId) => !grantedPeople.has(personId)).length,
  }
}
