# Sundern live readiness — 2026-11-06

Database inspected (NOXIA Supabase; read-only SQL):
- `locations.slug='earth'` is the global Earth location, id
  `08b6feff-e1d8-48d8-bb65-dbcff4490587`.
- No `locations` row named/slugged Sundern.
- `people` contains 65 records at inspection time.
- `person_surface_presence` supports `latitude_deg`, `longitude_deg`,
  `spatial_region_id`, `source_kind`, `source_ref` and `location_id`.
- Existing `person_parent_child`, `person_partnerships`,
  `person_memories`, `person_languages`, `person_needs` and
  `person_cognitive_state` tables can represent family and development.

## Activation gate (not yet passed)

1. Resolve an authoritative Sundern spatial region and permitted housing
   from existing Earth tiles/parcels/buildings; do not fabricate coordinates.
2. Inspect existing residents/households for duplicates before creating people.
3. Provision 16 people using a durable cohort key and idempotent transaction;
   avoid duplicate inserts on retries.
4. Create verified parent-child and household relationships, assign legal
   residential presence, and initialize language/needs/cognition.
5. Integrate the standard simulation tick, observation/audit events, and
   monitoring with clear administrative stop/restart controls.
6. Test in staging, then activate under an explicit cohort feature flag;
   validate population counts, spatial placement, and events after launch.

Current implementation: pilot definition, dry-run people mapping,
Omnizedenz read-only research annotations and test cases. No live writes,
no verified housing, no NPC tick activation. Do not interpret this
document as a production deployment record.
