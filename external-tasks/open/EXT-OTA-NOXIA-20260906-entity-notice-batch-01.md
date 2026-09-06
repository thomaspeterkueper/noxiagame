# EXT-OTA-NOXIA-20260906 — Entity Notice Batch 01

Quelle: `SYS:KUEPER:ota`  
Ziel: `thomaspeterkueper/noxiagame`  
Status: open  
Datum: 2026-09-06  
Typ: **Existenz-/Discovery-Hinweis, kein automatischer Gameplay-Import**

## Anlass

OTA führt ab 2026-09-06 eine Entity-Notification-Regel: Jede OTA-Entität mit explizitem NOXIA-Bezug wird NOXIA gemeldet, damit das Spiel weiß, dass die Entität existiert und auf welche kanonische Quelle bzw. offenen Engineering-Arbeiten es sich beziehen kann.

Dieser erste Batch umfasst die zuletzt evidenzseitig bereinigten bzw. neu strukturierten technischen Entitäten.

## Entity Notices

| OTA | canonicalId / objectId | Rolle für Discovery | OTA-Status | Hinweis |
| --- | --- | --- | --- | --- |
| `OTA-TEC-0028-2048-DE` | canonicalId noch nicht separat gesetzt; Dokument-ID stabil | technology/reference | AKTIV | Geometrische/Einmaterial-Dioden als Technologiepfad; reale Mechanismen von fiktiver 2048-Weiterentwicklung getrennt. Engineering-Request zur Gerätearchitektur offen. |
| `OTA-TEC-0082-2026-DE` | `OTA-TEC-0082-CYGNUS-CTV` / `cygnus-ctv-cislunar-transferschiff` | buildable | AKTIV | CYGNUS CTV. Massen-/Delta-v-Konflikt weiterhin `[F/OFFEN]`; Engineering-Mass-Closure offen. |
| `OTA-TEC-0085-2026-DE` | `OTA-TEC-0085-RL25` / `rl-25-hydrolox-triebwerk` | component | ENTWURF | RL-25-Klasse, 450 kN @ 465 s als fiktionale Setzung; Engineering-Closure offen. |
| `OTA-TEC-0088-2026-DE` | `OTA-TEC-0088-MEDICAL` / `mars-medical-center` | buildable | ENTWURF | Mars Medical Center; capability-basiert, keine linearen Betten-/Personalwerte. Engineering-Closure offen. |
| `OTA-TEC-0089-2026-DE` | `OTA-TEC-0089-FAB` / `mars-fabrication-center` | buildable | ENTWURF | Mars Fabrication Center; Herstellbarkeit, Feedstock und Freigabefähigkeit getrennt. Engineering-Closure offen. |
| `OTA-TEC-0090-2026-DE` | `OTA-TEC-0090-ROUTES` / `mars-fahrwege-korridore` | infrastructure | ENTWURF | Mars-Fahrwege; kein universeller Road-to-Rail-Crossover. Engineering-Trade offen. |
| `OTA-TEC-0091-2026-DE` | `OTA-TEC-0091-UTIL` / `mars-utility-corridor` | infrastructure | ENTWURF | Mars Utility Corridor; getrennte Medien-/Fehlerdomänen, quantitative Auslegung offen. |
| `OTA-TEC-0092-2026-DE` | `OTA-TEC-0092-PIONEER-COMBI` / `fruehphase-kombifahrzeug-pionierklasse` | buildable | ENTWURF | Pioneer-Kombifahrzeug; Missions-, Masse-, Betankungs-, Antriebs- und Abort-Architektur in Engineering. |
| `OTA-TEC-0093-2026-DE` | `OTA-TEC-0093-LSCORE` / `life-support-kernmodul` | component | ENTWURF | ECLSS-Technologiefamilie, keine identische Hardware für alle Fahrzeuge/Stationen; Engineering-Variantenfamilie offen. |

## Erwartete NOXIA-Reaktion

Für jede Entität bitte zunächst nur entscheiden bzw. registrieren:

- bereits im Spiel vorhanden / noch nicht vorhanden;
- bestehende Runtime-ID oder Mapping;
- Rolle: buildable, component, infrastructure, technology, knowledge/reference oder vorerst nur discovery;
- ob bestehende NOXIA-Daten dem aktuellen OTA-Status widersprechen;
- ob ein konkreter Implementierungsrequest nötig ist.

## Wichtige Grenze

**Keine** offenen OTA-/Engineering-Werte automatisch in Kosten, Produktionsraten, Unlocks, Kapazitäten oder Balancing übersetzen.

NOXIA bleibt Source of Truth für Gameplay. OTA ist hier Quelle für Identität, Kanonstatus und fachliche Grenzen.

## Rückmeldung

Nach Triage bitte einen Rückrequest an OTA erzeugen, falls:

1. eine Entität im Spiel bereits unter einer konkurrierenden ID existiert;
2. alte Werte dem aktuellen OTA-Kanon widersprechen;
3. NOXIA eine zusätzliche kanonische Information von OTA benötigt;
4. ein Engineering-Return später relevante Spielparameter verändert.
