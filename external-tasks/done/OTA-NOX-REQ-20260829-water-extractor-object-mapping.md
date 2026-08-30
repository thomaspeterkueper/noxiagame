---
id: OTA-NOX-REQ-20260829-WATER-EXTRACTOR-MAPPING
requester: SYS:OTA:overtimearchive
target: SYS:KUEPER:noxia
priority: high
type: integration-mapping
created: 2026-08-29
status: done
affects: [NOXIA, OTA]
---

# `wasserextraktor-mars-typ-m` an OTA-TEC-0034 anbinden

## Anlass

OTA führt mit `OTA-TEC-0034-2026-DE` erstmals ein kanonisches technisches Objekt, das explizit von NOXIA konsumiert wird.

Kanonische Dokumentidentität:

- `DOC:OTA:OTA-TEC-0034-2026-DE`
- `canonicalId: OTA-TEC-0034-WEX-M`
- `objectId: wasserextraktor-mars-typ-m`
- OTA-Mapping-Rolle: `buildable`

Das OTA-Dossier ist Source of Truth für den **fiktionalen technischen Zustand** des Wasserextraktors Typ M. Reale wissenschaftliche Grundlagen werden separat evidenzgeprüft. NOXIA besitzt weiterhin ausschließlich die daraus abgeleitete Spielrepräsentation und das Balancing.

## Auftrag an NOXIA

1. Eine stabile lokale Spielobjekt-Bindung an `objectId: wasserextraktor-mars-typ-m` vorsehen bzw. eine bereits existierende Entsprechung darauf abbilden.
2. Die Herkunft als `DOC:OTA:OTA-TEC-0034-2026-DE` maschinenlesbar referenzieren.
3. Spielwerte wie Baukosten, Produktionsrate, Unlocks, Reichweiten, Overlays, Journeys und Event-Gewichte lokal halten.
4. Keine OTA-[R]/[H]-Werte unbesehen als Balancingwerte kopieren.
5. Bei späteren OTA-Evidenzkorrekturen nur einen **Impact-Hinweis** erzeugen; niemals automatische Balancingänderungen durchführen.

## Aktueller Pilot

Die erste externe Evidenzprüfung läuft über zwei source-gepinnte Research-IDs:

- `RES-20260829-TEC0034A` — Thermodynamik, Energie, Mikrowellen-ISRU
- `RES-20260829-TEC0034B` — Eisressourcen, Overburden, Perchlorate, atmosphärisches Wasser

Diese Forschung darf den technischen OTA-Kanon nach Review präzisieren. Sie darf keine NOXIA-Spielwerte automatisch verändern.

## Akzeptanz

- Eindeutige lokale Bindung von NOXIA an `wasserextraktor-mars-typ-m`.
- Referenz auf `DOC:OTA:OTA-TEC-0034-2026-DE` ist nachvollziehbar.
- Kanonwerte und Balancingwerte bleiben getrennte Datenklassen.
- Evidence-Updates können als Impact signalisiert werden, ohne automatische Spielwertmutation.

## Umsetzung 2026-08-29

- Die bestehende NOXIA-`water_recycler`-Spielrepräsentation (Mars-only, Atmosphären-Kondensation) ist explizit an `wasserextraktor-mars-typ-m` gebunden.
- `sourceDocumentId`, `canonicalId`, `objectId` und Mapping-Rolle sind maschinenlesbar im Building-Katalog hinterlegt.
- Die neue Provenienzstruktur enthält absichtlich keine Kosten-, Produktions-, Unlock- oder sonstigen Balancingwerte.
- `evidenceImpactPolicy: signal-only` kodiert, dass spätere OTA-Evidenzänderungen nur als Impact behandelt werden dürfen und keine automatische Spielwertmutation auslösen.
- Die Bindung bleibt auf die Mars-only-Repräsentation beschränkt: Die `ice_drill` (Shackleton-Eis, Mond + Mars) ist bewusst ungebunden, damit spätere OTA-Evidenzimpacts zum Typ-M-Extraktor nicht auf Mond-Infrastruktur durchschlagen.
