# Surface vehicle visual progress

The Earth cockpit may display a moving surface vehicle without introducing a second simulation clock.

Authoritative state remains in `transport_jobs`:

- `started_at` defines departure;
- `arrives_at` defines scheduled arrival;
- `route_snapshot.etaSeconds` and `route_snapshot.distanceKm` describe the validated mission;
- the Core transport status defines whether a job is preparing, moving, arrived, finished or failed.

`lib/game/vehicles/surfaceProgress.ts` is a read-only projection. It interpolates progress only while Core status is `in_transit`, clamps progress to `[0,1]`, and never mutates vehicle or job state.

The Earth tracker refreshes authoritative Core state periodically while animating the player-facing progress locally between refreshes. Arrival, unloading and completion still come exclusively from Core/tick settlement.

This is intentionally geometry-independent. A later route-polyline extension can map the same normalized progress onto real Earth/Moon route geometry without changing the transport state machine.
