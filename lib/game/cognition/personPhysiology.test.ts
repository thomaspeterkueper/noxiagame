import { physiologicalActionModifiers as modifiers } from './personPhysiology'
const check=(condition:boolean,label:string)=>{if(!condition)throw new Error(label)}
const neutral={stress:0,fatigue:0,socialSafety:0,novelty:0}
const personality={stressReactivity:1,fatigueSensitivity:1,affiliationDrive:1,noveltySeeking:1}
const baseline=modifiers(neutral,personality)
check(Object.values(baseline).every(v=>v===0),'neutral physiological inputs add no action bias')
const stressed=modifiers({stress:1,fatigue:1,socialSafety:0,novelty:0},personality)
check(stressed.rest>0&&stressed.work<0&&stressed.travel_home>0,'fatigue and stress shift available actions')
const safe=modifiers({stress:0,fatigue:0,socialSafety:1,novelty:0},personality)
check(safe.social_interaction>baseline.social_interaction,'affiliation depends on social safety')
const opposite=modifiers({stress:1,fatigue:0,socialSafety:0,novelty:0},{...personality,stressReactivity:0})
check(opposite.inspect_problem===0,'the same stimulus can affect distinct individuals differently')
const extreme=modifiers({stress:Infinity,fatigue:99,socialSafety:-5,novelty:99},{stressReactivity:99,fatigueSensitivity:99,affiliationDrive:99,noveltySeeking:99})
check(Object.values(extreme).every(v=>Number.isFinite(v)&&Math.abs(v)<=.35),'bounded and finite')
check(JSON.stringify(modifiers({stress:.4,fatigue:.3,socialSafety:.7,novelty:.2},personality))===JSON.stringify(modifiers({stress:.4,fatigue:.3,socialSafety:.7,novelty:.2},personality)),'deterministic')
console.log('NPC physiology proxy model: tests passed')
