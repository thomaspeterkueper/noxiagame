# MiniNodes agent safety research
Status: proposed; no runtime changes.
Context: NVIDIA UK agentic safety compute commitment announced 2026-10-14.
Design constraints: per-node least privilege, explicit human authorization for external effects, bounded task fan-out, quotas, audit lineage, isolated test environment, and emergency stop. Distinguish planning from execution and block autonomous deployment/replication by default.
Tests needed: unauthorized delegation, stale credentials, retry storms, cross-node data leakage, cancellation propagation and resource budget compliance.
