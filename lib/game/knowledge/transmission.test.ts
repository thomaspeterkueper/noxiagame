import { strict as assert } from "node:assert";
import { originateClaim, transmitClaim, receiveTransmission, reinterpretReceipt } from "./transmission";

const initial = originateClaim({
  id: "claim-1",
  text: "A visitor helped during the flood.",
  sourceKind: "perception",
  sourceRef: "perception-1",
});
const utterance = transmitClaim({
  id: "transmission-1", senderId: "npc-a", recipientId: "npc-b",
  source: initial, transmittedAtTick: 100,
});
const receipt = receiveTransmission({ transmission: utterance });
assert.equal(receipt.accepted, null, "Hearing a claim is not believing it");
assert.equal(utterance.claim.sourceKind, "perception");
assert.equal(utterance.claim.rootClaimId, "claim-1");
const altered = reinterpretReceipt({
  id: "claim-2", receipt,
  interpretedText: "A mysterious visitor saved the village.",
});
assert.equal(altered.rootClaimId, initial.id, "Transmission must preserve roots");
assert.equal(altered.sourceKind, "testimony");
assert.equal(altered.sourceRef, "transmission-1");
assert.notEqual(altered.text, initial.text, "Interpretation remains distinguishable");
assert.equal(initial.text, "A visitor helped during the flood.", "The source must remain unchanged");
assert.throws(() => originateClaim({ id: "x", text: "An event happened", sourceKind: "event" }));
assert.throws(() => transmitClaim({
  id: "bad", senderId: "npc-a", recipientId: "npc-a",
  source: initial, transmittedAtTick: 100,
}));
assert.throws(() => transmitClaim({
  id: "bad", senderId: "npc-a", recipientId: "npc-b",
  source: initial, transmittedAtTick: -1,
}));
console.log("NOXIA-KNOWLEDGE-0001 transmission contract: 9 checks passed");
