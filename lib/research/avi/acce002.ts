export const ACCE002_LAYERS = ["internal", "environment", "global", "channel"] as const;
export type Acce002Layer = (typeof ACCE002_LAYERS)[number];

export type Acce002State = {
  x: number;
  internal: number;
  environment: number;
  global: number;
  channel: number;
};

export type Acce002Diagnosis = {
  omittedLayer: Acce002Layer;
  reducedClosureDefect: number;
  diagnosedLayer: Acce002Layer | null;
  recoveredClosureDefect: number;
  extensionAdmissible: boolean;
};

const contributions: Record<Acce002Layer, (s: Acce002State) => number> = {
  internal: (s) => s.internal,
  environment: (s) => s.environment,
  global: (s) => s.global,
  channel: (s) => s.channel,
};

export function acce002Observable(s: Acce002State): number {
  return s.x + ACCE002_LAYERS.reduce((sum, layer) => sum + contributions[layer](s), 0);
}

function predict(s: Acce002State, included: ReadonlySet<Acce002Layer>): number {
  return s.x + ACCE002_LAYERS.reduce(
    (sum, layer) => sum + (included.has(layer) ? contributions[layer](s) : 0),
    0,
  );
}

function closureDefect(a: Acce002State, b: Acce002State, included: ReadonlySet<Acce002Layer>): number {
  const observedDifference = acce002Observable(b) - acce002Observable(a);
  const predictedDifference = predict(b, included) - predict(a, included);
  return Math.abs(observedDifference - predictedDifference);
}

export function diagnoseAcce002(a: Acce002State, b: Acce002State, omittedLayer: Acce002Layer): Acce002Diagnosis {
  const reduced = new Set<Acce002Layer>(ACCE002_LAYERS.filter((layer) => layer !== omittedLayer));
  const reducedClosureDefect = closureDefect(a, b, reduced);

  let diagnosedLayer: Acce002Layer | null = null;
  let recoveredClosureDefect = reducedClosureDefect;

  for (const candidate of ACCE002_LAYERS) {
    const trial = new Set(reduced);
    trial.add(candidate);
    const defect = closureDefect(a, b, trial);
    if (defect === 0) {
      diagnosedLayer = candidate;
      recoveredClosureDefect = defect;
      break;
    }
  }

  return {
    omittedLayer,
    reducedClosureDefect,
    diagnosedLayer,
    recoveredClosureDefect,
    extensionAdmissible: recoveredClosureDefect !== 0,
  };
}

export function runAcce002(): Acce002Diagnosis[] {
  const base: Acce002State = { x: 10, internal: 0, environment: 0, global: 0, channel: 0 };
  const deltas: Record<Acce002Layer, number> = { internal: 2, environment: 3, global: 5, channel: 7 };

  return ACCE002_LAYERS.map((omittedLayer) => {
    const variant = { ...base, [omittedLayer]: deltas[omittedLayer] };
    return diagnoseAcce002(base, variant, omittedLayer);
  });
}
