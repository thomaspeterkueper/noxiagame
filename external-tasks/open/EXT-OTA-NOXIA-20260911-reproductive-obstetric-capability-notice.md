---
id: EXT-OTA-NOXIA-20260911-REPRODUCTIVE-OBSTETRIC-CAPABILITY-NOTICE
title: Schwangerschaft, Geburt und Neonatologie als eigenständige Siedlungs-Capability berücksichtigen
status: open
source: OTA
target: NOXIA
created: 2026-09-11
priority: medium
affects: [NOXIA, OTA, KG, KUEPER Engineering]
---

## Neue OTA-Evidenzentität

- `sourceDocumentId`: `OTA-SCI-0086-2026-DE`
- `canonicalId`: `DOC:OTA:OTA-SCI-0086-2026-DE`
- Rolle: wissenschaftliche Read-only-Referenz
- Status: `ENTWURF`
- Thema: Schwangerschaft, Geburt und frühe Entwicklung unter Mikro- und Teilgravitation

## Bedeutung für NOXIA

Langfristige Mond-, Mars- und Stationssiedlungen benötigen reproduktive/geburtshilfliche und neonatale Versorgung als eigene Capability. Diese darf nicht stillschweigend in einem generischen `medical center` oder einem einfachen Population-Growth-Wert verschwinden.

Die reale Evidenz liefert 2026 **keine** validierten menschlichen Schwellen für sichere Schwangerschaft bei Mikrogravitation, Mondgravitation (~0,16 g) oder Marsgravitation (~0,38 g). KUEPER Engineering bearbeitet die technische Architektur über `EXT-OTA-ENG-20260911-reproductive-obstetric-low-gravity-architecture.md`.

## Vorläufige NOXIA-Grenze

Bitte vor Engineering-Rückgabe **nicht** aus dem OTA ableiten oder neu erfinden:

- Fertilitäts- oder Geburtenraten;
- Schwangerschaftsdaueränderungen;
- Fehlgeburts-/Komplikationswahrscheinlichkeiten;
- ein minimales sicheres g-Niveau;
- automatische Boni durch künstliche Gravitation;
- konkrete Personal-, Raum-, Kosten- oder Build-Tick-Werte.

## Was NOXIA schon vorbereiten kann

Population lifecycle und Standort-Capabilities sollten perspektivisch ausdrücken können, ob ein Standort über getrennte Voraussetzungen verfügt für:

- allgemeine medizinische Versorgung;
- Schwangerschaftsmonitoring;
- Geburtshilfe / operative Geburt;
- Neonatalversorgung;
- geeigneten Strahlenschutz / Safe Haven;
- gegebenenfalls künstliche Gravitation.

Diese Capabilities können später aus OTA-/Engineering-Entitäten read-only referenziert werden. Gameplaywerte bleiben NOXIA-owned.

## Bestehender Bezug

`OTA-TEC-0088-2026-DE` — Mars Medical Center — ist der naheliegende Mars-Consumer. Seine geburtshilfliche/neonatale Systemauslegung ist noch nicht technisch geschlossen.

## Abnahme

Erledigt, wenn NOXIA `OTA-SCI-0086` als Evidenzreferenz kennt und die spätere Population-/Siedlungslogik reproduktive Versorgung als getrennte Capability aufnehmen kann, ohne wissenschaftlich unbelegte Zahlen als Kanon zu behandeln.