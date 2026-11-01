import {
  FEEDBACK_REVIEW_STATUSES, canTransitionFeedbackReviewStatus as canTransition,
  getPlayerFeedbackStatusView as view, parseFeedbackReviewStatus as parse,
} from './feedbackReviewStatus'
const assert = (condition: boolean, message: string) => { if (!condition) throw Error(message) }
assert(FEEDBACK_REVIEW_STATUSES.length === 6, 'all statuses declared')
for (const status of FEEDBACK_REVIEW_STATUSES) {
  const projection = view(status)
  assert(projection !== null && projection.label.length > 0, 'all statuses have player-facing labels')
  assert(projection?.createsWorldEvent === false && projection.civicDecision === false, 'review never grants world or civic authority')
  assert(!canTransition(status, status), 'same-status transitions rejected')
}
assert(canTransition('submitted_for_review', 'under_review'), 'intake may enter review')
assert(canTransition('under_review', 'needs_information'), 'review may request information')
assert(canTransition('needs_information', 'under_review'), 'answer may resume review')
assert(canTransition('under_review', 'accepted_for_planning'), 'planning acceptance requires review')
assert(canTransition('accepted_for_planning', 'closed'), 'planning review may close')
for (const [from, to] of [
  ['submitted_for_review', 'accepted_for_planning'],
  ['submitted_for_review', 'closed'],
  ['declined', 'under_review'],
  ['closed', 'under_review'],
  ['accepted_for_planning', 'submitted_for_review'],
]) assert(!canTransition(from, to), 'forbidden shortcut or terminal reopening rejected')
for (const invalid of [null, undefined, 0, true, [], {}, 'approved', 'world_changed', 'accepted_for_planning ']) {
  assert(parse(invalid) === null && view(invalid) === null, 'invalid status must fail closed')
  assert(!canTransition(invalid, 'under_review') && !canTransition('under_review', invalid), 'invalid transitions rejected')
}
console.log('Feedback review status contract: tests passed')
