// lib/game/condition.ts
// ─────────────────────────────────────────────────────────────────────────────
// NOXIA — Zustand · Abnutzung · Reparatur · Wertminderung
//
// EIN Modell für ALLE adressierbaren Entitäten:
//   Teile (Schiffsmodule) · Häuser (Gebäude) · Schiffe (Rahmen + Module).
// Zwei universelle Operationen, jede Domäne reicht ihre eigene Wertbasis ein:
//   depreciatedValue(fullValue, condition)        → geminderter Verkaufswert
//   getRepairQuote(replacementCost, condition)    → Reparaturkosten auf 100
//
// Zwei Wirkungen, bewusst unterschiedlich modelliert:
//   • FUNKTION ist binär   : ab condition < DAMAGED_BELOW fällt die Entität aus
//     (status 'damaged') und trägt nichts mehr bei. Ein defektes Teil arbeitet
//     nicht „ein bisschen", es arbeitet nicht.
//   • WERT ist stetig      : der Verkaufspreis sinkt linear mit dem Zustand —
//     ein Käufer preist die Abnutzung ein. Marktlogik sichtbar, nie erklärt.
//
// Pure, ohne DB.
// ─────────────────────────────────────────────────────────────────────────────

export type Condition = number;                   // 0..100
export type EntityStatus = 'active' | 'damaged' | 'disabled';

export const CONDITION = {
  MAX: 100,
  DAMAGED_BELOW: 40,   // darunter: Funktion fällt aus (status 'damaged')
  DISABLED_AT: 0,      // 0: irreparabel/zerstört (status 'disabled')
  REPAIR_RATE: 0.6,    // Reparatur auf 100 = REPAIR_RATE × Wiederbeschaffung × Schaden%
} as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clampCond = (c: number) => Math.max(0, Math.min(CONDITION.MAX, c));

/** Wertfaktor aus dem Zustand (linear, 0..1). */
export function conditionFactor(condition: Condition): number {
  return clamp01(clampCond(condition) / CONDITION.MAX);
}

/** Geminderter Verkaufs-/Marktwert: voller Wert × Zustandsfaktor. */
export function depreciatedValue(fullValue: number, condition: Condition): number {
  return Math.round(fullValue * conditionFactor(condition));
}

/** Reparatur auf condition 100 — Kosten steigen mit dem Schaden. */
export function getRepairQuote(
  replacementCost: number, condition: Condition,
): { cost: number; restoresTo: number } {
  const damage = clamp01((CONDITION.MAX - clampCond(condition)) / CONDITION.MAX);
  return { cost: Math.round(replacementCost * CONDITION.REPAIR_RATE * damage), restoresTo: CONDITION.MAX };
}

/** Effektiver Status aus dem Zustand. Manuelles 'disabled' kann das überschreiben. */
export function statusFromCondition(condition: Condition): EntityStatus {
  const c = clampCond(condition);
  if (c <= CONDITION.DISABLED_AT) return 'disabled';
  if (c < CONDITION.DAMAGED_BELOW) return 'damaged';
  return 'active';
}

/** OPTIONALER Haken: abgenutzt = weniger Output. Default 1 (aus), wie Last-Strafe & Co. */
export function outputFactor(condition: Condition): number {
  return 1; // bei Bedarf: return conditionFactor(condition);
}
