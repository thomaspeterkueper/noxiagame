# EXT-OTA-NOXIA-20260906 — Retroactive Technical Entity Notice Batch

Quelle: `SYS:KUEPER:ota`  
Ziel: `thomaspeterkueper/noxiagame`  
Status: open  
Datum: 2026-09-06  
Typ: **rückwirkender Existenz-/Discovery-Hinweis, kein automatischer Gameplay-Import**

## Anlass

Die am 2026-09-06 eingeführte OTA→NOXIA Entity-Notification-Regel gilt auch rückwirkend. Dieser Batch meldet NOXIA-relevante technische OTA-Entitäten, die vor Einführung der Regel bereits existierten bzw. in den zuletzt bearbeiteten Dossiers als direkte Systemabhängigkeiten auftreten und im ersten Entity-Notice-Batch noch nicht enthalten waren.

## Entity Notices

| OTA | Identität | Rolle für Discovery | OTA-Status | Hinweis |
| --- | --- | --- | --- | --- |
| `OTA-TEC-0016-2063-DE` | Helios KITE-Shuttle | vehicle/buildable | AKTIV | Kanonisches KITE-Shuttle; verbunden mit ECLSS-Survival-Architektur. Keine offenen Engineering-Zahlen automatisch ins Balancing übernehmen. |
| `OTA-TEC-0019-2091-DE` | ECLSS Survival-Protokolle / KITE | operations/safety reference | AKTIV | KITE-Notfall-SOP; reale ECLSS-Anker von KITE-spezifischen Operationsschwellen getrennt. Engineering-Survival-Closure offen. |
| `OTA-TEC-0025-2050-DE` | Cislunares Transportsystem | system/infrastructure reference | AKTIV | System-/Ökonomiequelle für CYGNUS/Gateway/PELICAN-Weltsetzung. Einzelwerte nicht ungeprüft als Gameplay-SSOT verwenden. |
| `OTA-TEC-0027-2091-DE` | ASCE-Shuttle System | vehicle/buildable | AKTIV | Historischer kanonischer OTA-Stand; laufende technische Entwicklung liegt in `kueper-engineering`. Gameplay erst nach späterem Canonicalization-Return aktualisieren. |
| `OTA-TEC-0029-2048-DE` | Quantensensorik & KI-Integration für LOD-Validierung | technology/reference | AKTIV | NOXIA-relevanter Technologiepfad; reale Sensorikanker und fiktionale AVI-/Netzwerkannahmen strikt trennen. |
| `OTA-TEC-0034-2026-DE` | `OTA-TEC-0034-WEX-M` / `wasserextraktor-mars-typ-m` | buildable | AKTIV | Kanonischer NOXIA-Wasserextraktor Typ M; ISRU-Evidenz und Gameplaywerte getrennt. |
| `OTA-TEC-0036-2026-DE` | `OTA-TEC-0036-ROV-P` / `erkundungsrover-mond-typ-p` | buildable | AKTIV | Kanonischer bemannter Pioneer-Rover für frühe Mondkolonisation. |
| `OTA-TEC-0083-2026-DE` | `OTA-TEC-0083-STARPORT` / `starport-launcher-erde-orbit-traeger` | buildable | AKTIV | Erde-Orbit-Träger der 2040er; Bestandteil der cislunaren Transportkette. |
| `OTA-TEC-0084-2026-DE` | `OTA-TEC-0084-PELICAN` / `pelican-lunar-shuttle` | buildable | AKTIV | Mond-Oberflächenzugangsfahrzeug; Bestandteil der späteren CYGNUS/Gateway/PELICAN-Architektur. |
| `OTA-TEC-0086-2026-DE` | Wasseraufbereitungsanlage / bestehender NOXIA-Ref `BLD:NOX:wasseraufbereitung-1` | infrastructure/buildable | ENTWURF | Bestehende NOXIA-ID bereits im OTA referenziert; bitte Mapping und aktuellen Spielstand gegen OTA prüfen. |
| `OTA-TEC-0087-2026-DE` | `OTA-TEC-0087-GATEWAY` / `gateway-station-eml2` | station/buildable | ENTWURF | Cislunarer Umschlagpunkt; Verkehrsarchitektur und quantitative Infrastrukturwerte weiterhin offen. |

## Erwartete NOXIA-Triage

Für jede Entität bitte feststellen:

- existiert sie bereits im Spiel und unter welcher Runtime-/Content-ID;
- stimmt das Mapping mit OTA-Signatur, `canonicalId` bzw. `objectId` überein;
- ist sie buildable, component, infrastructure, vehicle, technology/reference oder zunächst nur discovery;
- stehen bereits implementierte Gameplaywerte im Widerspruch zum aktuellen OTA-Kanon;
- benötigt NOXIA einen gesonderten Implementierungs- oder Rückfrage-Request.

## Source-of-Truth-Grenze

OTA meldet Identität, Kanonstatus und fachliche Grenzen. NOXIA bleibt Source of Truth für Gameplay, Kosten, Unlocks, Produktionsraten, Kapazitäten und Balancing. Engineering-Arbeitswerte dürfen erst nach explizitem OTA-Canonicalization-Return zu kanonischen Spielgrundlagen werden.
