# NOXIA Memory Retrieval Benchmark — Protocol v0.1
Date: 2026-10-13. Status: proposed, no runtime change.

Reference: lib/research/memory/valueBenchmark.ts compares serialized bytes and mean absolute error, but does not measure retrieval cost.

Compare FULL, COMPRESSED and SELECTIVE under identical synthetic histories and independent held-out questions. For each, test exact lookup, top-k retrieval and hybrid lookup. Record storage bytes, retrieved bytes, query count, latency, CPU time, LLM tokens, predictive error, and critical/biographical recall. Missing measurements must be null rather than zero.

Keep provenance, corrections to earlier facts, temporal order and protected long-term memories. Separate warm and cold cache. Use multiple seeds and time horizons. Report Pareto fronts and failure cases. Avoid production data and runtime modifications.

Next gate: audit actual NOXIA persistence and retrieval paths before adding instrumentation; do not introduce extra database requests on hot paths. Distinguish server cost from thermodynamic energy.