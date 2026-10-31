/** NOXIA #575 – pure bilateral partnership command gate.
 * A proposal is not a relationship. Only authenticated Core commands may supply consent.
 */
export type PartnershipConsent = {
  personId: string
  partnerId: string
  accepted: boolean
  recordedAtTick: number
  expiresAtTick: number
}
export type PartnershipRequest = {
  eventId: string
  personA: string
  personB: string
  atTick: number
  adultA: boolean
  adultB: boolean
  consentA: PartnershipConsent | null
  consentB: PartnershipConsent | null
  alreadyPartnered: boolean
}
export type PartnershipDecision =
  | { allowed: true; command: { id: string; type: 'form_partnership'; members: [string, string]; tick: number } }
  | { allowed: false; reason: string }
function validConsent(c: PartnershipConsent | null, self: string, other: string, tick: number): boolean {
  return !!c && c.personId === self && c.partnerId === other && c.accepted === true
    && Number.isSafeInteger(c.recordedAtTick) && Number.isSafeInteger(c.expiresAtTick)
    && c.recordedAtTick <= tick && tick <= c.expiresAtTick
}
export function proposePartnership(input: PartnershipRequest): PartnershipDecision {
  const { personA:a, personB:b, atTick:t } = input
  if (!input.eventId || !a || !b || a===b || !Number.isSafeInteger(t) || t < 0)
    return { allowed:false, reason:'invalid_request' }
  if (!input.adultA || !input.adultB) return { allowed:false, reason:'adult_gate' }
  if (input.alreadyPartnered) return { allowed:false, reason:'already_partnered' }
  if (!validConsent(input.consentA,a,b,t) || !validConsent(input.consentB,b,a,t))
    return { allowed:false, reason:'mutual_consent_required' }
  const members:[string,string] = a.localeCompare(b) <= 0 ? [a,b] : [b,a]
  return { allowed:true, command:{id:input.eventId,type:'form_partnership',members,tick:t} }
}
