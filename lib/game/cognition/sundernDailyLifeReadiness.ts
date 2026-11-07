import { SUNDERN_FAMILIES } from "./sundernFamilyPilot";

export const SUNDERN_NEEDS = [
  "housing", "food", "water", "sanitation", "sleep", "heating",
  "healthcare", "caregiving", "mobility", "social_contact", "learning", "safety",
] as const;
export type SundernNeed = typeof SUNDERN_NEEDS[number];
export type EvidenceStatus = "verified" | "missing" | "unknown";
export type FamilyEvidence = Readonly<{
  familyId: string;
  homeId?: string;
  homeVerified: boolean;
  needs: Readonly<Partial<Record<SundernNeed, EvidenceStatus>>>;
}>;
export function assessSundernDailyLife(evidence: readonly FamilyEvidence[]) {
  const byFamily = new Map<string, FamilyEvidence>();
  for (const record of evidence) {
    if (byFamily.has(record.familyId)) throw new Error("duplicate_family");
    byFamily.set(record.familyId, record);
  }
  return SUNDERN_FAMILIES.map(family => {
    const record = byFamily.get(family.id);
    const missing: SundernNeed[] = [];
    const unknown: SundernNeed[] = [];
    for (const need of SUNDERN_NEEDS) {
      const status: EvidenceStatus = need === "housing" && !(record?.homeVerified && record.homeId)
        ? "missing" : record?.needs[need] ?? "unknown";
      if (status === "missing") missing.push(need);
      if (status === "unknown") unknown.push(need);
    }
    return { familyId: family.id, missing, unknown, ready: missing.length === 0 && unknown.length === 0 };
  });
}
