export type Acce001State = { x: number; h: number };

export type Acce001Result = {
  qA: number;
  qB: number;
  reducedClosureDefect: number;
  fullClosureDefect: number;
  extensionAdmissible: false;
  evidenceLabel: "SIMULATION_EVIDENCE";
};

export function observable(state: Acce001State): number {
  return state.x + state.h;
}

export function runAcce001(): Acce001Result {
  const a: Acce001State = { x: 10, h: -2 };
  const b: Acce001State = { x: 10, h: 2 };

  const qA = observable(a);
  const qB = observable(b);

  // Reduced reconstruction sees x only. Since x_A === x_B it predicts
  // no difference, while the generated observations differ.
  const reducedClosureDefect = Math.abs(qB - qA);

  // Once the known standard carrier h is restored to Omega_std, both
  // observations are exactly predicted. Residual closure defect is zero.
  const fullPredictionA = a.x + a.h;
  const fullPredictionB = b.x + b.h;
  const fullClosureDefect =
    Math.abs(qA - fullPredictionA) + Math.abs(qB - fullPredictionB);

  return {
    qA,
    qB,
    reducedClosureDefect,
    fullClosureDefect,
    extensionAdmissible: false,
    evidenceLabel: "SIMULATION_EVIDENCE",
  };
}
