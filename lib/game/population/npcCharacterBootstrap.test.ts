import {prepareCharacterBootstrap, proposeExperiencedTraitChange} from './npcCharacterBootstrap'
const seed={personId:'npc-stable',worldSeed:'noxia-1',birthMonth:2,birthDay:3}
const first=prepareCharacterBootstrap(seed)
if(!first.shouldPersist || first.initialTraits.curiosity===undefined)throw Error('missing initial candidate')
const existing=prepareCharacterBootstrap({...seed,existingTraits:{curiosity:0.97,history_version:2}})
if(existing.shouldPersist || existing.initialTraits.curiosity!==0.97 || existing.initialTraits.history_version!==2)throw Error('overwrote existing personality')
const update=proposeExperiencedTraitChange({curiosity:0.95},{key:'curiosity',delta:0.1,eventId:'event1'})
if(update.curiosity!==1)throw Error('not clamped')
let failed=false;try{proposeExperiencedTraitChange({curiosity:0.5},{key:'curiosity',delta:0.2,eventId:'event2'})}catch{failed=true}if(!failed)throw Error('unbounded change')
console.log('NPC bootstrap and experience proposal tests passed')
