# Historical / Cross-Universe Provenance Contract

NOXIA already owns the actor-facing epistemic pipeline:

`Ground Truth → Observation → Knowledge → Evidence Set → Hypothesis → Decision`

Historical and archaeological material needs one additional **source-side** distinction before it enters that pipeline:

`Site ≠ Observation ≠ Artifact ≠ Dating ≠ Interpretation ≠ Received Tradition ≠ Fiction Canon`

These are graph layers, not a linear truth ladder.

## Rules

- A site identity does not prove an interpretation.
- An observed structure or recovered artifact is evidence; its dating and interpretation are separate assertions.
- Dating may be revised without deleting the artifact or observation.
- Competing interpretations may coexist and be marked provisional/contested.
- Received tradition is retained as a source category and is not silently promoted to archaeological ground truth.
- Fiction canon may reference, combine or transform real evidence and traditions, but must remain typed as fiction canon.
- Source-side provenance does not bypass the existing Evidence/Hypothesis contract. It supplies typed evidence references to it.
- Runtime actors still learn through the normal observation/knowledge pipeline; this graph does not grant privileged historical knowledge.

## First reference graph: Dwarka

`lib/world/provenance/historicalProvenance.ts` contains the first bounded example. Present-day Dwarka, offshore observations, historical interpretation, received tradition and the Dvārakā novel canon remain distinct nodes connected by explicit relations.

The same model is intended for Phaistos/MISHKENAZ, Senckenberg/YIN HUA and other cross-universe artefact chains.
