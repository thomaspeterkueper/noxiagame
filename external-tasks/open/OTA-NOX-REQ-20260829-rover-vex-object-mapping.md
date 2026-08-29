---
id: OTA-NOX-REQ-20260829-ROVER-VEX-MAPPING
requester: SYS:OTA:overtimearchive
target: SYS:KUEPER:noxia
priority: high
type: integration-mapping
created: 2026-08-29
status: open
affects: [NOXIA, OTA]
---

# Erkundungsrover Typ P und VEX-47 an OTA-Technikobjekte anbinden

## Kanonische Objekte

### Erkundungsrover Typ P

- Dokument: `DOC:OTA:OTA-TEC-0036-2026-DE`
- `canonicalId: OTA-TEC-0036-ROV-P`
- `objectId: erkundungsrover-mond-typ-p`
- OTA-Mapping-Rolle: `buildable`

### VEX-47 Explorationsdrohne

- Dokument: `DOC:OTA:OTA-TEC-0037-2026-DE`
- `canonicalId: OTA-TEC-0037-VEX-47`
- `objectId: vex-47-explorationsdrohne-basistyp`
- OTA-Mapping-Rolle: `buildable`
- dokumentierte Einzelinstanz: `vex-lain-einheit-01` / `OTA-TEC-0037-INST-01`

## Auftrag an NOXIA

1. Stabile lokale Spielobjekt-Bindungen an beide `objectId`s vorsehen bzw. bereits vorhandene Entsprechungen darauf abbilden.
2. Die Herkunft aus den jeweiligen `DOC:OTA:*`-Dokumenten maschinenlesbar referenzieren.
3. Baukosten, Bewegungswerte, Reichweiten, Unlocks, Overlays, Journeys und Ereignisgewichte lokal halten.
4. Reale OTA-[R]/[H]-Werte nicht unbesehen als Balancingwerte kopieren.
5. Bei späteren Evidenzkorrekturen nur einen Impact-Hinweis erzeugen; niemals automatische Balancingänderungen durchführen.
6. Für VEX-47 strikt `TYPE` und `INSTANCE` trennen: Eigenschaften, Schäden, Modifikationen und emergentes Verhalten von `vex-lain-einheit-01` dürfen nicht auf den Basistyp oder andere VEX-47-Einheiten vererbt werden.

## Aktuelle Evidenzprüfungen

- `RES-20260829-TEC0036A` — Mondrover: Traktion, Thermik, Staub, Batterie/Life-Support, Druckrover-Plausibilität
- `RES-20260829-TEC0037A` — VEX-47: ausschließlich reale Sensor- und Umweltanker; kein Versuch, Casimir-Drift oder andere fiktionale Technik zu validieren

## Akzeptanz

- Eindeutige lokale Bindung beider Spielobjekte an ihre OTA-Objektidentitäten.
- VEX-Typ und Vex-Instanz bleiben getrennte Datenklassen.
- Kanonwerte und Balancingwerte bleiben getrennt.
- Evidence-Updates können Impact signalisieren, ohne automatische Spielwertmutation.

## Blocker-Analyse 2026-08-29

Der Stale-Task wurde aktiv untersucht. Im aktuellen NOXIA-`main` existiert weder im Building-Katalog noch in den vorhandenen Ship-/Game-Domänen eine bereits etablierte lokale Spielobjekt-Entsprechung für einen Bodenrover oder eine Explorationsdrohne. Anders als beim Wasserextraktor kann daher keine bestehende NOXIA-Entität rein deklarativ mit OTA-Provenienz versehen werden.

Eine Umsetzung würde mindestens eine neue lokale Fahrzeug-/Drohnen-Objektklasse oder eine Entscheidung verlangen, ob Rover/VEX als Building, Ship, Journey-Asset oder eigenständige Entity modelliert werden. Diese Zuordnung ist eine NOXIA-Architekturentscheidung und wird hier nicht erfunden. Ebenso werden keine Bau-, Bewegungs-, Reichweiten- oder Unlockwerte vorweggenommen.

**Konkreter nächster Schritt:** NOXIA muss zuerst festlegen bzw. bereits separat spezifizieren, welche bestehende oder neue lokale Objektklasse Rover und autonome Explorationsdrohnen trägt. Sobald diese lokale Klasse/ID vorhanden ist, ist die OTA-Provenienzbindung einschließlich `TYPE`/`INSTANCE`-Trennung technisch eindeutig und kann ohne Kanon- oder Balancingänderung umgesetzt werden.
