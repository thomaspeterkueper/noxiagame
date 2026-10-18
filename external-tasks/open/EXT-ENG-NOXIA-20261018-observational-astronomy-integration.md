# EXTERNAL TASK — Consume observational astronomy instrument authority

- **Origin:** KUEPER Engineering
- **Target:** NOXIA Game
- **Date:** 2026-10-18
- **Status:** open
- **Engineering authority:** `ENG-AUTH-ASTRO-OBS-0001`

## Request

Integrate the Engineering observation contract into gameplay without exposing hidden physical truth.

Required behavior:

- consume measured products / derived estimates rather than hidden world parameters;
- support F0/F1 gameplay projection for optical/IR imaging, transit photometry, spectroscopy, radial velocity, astrometry and radio observations;
- retain uncertainty, provenance, quality flags and calibration state;
- do not grant unlimited precision from longer integration;
- distinguish angular resolution from astrometric precision;
- represent ECM-compatible radio signatures as candidate mechanisms, not confirmed truth;
- keep credits, ticks, progression and UI in NOXIA.

## Acceptance

- hidden ground truth is never required in client-visible observation payloads;
- missing coverage/geometry/calibration fails as unresolved or low-quality rather than returning truth;
- repeated identical observations with the same systematic ambiguity do not count as independent confirmation;
- authority reference is retained in observation metadata.
