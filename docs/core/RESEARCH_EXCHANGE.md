# NOXIA Research Exchange

This layer extends the cognitive runtime from individual/group research into reusable institutional knowledge.

A research group publishes a structured ResearchFinding. Other groups subscribe to evidence types relevant to their domain. Routing creates inbox records; it does not automatically turn a finding into truth. Recipient groups may review, adopt or later challenge it.

First dependency chain:

Chronobiology → temporal protocol finding → Plant Science / Life Support → adoption or challenge.

The producer does not receive its own finding. Confidence thresholds prevent weak findings from being silently adopted. Adoption points to the exact finding and protocol version, preserving provenance.

The implementation is deliberately provider-free. Cross-group reuse of an already-paid-for or deterministic conclusion must not require another LLM call.

Persistence adapters remain separate from this pure domain layer so Supabase/database authority can be added without coupling scientific reasoning to storage.
