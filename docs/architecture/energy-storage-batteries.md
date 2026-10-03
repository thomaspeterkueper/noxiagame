# Environment-aware battery storage

Implements #368.

NOXIA uses one cross-body storage abstraction:
chemistry -> pack -> BMS/thermal system -> installed storage asset.

The same model applies on Earth, Moon, Mars, asteroids and stations. Environment changes parameters; celestial bodies do not get bespoke battery rules.

## State
installed_capacity; usable_capacity; SOC; SOH; continuous_power; peak_power; charge_limit; discharge_limit; temperature; thermal_control_power; reserve_SOC; cycle/calendar degradation.

## Consequences
Cold soak can require heating before full charge/discharge power. High temperature accelerates degradation where applicable. Safety architecture, mass and thermal hardware reduce cell-to-pack performance. Replacement, recycling and logistics affect operating cost.

## Progression
Chemistries unlock as research/industry capabilities, but none is a universal tier upgrade. LFP, NMC-family, sodium-ion and future systems occupy different mission niches. Hybrid/multi-chemistry systems are allowed only when supported by Engineering bounds.

## UX
Expose automatic presets (mobile high-energy, stationary long-life, cold-environment, high-power) to avoid micromanagement. Advanced players may inspect chemistry, SOC/SOH and thermal limits. Economy and vehicles consume pack-level values, never raw marketing cell figures.
