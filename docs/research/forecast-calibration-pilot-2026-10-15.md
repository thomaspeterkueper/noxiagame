# NOXIA forecast calibration pilot
Status: research-only, no runtime integration.
Primary research: Guan et al., Nature 2026, DOI 10.1038/s41586-026-11126-x.

Initial implementation: lib/research/forecast/calibrationPilot.ts and calibrationPilot.test.ts.
This is a simple constant-bias baseline, **not** an implementation of the paper's probabilistic bias correction. It uses historical training ticks and later held-out evaluation ticks; reports MAE before/after correction. The synthetic test demonstrates mechanics only, not a measured improvement in real NOXIA predictions.

Next: choose a genuine forecast target and observations, forward-chaining validation, climatology and persistence baselines, proper probabilistic scores, uncertainty calibration, runtime and database cost. No production use without backtest and rollback.
