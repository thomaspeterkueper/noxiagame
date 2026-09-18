# Reactor Runtime E2a

## Zweck

E2a ergänzt den kanonischen NOXIA-Core um einen autoritativen Betriebszustand für Reaktormodule. Der Betriebszustand nutzt den bestehenden `simulation_events -> entity_states`-Pfad und erzeugt **keine zweite Reactor-State-Tabelle**.

## Authority Boundary

Physische Reactor-Identität und Einbauort bleiben in `tile_entities`. Nominale Leistung bleibt kanonische Engineering-Metadaten (`tharsisHubSeed`). E2a besitzt ausschließlich den zeitabhängigen Betriebsmodus:

- `unknown` — Betriebszustand ist ausdrücklich nicht bekannt; `availabilityFactor = null`.
- `online` — volle betriebliche Verfügbarkeit; `availabilityFactor = 1`.
- `derated` — bekannte Teilverfügbarkeit; `0 < availabilityFactor < 1`.
- `offline` — bekannte Nichtverfügbarkeit; `availabilityFactor = 0`.

Der Runtime-State speichert weder `nominalPowerMw` noch `availablePowerMw`. Verfügbare MW sind eine Projektion aus Engineering-Nennleistung × autoritativem Availability-Faktor.

## Command

`public.noxia_set_reactor_runtime(...)` ist ein server-only `SECURITY DEFINER`-Command. Direkte Ausführung für `anon` und `authenticated` ist entzogen; `service_role` ist die Ausführungsgrenze.

Ein erfolgreicher Command schreibt atomar:

1. ein unveränderliches `simulation_events`-Event `reactor.runtime.changed`;
2. das Ende des vorherigen `entity_states`-Intervalls für `subject_type = reactor_runtime`;
3. genau einen neuen Current-State für denselben Reaktor.

`command_id` liefert stabile Idempotenz- und Effect-Group-Identität. Gleiche Command-ID + gleicher Request ist idempotent; Wiederverwendung derselben ID mit anderem Inhalt ist ein Konflikt.

## Fail-closed

Ein fehlender Reactor-Runtime-State bedeutet **nicht** offline und **nicht** online. Die Read-Projektion hält `availablePowerMw` so lange `unresolved`, bis jeder betrachtete Reactor genau einen gültigen, bekannten Current-State und eine kanonische Nennleistung besitzt.

Auch nach vollständig beobachteter Reactor-Verfügbarkeit bleiben `firm_energy` und `grid_capacity` getrennte, ungelöste Größen, bis Last, Reservepolitik, Speicher und Netz-Durchsatz/Betriebszustand autoritativ modelliert sind.
