import {narrativeTraitBaseline} from './npcNarrativeTraits'
const x={personId:'npc-1',birthMonth:3,birthDay:22,chineseYear:2000,worldSeed:'seelenberg'}
const a=narrativeTraitBaseline(x),b=narrativeTraitBaseline(x)
if(JSON.stringify(a)!==JSON.stringify(b))throw Error('not deterministic')
if(a.archetype!=='aries'||a.chineseAnimal!=='dragon')throw Error('archetype incorrect')
if(Object.values(a.traits).some(v=>v<0.2||v>0.8))throw Error('traits out of bounds')
const unknown=narrativeTraitBaseline({personId:'npc-2',worldSeed:'seelenberg'})
if(unknown.archetype!=='unassigned'||unknown.chineseAnimal!=='unassigned')throw Error('invented birth details')
if(narrativeTraitBaseline({...x,personId:'npc-3'}).traits.curiosity===a.traits.curiosity)throw Error('missing individual variability')
let invalid=false;try{narrativeTraitBaseline({personId:'',worldSeed:'x'})}catch{invalid=true}if(!invalid)throw Error('missing identity accepted')
console.log('NPC narrative trait baseline tests passed')

// Symbolic birth data changes the editorial seed, not Core facts or existing persisted traits.
const contrasting=narrativeTraitBaseline({...x,birthMonth:4,birthDay:25})
if(contrasting.archetype!=='taurus'||JSON.stringify(contrasting.traits)===JSON.stringify(a.traits))throw Error('sign style not represented')
