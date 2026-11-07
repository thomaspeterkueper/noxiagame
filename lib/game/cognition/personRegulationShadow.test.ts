import {projectObservedSocialRegulation} from './personRegulationShadow'
import type {PopulationEvent,PersonRelationship} from '../population/types'
const rel:PersonRelationship={id:'r',personId:'a',otherPersonId:'b',relationshipType:'friend',familiarity:.9,trust:.9,affinity:.9,lastInteractionTick:24}
const event:PopulationEvent={id:'event1',tick:24,eventType:'social_interaction',actorPersonId:'a',relatedPersonId:'b',locationId:'loc',subjectType:'person',subjectRef:'b',payload:{}}
const result=projectObservedSocialRegulation({personIds:['a','c'],events:[event],relationships:[rel],fromTick:0,toTick:48})
if(result.get('a')!.observedEvents!==1)throw Error('observed event missing')
if(result.get('c')!.observedEvents!==0)throw Error('invented experience')
if(!(result.get('a')!.state.values.belonging>result.get('c')!.state.values.belonging))throw Error('belonging did not respond')
if(result.get('c')!.state.values.loneliness!==.15)throw Error('absence incorrectly interpreted as loneliness')
console.log('PASS: shadow replay grounded in observed events, no inferred loneliness')
