# EXT-OTA-NOXIA-20260911 — Gravity Biography System

**Status:** open  
**From:** OTA  
**To:** NOXIA  
**Date:** 2026-09-11

## Neue übergreifende OTA-Schicht

`OTA-SCI-0089-2026-DE — Human Adaptation by Gravity Environment`

Die Kernentscheidung lautet: Personen sollten langfristig nicht nur eine `homeWorld` besitzen, sondern eine **Gravitationsbiografie**.

## Zielmodell

Semantischer Kern:

```text
GravityBiography
  birthEnvironment
  developmentalEnvironment[]
  artificialGravityExposure
  transitionHistory[]
  adaptationState
  medicalRestrictions[]
  trainingState
```

Dies ist zunächst ein Capability-/Data-Model-Request, keine fertige Balancing-Vorgabe.

## Relevante Umgebungen

- Earth 1.00 g
- Luna ~0.16 g
- Mars ~0.38 g
- Ceres ~0.03 g
- microgravity
- rotating habitat / artificial gravity
- thrust gravity / time-variable ship profiles

## Relevante Life Stages

- prenatal
- neonatal
- infant
- child
- adolescent
- adult
- pregnancy
- aging

## Später mögliche Runtime-Folgen

Nur nach Engineering-/Canon-Closure:

- medizinische Reisefreigabe;
- Training vor g-Transitions;
- Rehabilitationszeiten;
- unterschiedliche Habitat-/Medical-Capability-Anforderungen;
- Pregnancy/Neonatal readiness;
- Pediatric development monitoring;
- Bewegung/Mobilität in fremder Gravitation;
- SSEP-/Passenger-Eligibility;
- temporäre Einschränkungen nach Transfers.

## Wichtige Grenze

OTA liefert **keine** Gameplay-Faktoren wie `0.38 g = 38 % health`, lineare Knochenverluste oder feste Fertilitätsmodifikatoren. Solche Werte wären wissenschaftlich nicht belegt.

NOXIA bleibt Source of Truth für Runtime, Kosten, Unlocks und Balancing.

## Abhängigkeiten

- `OTA-SCI-0086` Schwangerschaft/Geburt
- `OTA-SCI-0087` Kinder von Ceres
- `OTA-SCI-0088` Frachtergeburt
- offener Engineering-Request `EXT-OTA-ENG-20260911-human-adaptation-gravity-environment.md`

Bitte die Architektur so vorbereiten, dass spätere Engineering-Parameter ergänzt werden können, ohne Personen-/Savegame-Datenmodell erneut grundlegend umzubauen.