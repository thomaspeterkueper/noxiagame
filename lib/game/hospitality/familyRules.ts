// lib/game/hospitality/familyRules.ts
// Familien im Lokal (04.11.2026, vorbereitend zu R-24). Thomas, 03.11.2026: „Es wird
// Zeit für Kinder und ganze Lebensläufe.“ Bevor Population die ersten Kinder
// liefert, steht hier, was im Lokal für sie gilt:
//   * keine Kinder in Bar und Nachtclub;
//   * kein Alkohol für Minderjährige – auch nicht ausgegeben;
//   * Kakao und Kinderteller auf der Karte von Café und Restaurant;
//   * Kinder sprechen kindgerecht, gehen mit niemandem mit und geben nichts Persönliches
//     preis (zusätzlich zu den Regeln im Gesprächsweg, R-24 Punkt 0).
// Minderjährig ist, wer als Kind geführt wird (`lifeStage`) oder dessen Alter
// unter 18 bekannt ist. Reine Regeln.

export const ALCOHOL_ITEMS: ReadonlySet<string> = new Set(['longdrink', 'shot'])

export function isMinor(person: { lifeStage?: string | null; knownAgeYears?: number | null; ageYears?: number | null } | null | undefined): boolean {
  if (!person) return false
  if (person.lifeStage === 'child') return true
  const age = person.ageYears ?? person.knownAgeYears
  return typeof age === 'number' && age < 18
}

/** Dürfen Kinder in diese Lokalart? Nicht in Bar und Nachtclub. */
export function minorsAllowed(kind: string): boolean {
  return kind !== 'bar' && kind !== 'nightclub'
}

/** Darf dieser Posten an diese Person gehen? Kein Alkohol an Minderjährige. */
export function itemAllowedFor(itemCode: string, recipientIsMinor: boolean): boolean {
  return !(recipientIsMinor && ALCOHOL_ITEMS.has(itemCode))
}

/** Was eine Figur im Lokal über Kinder weiß – das Kind selbst und das Personal. */
export function familyFacts(input: { selfIsMinor: boolean; staff: boolean; minorsPresent: number }): string[] {
  const facts: string[] = []
  if (input.selfIsMinor) {
    facts.push('Du bist ein Kind und mit deiner Familie hier; sprich kurz, freundlich und kindgerecht, über Dinge, die Kinder beschäftigen')
    facts.push('Du gehst mit niemandem mit, verrätst nichts über dich oder dein Zuhause und hast keine Geheimnisse mit Fremden')
    facts.push('Wird es dir unangenehm oder seltsam, sagst du das und gehst zu deinen Eltern')
  } else if (input.staff && input.minorsPresent > 0) {
    facts.push(input.minorsPresent === 1 ? 'Ein Kind ist mit seiner Familie hier; an Kinder gibt es keinen Alkohol' : `${input.minorsPresent} Kinder sind mit ihren Familien hier; an Kinder gibt es keinen Alkohol`)
  }
  return facts.map(f => f.length > 140 ? f.slice(0, 139) + '…' : f)
}
