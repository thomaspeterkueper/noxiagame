import { evaluateCivicDecision, type CivicDecision } from './civicPreflight'
const check = (condition: boolean, message: string) => { if (!condition) throw Error(message) }
const d: CivicDecision = {
  id: 'vote:1', proposalId: 'proposal:1', action: 'conversion', assetId: 'old-factory',
  competentAuthority: true, quorumMet: true, approved: true,
  protectedAsset: false, protectionPermit: false,
  propertyOwnerConsents: true, legalTransferAuthority: false,
  budgetAvailable: true, resourcesAvailable: true, provenanceRefs: ['vote:record'],
}
check(evaluateCivicDecision(d).allowed, 'valid preflight accepted')
check(!evaluateCivicDecision({...d, propertyOwnerConsents: false}).allowed, 'vote cannot override owner')
check(!evaluateCivicDecision({...d, protectedAsset: true}).allowed, 'protected building requires permit')
check(!evaluateCivicDecision({...d, quorumMet: false}).allowed, 'quorum required')
check(evaluateCivicDecision(d).execution === 'core_command_required', 'preflight never executes')
const untrusted = (override: Record<string, unknown>) => evaluateCivicDecision({...d, ...override} as CivicDecision)
check(!untrusted({competentAuthority: 'true'}).allowed, 'string authority is not authority')
check(!untrusted({approved: 'true'}).allowed, 'string vote is not a vote')
check(!untrusted({quorumMet: 1}).allowed, 'numeric quorum is invalid')
check(!untrusted({propertyOwnerConsents: 'true', legalTransferAuthority: false}).allowed, 'string owner consent invalid')
check(!untrusted({protectedAsset: 'false'}).allowed, 'string protected state invalid')
check(!untrusted({protectedAsset: true, protectionPermit: 'true'}).allowed, 'string permit invalid')
check(!untrusted({budgetAvailable: 'true'}).allowed, 'string budget invalid')
check(!untrusted({resourcesAvailable: 1}).allowed, 'numeric resources invalid')
check(!untrusted({action: 'burn'}).allowed && untrusted({action: 'burn'}).action === null, 'invalid action cannot escape')
check(!untrusted({provenanceRefs: ['vote:record', ' ']}).allowed, 'blank source ref rejected')
check(!untrusted({provenanceRefs: 'vote:record'}).allowed, 'string source list rejected')
check(!untrusted({id: ' '}).allowed, 'blank decision id rejected')
check(!evaluateCivicDecision(null as unknown as CivicDecision).allowed, 'null input fails closed')
check(!evaluateCivicDecision([] as unknown as CivicDecision).allowed, 'array input fails closed')
console.log('Civic preflight regression checks passed')
