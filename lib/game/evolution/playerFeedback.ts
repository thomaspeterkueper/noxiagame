/** Explicit player feedback is not a simulation observation or authorized command. */
export const FEEDBACK_CATEGORIES = ['idea','problem','building','profession','technology','gameplay','other'] as const
export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number]
export interface FeedbackDraft {
 category: FeedbackCategory
 title: string
 description: string
 locationRef?: string
 visibility: 'private'|'public'
}
export interface FeedbackValidation {
 valid: boolean
 errors: string[]
 normalized?: FeedbackDraft
}
export function validateFeedback(input: FeedbackDraft): FeedbackValidation {
 const title = input.title.trim()
 const description = input.description.trim()
 const errors: string[] = []
 if (!FEEDBACK_CATEGORIES.includes(input.category)) errors.push('invalid_category')
 if (title.length < 5 || title.length > 120) errors.push('invalid_title')
 if (description.length < 20 || description.length > 5000) errors.push('invalid_description')
 if (input.locationRef && input.locationRef.length > 200) errors.push('invalid_location')
 if (input.visibility !== 'private' && input.visibility !== 'public') errors.push('invalid_visibility')
 return errors.length ? {valid:false,errors} : {valid:true,errors,normalized:{
   category:input.category,title,description,locationRef:input.locationRef?.trim(),
   visibility:input.visibility
 }}
}
/** Storage adapter must add authenticated owner, clock and server-side id. */
export const FEEDBACK_INTAKE_POLICY = {
 source:'player_explicit_feedback',
 initialStatus:'submitted_for_review',
 createsWorldEvent:false,
 executesCode:false,
 requiresAuthentication:true,
 requiresModeration:true,
} as const
