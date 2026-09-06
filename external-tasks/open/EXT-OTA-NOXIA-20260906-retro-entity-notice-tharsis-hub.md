# EXT-OTA-NOXIA-20260906 — Retroactive Tharsis Hub Entity Notice Batch

Quelle: `SYS:KUEPER:ota`  
Ziel: `thomaspeterkueper/noxiagame`  
Status: open  
Datum: 2026-09-06  
Typ: **rückwirkender Existenz-/Provenienz-Hinweis, kein automatischer Gameplay-Import**

## Anlass

Die OTA→NOXIA Entity-Notification-Regel gilt rückwirkend. Die Tharsis-Hub-Dossiers `OTA-TEC-0094` bis `OTA-TEC-0107` wurden bereits als technische Objektgrenzen bzw. verbindliche Querschnittsreferenzen des Startlayouts erstellt und im OTA-Coverage-Report NOXIA-Typen zugeordnet. Dieser Batch macht diese Entitäten/Referenzen im NOXIA-Request-Eingang explizit sichtbar.

Referenz im OTA: `docs/noxia-building-object-coverage-20260901.md`.

## Entity Notices / bestehende Mappings

| OTA | NOXIA-Bezug | Rolle | Hinweis |
| --- | --- | --- | --- |
| `OTA-TEC-0094-2026-DE` | `reactor_module`, `black_start` | energy/reference | Primärenergie-/Black-Start-System; Spielwerte bleiben NOXIA. |
| `OTA-TEC-0095-2026-DE` | `water_isru` | infrastructure/reference | Wassergewinnungs-/Aufbereitungsstränge; nicht mit jedem generischen `ice_drill` gleichsetzen. |
| `OTA-TEC-0096-2026-DE` | `eclss_hub`, `oxygen_recycler` | infrastructure/reference | Regionale ECLSS-Knoten und Atmosphärenversorgung; Failover-Details sind Gegenstand eines separaten Klärungsrequests. |
| `OTA-TEC-0097-2026-DE` | `habitat_cluster`; Referenz für `habitat` / `residential_block` | habitat/reference | Tharsis-Habitatcluster sind abgedeckt; generische Gebäudeidentität bleibt davon getrennt. |
| `OTA-TEC-0098-2026-DE` | `radiator_field` | thermal/reference | Verteilte Thermalkontrolle/Radiatorfelder. |
| `OTA-TEC-0099-2026-DE` | `medical_core`, `medical_annex` | medical/reference | Medizinischer Kern und Emergency Annex als gemeinsame technische Systemgrenze. |
| `OTA-TEC-0100-2026-DE` | `reserve_depot`, `plant_module` | logistics/food/reference | Vorräte und Frischproduktion; Pflanzenmodul ist nicht automatisch Überlebensbasis. |
| `OTA-TEC-0101-2026-DE` | `workshop_clean`, `workshop_heavy`; Referenz für `factory` / `smelter` | fabrication/reference | Werkstatt-/Fertigungsfunktionen; generische Fabrik/Schmelze benötigen ggf. eigene Kanongrenze. |
| `OTA-TEC-0102-2026-DE` | `logistics_hub`, `landing_pad`, `warehouse` | logistics/reference | Lager-/Außenlogistik; Gameplaykapazitäten bleiben lokal. |
| `OTA-TEC-0103-2026-DE` | Oberflächenfahrzeug-Funktionsklassen | cross-cutting reference | Kein einzelnes Gebäude; verbindliche Fahrzeug-/Funktionsreferenz für Startlayout. |
| `OTA-TEC-0104-2026-DE` | `road`, landing-pad access | route/reference | Fahrwege/Außenlogistik; Tile-Regeln und Kosten bleiben NOXIA. |
| `OTA-TEC-0105-2026-DE` | Utility-Netze | utility/reference | Redundante Mediennetze/Versorgungskorridore; konkrete Medium-N-1-Topologie noch zu klären. |
| `OTA-TEC-0106-2026-DE` | `command_node`, `surface_relay`, `longrange_comms` | command/comms/reference | Verteilte Steuerung und Kommunikation ohne alleinigen Master. |
| `OTA-TEC-0107-2026-DE` | `material_complex` | recycling/reference | Reststoff- und Materialrückgewinnung. |

## Bekannte technische Coverage-Lücken

Der OTA-Coverage-Stand weist zusätzlich folgende NOXIA-Typen noch nicht als kanonisch abgedeckt aus:

- `mine`
- `solar`
- `laboratory`
- `scanner`

Als `ambiguous` gelten derzeit:

- `factory`
- `ice_drill`
- `habitat`
- `residential_block`
- `smelter`

NOXIA soll für diese Typen bis zur OTA/KG-Entscheidung keine scheinbar kanonischen OTA-IDs erfinden.

## Erwartete NOXIA-Triage

1. Bestehende Runtime-/Content-Typen mit den obigen OTA-Provenienzreferenzen abgleichen.
2. Bereits korrekte Mappings als `mapped` markieren.
3. Bei Widersprüchen oder fehlenden IDs einen gezielten Rückrequest an OTA erzeugen.
4. Offene/ambige Klassen nicht aus Spielwerten rückwärts kanonisieren.
5. Den separaten Tharsis-Seed-Clarification-Request für N-1/Failover/Safe-Haven/Energieannahmen weiterhin als eigene Architekturfrage behandeln.

## Source-of-Truth-Grenze

OTA: technische Objektgrenzen und Kanonstatus.  
NOXIA: Gameplay, Kosten, Bauzeiten, Produktion, Kapazitäten, Unlocks und Runtime.  
KUEPER Engineering: quantitative Auslegung, sofern die Klärung in echtes Engineering übergeht.  
KG: systemweite Identitäten/Relationen.
