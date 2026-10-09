# Habit evidence observation gate

Population event payloads now include `habitEvidence`, derived from the authoritative execution result already obtained during the tick. This adds **no database query or write**; it enriches the existing event and decision factors.

The observation is not a verified *benefit* or a learning result. No call to `recordAuthoritativeHabitEvent` is made. A started social visit is evidence of execution, not positive social experience. Resource requests and unowned travel/work remain unverified.

## Next experiment

Use recorded events for a read-only offline replay, classify observed outcomes separately, compare repeated contexts and compute learning curves. Before enabling live learning, check that the event's action, person, tick and adapter provenance match and that the SQL migration is applied. Prefer delayed benefit assessment for social encounters rather than assuming `successful=true`.
