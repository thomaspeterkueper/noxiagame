# NOXIA CR-01 Stage 1 — LDraw import prototype

This is the first machine-readable construction file for the CR-01 Cargo Rover.

## File

`noxia_cr01_stage1.mpd`

## Purpose

The file contains only the Stage-1 structural chassis:

- two longitudinal 15L Technic rails,
- two 11L rear extensions,
- four 5×7 Technic frames,
- short structural brace/hardpoint markers,
- four temporary cargo-interface markers.

It intentionally does **not** include wheels, body panels, cargo deck, front sensor module, or rear service module yet.

## Important validation status

This is a **first-pass LDraw geometry**, not yet a collision-certified BrickLink Studio model.

The file is useful for the next test:

1. Import/open in BrickLink Studio.
2. Confirm that every referenced LDraw part resolves.
3. Inspect rail/frame orientation.
4. Check whether the 5×7 frames intersect or miss the longitudinal rails.
5. Check whether the rail extension overlap is physically pin-compatible.
6. If Studio reports collisions or visibly wrong origins, capture a screenshot or describe the affected part.

The main uncertainty is not the LDraw syntax but the exact origin/orientation conventions of the individual Technic parts. Those are easiest to close with one Studio import-feedback cycle.

## LDraw parts referenced

- `32278.dat` — Technic beam 1×15 thick
- `32525.dat` — Technic beam 1×11 thick
- `64179.dat` — Technic frame 5×7
- `32316.dat` — Technic beam 1×5 thick
- `32523.dat` — Technic beam 1×3 thick

## Why Stage 1 only?

A small import test is more useful than a 200+ part model whose errors are hard to isolate. Once the chassis geometry is confirmed, the same file can be extended with reusable wheel-module, cargo-module, front-module, and rear-module submodels.
