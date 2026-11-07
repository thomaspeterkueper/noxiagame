export type EvidenceLevel = "synthetic" | "simulation" | "laboratory" | "operational";
export interface ReliabilityObservation {
  source: string;
  level: EvidenceLevel;
  trials: number;
  successes: number;
  operatingEnvelope: string;
}
export function summarizeReliability(observations: ReliabilityObservation[]) {
  if (observations.length === 0) throw new Error("At least one observation is required");
  let trials = 0, successes = 0;
  for (const observation of observations) {
    if (!observation.source.trim() || !observation.operatingEnvelope.trim()) throw new Error("Provenance and operating envelope required");
    if (!Number.isSafeInteger(observation.trials) || observation.trials <= 0 ||
        !Number.isSafeInteger(observation.successes) || observation.successes < 0 ||
        observation.successes > observation.trials) throw new Error("Invalid trial counts");
    trials += observation.trials;
    successes += observation.successes;
  }
  if (!Number.isSafeInteger(trials) || !Number.isSafeInteger(successes)) throw new Error("Count overflow");
  const rate = successes / trials;
  const z = 1.96;
  const denominator = 1 + z*z/trials;
  const center = (rate + z*z/(2*trials))/denominator;
  const margin = z*Math.sqrt(rate*(1-rate)/trials + z*z/(4*trials*trials))/denominator;
  return {trials, successes, observedRate: rate, wilson95: [Math.max(0,center-margin),Math.min(1,center+margin)] as const,
    evidenceLevels: [...new Set(observations.map(o=>o.level))]};
}
