/**
 * NOXIA-KNOWLEDGE-0001: a deterministic, side-effect-free knowledge transfer.
 * This module does not consult the authoritative event stream or mutate a belief.
 * Runtime callers must first validate that communication occurred and that the
 * sender has access to the source. Acceptance is always a separate action.
 */
export type KnowledgeSourceKind =
  | "event" | "perception" | "testimony" | "record" | "inference" | "unknown";

export type KnowledgeClaim = Readonly<{
  id: string;
  text: string;
  sourceKind: KnowledgeSourceKind;
  sourceRef: string | null;
  rootClaimId: string;
}>;

export type Transmission = Readonly<{
  id: string;
  senderId: string;
  recipientId: string;
  claim: KnowledgeClaim;
  sourceClaimId: string;
  transmittedAtTick: number;
  deliveredText: string;
}>;

export type Receipt = Readonly<{
  transmission: Transmission;
  interpretation: string | null;
  accepted: boolean | null;
}>;

function required(label: string, value: string): string {
  const v = value.trim();
  if (!v) throw new Error(`Missing ${label}`);
  return v;
}

export function originateClaim(input: {
  id: string;
  text: string;
  sourceKind: KnowledgeSourceKind;
  sourceRef?: string | null;
}): KnowledgeClaim {
  const id = required("claim id", input.id);
  const text = required("claim text", input.text);
  if (input.sourceKind === "event" && !input.sourceRef?.trim())
    throw new Error("An event claim needs an explicit event reference");
  return Object.freeze({
    id,
    text,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef?.trim() || null,
    rootClaimId: id,
  });
}

export function transmitClaim(input: {
  id: string;
  senderId: string;
  recipientId: string;
  source: KnowledgeClaim;
  transmittedAtTick: number;
  deliveredText?: string;
}): Transmission {
  const senderId = required("sender", input.senderId);
  const recipientId = required("recipient", input.recipientId);
  if (senderId === recipientId) throw new Error("Transmission needs distinct actors");
  if (!Number.isSafeInteger(input.transmittedAtTick) || input.transmittedAtTick < 0)
    throw new Error("Invalid simulation tick");
  return Object.freeze({
    id: required("transmission id", input.id),
    senderId,
    recipientId,
    claim: input.source,
    sourceClaimId: input.source.id,
    transmittedAtTick: input.transmittedAtTick,
    deliveredText: required("delivered text", input.deliveredText ?? input.source.text),
  });
}

export function receiveTransmission(input: {
  transmission: Transmission;
  interpretation?: string | null;
}): Receipt {
  return Object.freeze({
    transmission: input.transmission,
    interpretation: input.interpretation?.trim() || null,
    accepted: null, // Unexamined; agreement must be a separate explicit decision.
  });
}

export function reinterpretReceipt(input: {
  id: string;
  receipt: Receipt;
  interpretedText: string;
}): KnowledgeClaim {
  return Object.freeze({
    id: required("claim id", input.id),
    text: required("interpretation", input.interpretedText),
    sourceKind: "testimony" as const,
    sourceRef: input.receipt.transmission.id,
    rootClaimId: input.receipt.transmission.claim.rootClaimId,
  });
}
