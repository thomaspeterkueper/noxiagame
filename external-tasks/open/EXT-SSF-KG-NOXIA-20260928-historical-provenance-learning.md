# Request: Historical Provenance Learning Path

Status: open
Owner: SSF / Knowledge Graph
Consumer: NOXIA

## Goal

Provide a learning path that teaches the epistemic distinction used by NOXIA historical/cross-universe provenance:

`Site ≠ Observation ≠ Artifact ≠ Dating ≠ Interpretation ≠ Received Tradition ≠ Fiction Canon`

## Required learning outcomes

A learner should be able to:
- distinguish an observed feature from an interpretation of that feature;
- distinguish artifact identity from dating/context claims;
- represent competing interpretations without overwriting evidence;
- treat received tradition as a sourced knowledge category rather than ground truth;
- keep fictional canon explicitly typed when it uses real sites or artifacts;
- understand that confidence and provenance do not equal action authority.

## Demonstrators

1. **Phaistos Disc / MISHKENAZ**
   - real site and artifact
   - observable sign system
   - dating/context
   - competing decipherment interpretations
   - explicit fiction-canon transformation

2. **Dwarka / Dvārakā**
   - present-day site
   - marine archaeological observations
   - historical interpretations
   - received tradition
   - novel canon

3. **Senckenberg / YIN HUA**
   - real institution
   - fictional Adar collection
   - fictional bronze key and Namenlose Partitur
   - rule: fictional holdings never inherit real institutional provenance

## Integration contract

SSF/KG should return canonical path/module IDs before NOXIA adds them to `lib/knowledge/ssfPaths.ts`.
Do not mint placeholder SSF IDs in NOXIA.

Runtime learning must feed the existing NOXIA observation/knowledge/evidence pipeline. Completing a module may teach the distinction or unlock analysis capability; it must not reveal hidden Core ground truth or automatically validate a historical interpretation.
