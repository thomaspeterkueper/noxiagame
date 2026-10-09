import {compareSocialTrajectories,replayExperiences} from './personRegulationExperiment'
import {neutralRegulation} from './personRegulation'
const a=compareSocialTrajectories(14)
if(!(a.isolated.values.loneliness>a.connected.values.loneliness))throw Error('isolation should cause more loneliness')
if(!(a.connected.values.belonging>a.isolated.values.belonging))throw Error('connection should improve belonging')
if(!(a.isolatedEffects.socialSeeking>a.connectedEffects.socialSeeking))throw Error('social seeking should reflect unmet connection')
const event={id:'one',tick:1,kind:'rejection' as const,intensity:.5}
const once=replayExperiences(neutralRegulation(),[event],2)
const twice=replayExperiences(neutralRegulation(),[event,event],2)
if(JSON.stringify(once)!==JSON.stringify(twice))throw Error('event replay must deduplicate')
console.log('PASS: 14-day social trajectories, belonging vs loneliness, event deduplication')
