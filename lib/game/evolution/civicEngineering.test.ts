import { evaluateCivicDecision, type CivicDecision } from './civicPreflight'
import { screenEngineeringCandidate, type EngineeringCandidate } from './engineeringHandoff'
const check=(value:boolean,message:string)=>{if(!value)throw Error(message)}
const d:CivicDecision={id:'vote:1',proposalId:'proposal:1',action:'conversion',assetId:'old-factory',
 competentAuthority:true,quorumMet:true,approved:true,protectedAsset:false,protectionPermit:false,
 propertyOwnerConsents:true,legalTransferAuthority:false,budgetAvailable:true,resourcesAvailable:true,
 provenanceRefs:['vote:record']}
check(evaluateCivicDecision(d).allowed,'valid proposal passes preflight')
check(!evaluateCivicDecision({...d,propertyOwnerConsents:false}).allowed,'vote alone cannot override owner')
check(!evaluateCivicDecision({...d,protectedAsset:true}).allowed,'protected building needs permit')
check(!evaluateCivicDecision({...d,quorumMet:false}).allowed,'quorum is required')
check(evaluateCivicDecision(d).execution==='core_command_required','preflight never mutates world')
const idea:EngineeringCandidate={id:'idea:1',sourceProposalId:'proposal:1',worldYear:2150,domain:'vehicle',
 problem:'Transport in low-density settlements',hypothesis:'Modular electric platform',
 sourceRefs:['dialogue:12','book:7'],availableCapabilities:['electric propulsion'],
 limitations:['battery availability'],origin:'community'}
check(screenEngineeringCandidate(idea).status==='needs_review','documented idea reaches review')
check(screenEngineeringCandidate(idea).grantsTechnology===false,'not an automatic invention unlock')
check(screenEngineeringCandidate({...idea,sourceRefs:[]}).status==='rejected','unsourced idea rejected')
check(screenEngineeringCandidate({...idea,limitations:[]}).status==='rejected','limits required')

// Malformed NPC/experimental input is never a technology handoff payload.
check(screenEngineeringCandidate(idea).payload === idea, 'valid candidate retained for manual review')
const reject = (candidate: unknown, message: string) => {
 const result = screenEngineeringCandidate(candidate)
 check(result.status === 'rejected' && result.payload === null && !result.grantsTechnology, message)
}
reject(null, 'null input safely rejected')
reject('arbitrary text', 'non-object input safely rejected')
reject({...idea, sourceRefs: 'dialogue:12'}, 'string cannot masquerade as reference array')
reject({...idea, sourceRefs: ['dialogue:12', ' ']}, 'blank provenance rejected')
reject({...idea, availableCapabilities: [null]}, 'invalid capability rejected')
reject({...idea, limitations: [4]}, 'invalid limitation rejected')
reject({...idea, problem: null}, 'missing problem safely rejected')
reject({...idea, hypothesis: '  '}, 'blank hypothesis rejected')
reject({...idea, worldYear: Number.NaN}, 'NaN year rejected')
reject({...idea, worldYear: Number.POSITIVE_INFINITY}, 'infinite year rejected')
reject({...idea, worldYear: 2150.5}, 'fractional year rejected')
reject({...idea, domain: 'world_override'}, 'invalid engineering domain rejected')
reject({...idea, origin: 'system_command'}, 'invalid source origin rejected')
reject({...idea, id: ' '}, 'blank idea id rejected')
reject({...idea, sourceProposalId: ' '}, 'blank source proposal rejected')

console.log('Civic and engineering gate tests passed')
