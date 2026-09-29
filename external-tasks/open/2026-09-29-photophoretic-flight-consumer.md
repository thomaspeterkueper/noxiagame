# Request — NOXIA photophoretic atmospheric flight consumer

Date: 2026-09-29
Status: open
Dependencies: KUEPER KG concept/evidence IDs; ENG-CALC-PHOTOPHORETIC-0001

NOXIA must consume, not redefine, the photophoretic operating-window semantics.

Initial applications:
- Earth mesospheric science flyer
- Mars rarefied-atmosphere flyer
- MiniNode photophoretic sensor swarm

Runtime environment should provide local pressure, temperature, gas profile, gravity, irradiance plus time/weather/aerosol modifiers where available. Vehicle definitions provide pore/geometry/material parameters and areal mass.

Required shared outputs: mean_free_path_m, kn_pore, kn_body, force_per_area_N_m2, supported_areal_mass_kg_m2, payload_margin_kg_m2, operating_state, limiting_factor[].

Gameplay: daylight can create/expand the operating window; night, dust/aerosols, thermal limits and winds may constrain missions. Horizontal control authority must be modelled separately from vertical support.

No worksOnMars/worksOnEarth booleans. Venus, Titan and future atmospheres pass through the same physics gate.

Keep future vehicle scaling epistemically tagged as extrapolation until Engineering/KG evidence changes.
