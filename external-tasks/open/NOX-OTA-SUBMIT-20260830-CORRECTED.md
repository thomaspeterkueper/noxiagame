---
id: NOX-OTA-SUBMIT-20260830-CORRECTED
status: resolved
supersedes: NOX-OTA-SUBMIT-20260830-tec-dossiers-0034-0038-0039
---

# Korrektur: Eigene Nummernprüfung war fehlerhaft (falscher Drive-Ordner)

Der ursprünglich unter diesem Vorgang eingereichte Hinweis auf eine Nummernkollision
bei OTA-TEC-0036/0037 beruhte auf der Prüfung des **falschen** Drive-Ordners.

**Fehler:** Geprüft wurde der ältere Ordner `OTA` (dort liegt "Kette vom Hexenteich"
auf 0035/0036/0036b/0037). Der tatsächlich maßgebliche, aktive Ordner heißt
`overtime-archive` (KXF-0.2-Schema, erstellt 2026-08-24). Dort belegt "Kette vom
Hexenteich" korrekt nur 0035; 0036 und 0037 sind frei und regulär für Rover/VEX-47
vergeben.

**Ergebnis:** Keine Kollision. Gültige Nummern:
- `OTA-TEC-0034` — Wasserextraktor Typ M (v1.1)
- `OTA-TEC-0036` — Erkundungsrover Typ P (v1.1)
- `OTA-TEC-0037` — VEX-47 Explorationsdrohne (v1.1)

Alle drei liegen im `overtime-archive`-Ordner bereits als v1.1-Fassungen vor,
wissenschaftlich verstärkt gegenüber den hier ursprünglich entwickelten v1.0-Ständen
(z. B. Tripelpunkt-Bezug beim Wasserextraktor, präzisierte Thermik beim Rover,
Medium-Abhängigkeit der Sensorik bei VEX-47). Diese v1.1-Fassungen gelten als
kanonisch. Die NOXIA-seitigen `objectId`-Mappings zeigen entsprechend auf 0034/0036/0037.

Die zwischenzeitlich unter 0038/0039 abgelegten Dossiers (siehe `external-tasks/done/`)
sind überholte Zwischenstände und werden nicht weiterverwendet.

**Lehre für künftige Nummernprüfungen:** Vor jeder Signaturvergabe im `overtime-archive`-
Ordner (nicht im älteren `OTA`-Ordner) prüfen. Ein zentrales Registrierungsdokument für
die nächste freie Nummer je Serie würde solche Fehlprüfungen künftig vermeiden.
