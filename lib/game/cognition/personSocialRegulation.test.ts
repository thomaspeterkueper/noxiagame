import {socialExperiencesFromEvents} from './personSocialRegulation'
import type {PopulationEvent,PersonRelationship} from '../population/types'
const event=(id:string,eventType:string):PopulationEvent=>({id,tick:4,eventType,actorPersonId:'a',relatedPersonId:'b',locationId:'loc',subjectType:'person',subjectRef:'b',payload:{}})
const relationship:PersonRelationship={id:'r',personId:'a',otherPersonId:'b',relationshipType:'friend',familiarity:.9,trust:.9,affinity:.9,lastInteractionTick:4}
if(socialExperiencesFromEvents([event('1','social_interaction')],[]).size!==0)throw Error('proximity is not connection')
const mapped=socialExperiencesFromEvents([event('1','social_interaction'),event('1','social_interaction')],[relationship]).get('a')??[]
if(mapped.length!==1||mapped[0].kind!=='meaningful_contact')throw Error('relationship evidence or dedup failed')
const rejection=socialExperiencesFromEvents([event('2','social_rejection')],[]).get('a')??[]
if(rejection[0]?.kind!=='rejection')throw Error('rejection not mapped')
console.log('PASS: real social event mapping, relationship quality, proximity guard, dedup')
