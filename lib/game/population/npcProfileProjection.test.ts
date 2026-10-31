import { projectNpcProfile } from './npcProfileProjection'
const facts = [
  {section:'identity',value:'Lan',source:'core',visibility:'public'},
  {section:'memory',value:'private memory',source:'core',visibility:'npc_private'},
  {section:'belief',value:'a rumour',source:'self_report',visibility:'public'},
  {section:'symbolic_archetype',value:'wolf',source:'author_design',visibility:'author_private'},
  {section:'health',value:'private',source:'core',visibility:'admin_private'},
  {section:'history',value:'impossible time',source:'core',visibility:'public',recordedTick:-1},
] as const
const result=projectNpcProfile('npc-1',facts)
if(result.publicFacts.length!==1 || result.publicFacts[0].value!=='Lan')throw Error('public facts must be verified and public')
if(result.adminFacts.length!==2)throw Error('admin facts must not expose NPC/author private fields')
if(result.unverified.length!==1 || result.unverified[0].value!=='a rumour')throw Error('belief provenance must be retained')
if(JSON.stringify(result).includes('wolf')||JSON.stringify(result).includes('private memory'))throw Error('private data leaked')
let rejected=false;try{projectNpcProfile('',facts)}catch{rejected=true}if(!rejected)throw Error('identity missing')
console.log('NPC profile projection tests passed')
