/** Deterministic, append-only in-memory audit events for simulated learning. */
export type LearningEvent =
  | { type: "prediction"; id: string; actorId: string; modelVersion: string; metric: string; unit: string; contextId: string; expected: number; tolerance: number; tick: number }
  | { type: "observation"; id: string; predictionId: string; actorId: string; metric: string; unit: string; contextId: string; measured: number; sourceId: string; tick: number }
  | { type: "evaluation"; id: string; predictionId: string; observationId: string; actorId: string; deviation: number | null; result: "within_tolerance" | "deviation_detected" | "review_required"; reasons: readonly string[]; tick: number }
  | { type: "revision_proposed"; id: string; evaluationId: string; actorId: string; proposedModelVersion: string; tick: number };
export type LearningLedger = readonly LearningEvent[];
export function appendLearningEvent(ledger: LearningLedger, event: LearningEvent): LearningLedger {
  if (!event.id || !event.actorId || !Number.isSafeInteger(event.tick) || event.tick < 0) throw new Error("invalid_event");
  if (ledger.some(item => item.id === event.id)) throw new Error("duplicate_event");
  if (ledger.length && event.tick < ledger[ledger.length - 1].tick) throw new Error("nonmonotonic_tick");
  const parent = (id: string) => ledger.find(item => item.id === id);
  if (event.type === "prediction") {
    if (!event.modelVersion || !event.metric || !event.unit || !event.contextId ||
      !Number.isFinite(event.expected) || !Number.isFinite(event.tolerance) || event.tolerance < 0) throw new Error("invalid_prediction");
  } else if (event.type === "observation") {
    const p = parent(event.predictionId);
    if (!p || p.type !== "prediction" || p.actorId !== event.actorId || event.tick < p.tick ||
      !event.sourceId || !Number.isFinite(event.measured)) throw new Error("invalid_observation");
  } else if (event.type === "evaluation") {
    const p = parent(event.predictionId), o = parent(event.observationId);
    if (!p || p.type !== "prediction" || !o || o.type !== "observation" ||
      o.predictionId !== p.id || p.actorId !== event.actorId || o.actorId !== event.actorId ||
      event.tick < o.tick || (event.deviation !== null && !Number.isFinite(event.deviation))) throw new Error("invalid_evaluation");
    const expected = evaluateLearning(p, o);
    if (event.result !== expected.result || event.deviation !== expected.deviation ||
      JSON.stringify(event.reasons) !== JSON.stringify(expected.reasons)) throw new Error("evaluation_mismatch");
  } else {
    const e = parent(event.evaluationId);
    if (!e || e.type !== "evaluation" || e.actorId !== event.actorId || e.result !== "deviation_detected" ||
      !event.proposedModelVersion || event.tick < e.tick) throw new Error("invalid_revision_proposal");
  }
  return Object.freeze([...ledger, Object.freeze(event)]);
}
export function evaluateLearning(
  p: Extract<LearningEvent, {type:"prediction"}>,
  o: Extract<LearningEvent, {type:"observation"}>
): Pick<Extract<LearningEvent,{type:"evaluation"}>, "deviation" | "result" | "reasons"> {
  const reasons = [
    ...(o.predictionId !== p.id || o.actorId !== p.actorId ? ["identity_mismatch"] : []),
    ...(o.metric !== p.metric || o.unit !== p.unit ? ["dimension_mismatch"] : []),
    ...(o.contextId !== p.contextId ? ["context_mismatch"] : []),
    ...(o.tick < p.tick ? ["temporal_mismatch"] : []),
  ];
  if (reasons.length) return { deviation:null, result:"review_required", reasons };
  const deviation = o.measured - p.expected;
  if (!Number.isFinite(deviation)) return {deviation:null,result:"review_required",reasons:["numeric_overflow"]};
  return {deviation,result:Math.abs(deviation)>p.tolerance?"deviation_detected":"within_tolerance",reasons:[]};
}
/** Proposes a model update but NEVER authorizes or applies it. */
export function simulateLearningCycle(
  ledger: LearningLedger, prediction: Extract<LearningEvent,{type:"prediction"}>,
  observation: Extract<LearningEvent,{type:"observation"}>,
  evaluationId: string
): LearningLedger {
  let next=appendLearningEvent(ledger,prediction);
  next=appendLearningEvent(next,observation);
  const evaluation=evaluateLearning(prediction,observation);
  return appendLearningEvent(next,{type:"evaluation",id:evaluationId,actorId:prediction.actorId,
    predictionId:prediction.id,observationId:observation.id,tick:observation.tick,...evaluation});
}
