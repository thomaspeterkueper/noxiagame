import { validateFeedback, FEEDBACK_INTAKE_POLICY, type FeedbackDraft } from './playerFeedback'
const assert=(ok:boolean,message:string)=>{if(!ok)throw Error(message)}
const draft:FeedbackDraft={category:'building',title:'Gemeinsame Werkstatt',description:'Wir möchten eine gemeinsam betriebene Werkstatt in Seelenberg.',visibility:'private',locationRef:'seelenberg'}
assert(validateFeedback(draft).valid,'suitable request accepted')
assert(validateFeedback({...draft,title:'x'}).valid===false,'short title rejected')
assert(validateFeedback({...draft,description:'x'}).valid===false,'short description rejected')
assert(validateFeedback({...draft,description:'x'.repeat(5001)}).valid===false,'oversized description rejected')
assert(validateFeedback({...draft,category:'unknown' as FeedbackDraft['category']}).valid===false,'unknown category rejected')
assert(validateFeedback({...draft,visibility:'unknown' as FeedbackDraft['visibility']}).valid===false,'invalid visibility rejected')
assert(FEEDBACK_INTAKE_POLICY.createsWorldEvent===false && FEEDBACK_INTAKE_POLICY.executesCode===false,'feedback never authorizes action')
console.log('Player feedback contract tests passed')
