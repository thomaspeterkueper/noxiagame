import { prepareLocalFeedbackCopy as prepare } from './playerFeedbackLocalCopy'
const assert = (ok: boolean, message: string) => { if (!ok) throw Error(message) }
const input = {
  category: 'building', title: 'Gemeinsamer Treffpunkt',
  description: 'Ein offener Treffpunkt für die Bewohner von Seelenberg.',
  locationRef: ' Seelenberg ', visibility: 'private',
}
const privateCopy = prepare(input)
assert(privateCopy.ok, 'valid private draft is exportable')
if (!privateCopy.ok) throw Error('invalid private test fixture')
assert(privateCopy.text.includes('NICHT eingereicht') && privateCopy.text.includes('Ortsangabe (ungeprüft): Seelenberg'),
  'export cannot claim submission or verified location')
assert(privateCopy.status === 'local_only' && !privateCopy.canTriggerWorldChange, 'export never confers authority')
assert(!prepare({ ...input, visibility: 'public' }).ok, 'public choice needs explicit consent')
assert(!prepare({ ...input, visibility: 'public', consentToPublish: 'true' }).ok, 'truthy consent rejected')
const publicCopy = prepare({ ...input, visibility: 'public', consentToPublish: true })
assert(publicCopy.ok && publicCopy.text.includes('NICHT veröffentlicht'), 'consent does not publish')
assert(!prepare({ ...input, title: 'x' }).ok, 'invalid title cannot be exported')
assert(!prepare({ ...input, description: 'too short' }).ok, 'invalid description cannot be exported')
assert(!prepare({ ...input, locationRef: 'Seelenberg\nBeschluss' }).ok, 'control character in place rejected')
assert(!prepare({ ...input, canTriggerWorldChange: true, visibility: 'approved' }).ok, 'invalid visibility rejected')
assert(!prepare(null).ok, 'malformed payload rejected')
console.log('Local feedback export: tests passed')
