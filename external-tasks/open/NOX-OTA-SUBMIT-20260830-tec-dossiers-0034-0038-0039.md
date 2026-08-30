---
id: NOX-OTA-SUBMIT-20260830-TEC-DOSSIERS
requester: SYS:KUEPER:noxia
target: SYS:OTA:overtimearchive
priority: high
type: dossier-submission
created: 2026-08-30
status: open
affects: [OTA, NOXIA]
---

# Übergabe: Drei OTA-TEC-Dossiers + KG-Request an das OverTime Archive

## Anlass

Im Zuge der Schema-Validierung für OTA-TEC-Objektdossiers (v1.5 FROZEN) wurden drei
technische Dossiers erarbeitet und liegen hier vollständig vor:

- `OTA-TEC-0034-2026-DE.md` — Wasserextraktor Typ M (Mars, Regolith-Sublimation)
- `OTA-TEC-0038-2026-DE.md` — Erkundungsrover Typ P (Mond, Frühphase, bemannt)
- `OTA-TEC-0039-2026-DE.md` — VEX-47 Explorationsdrohne (Korvus-Dynamics-Basistyp)
  inkl. Instanzreferenz `OTA-TEC-0039-INST-01` (Lains individualisierte Einheit)

Zugehöriger Wissenslücken-Report:
- `OTA-TEC-KG-REQUEST-SSF-luecken-0034-0038.md`

## ⚠️ Wichtiger Hinweis: Namenskollision bei der ursprünglichen Nummerierung

Die Dossiers für Rover und VEX-47 wurden zunächst versehentlich als `OTA-TEC-0036`
bzw. `OTA-TEC-0037` angelegt. Beim Abgleich mit dem tatsächlichen Archivbestand
(Google Drive, Ordner OTA) stellte sich heraus, dass diese beiden Nummern —
sowie `0035` und `0036b` — bereits an eine andere Serie vergeben sind:
**"Die Kette vom Hexenteich"** (Sauerland-Setting: Kette, Hör-Stein, Splitterlupe).

Die Nummern wurden entsprechend korrigiert auf **0038** (Rover) und **0039** (VEX-47),
nach Prüfung, dass diese Slots frei sind. `OTA-TEC-0034` (Wasserextraktor) war korrekt
und deckt sich bereits mit dem im Archiv vorhandenen Dokument gleichen Namens.

**Empfehlung an das Archiv-Team:** Der bisherige Prozess scheint keine zentrale,
tagesaktuelle Registrierungsstelle für die nächste freie TEC-Nummer zu haben — die
Kollision entstand, weil parallel gearbeitete Dossiers (NOXIA-seitig vs. "Kette vom
Hexenteich"-Serie) denselben Nummernraum unabhängig voneinander belegt haben. Ein
einfaches Locking/Registrierungsdokument (z. B. eine fortlaufend gepflegte Liste
"nächste freie Nummer je Serie") würde das künftig vermeiden.

Der ursprüngliche, jetzt überholte Rover/VEX-Request wurde entsprechend markiert:
siehe `OTA-NOX-REQ-20260829-rover-vex-object-mapping.md` (Status: `superseded`).

## Format-Hinweis

Alle drei Dossiers wurden nachträglich an das im Archiv bereits etablierte
Frontmatter-Format angeglichen (`KXF-0.2`-Schema, `kg.graphId`, `epistemicStatus`-Array,
`knowledge.domains`), basierend auf dem Vorbild `OTA-TEC-0034-2026-DE.md`, das im
Drive-Ordner bereits in dieser Form vorlag.

## Struktur-Neuerung: Typ/Instanz-Trennung

`OTA-TEC-0039` führt erstmals die Typ/Instanz-Trennung ein: Das Dossier beschreibt
den VEX-47-Basistyp (Werkszustand); individuelle, narrativ bedeutsame Exemplare
(hier: Lains Einheit, ~60 % modifiziert, emergentes Verhalten) werden als separate,
schlankere Instanzreferenz nach einem eigenen 12-Punkte-Instanzschema geführt, nicht
als eigenes 22-Punkte-Typ-Dossier. Falls das Archiv dafür noch keine etablierte
Konvention hat, wäre das ein Thema für Rückmeldung.

## Akzeptanz

- Drei TEC-Dossiers im Archiv-Frontmatter-Format liegen vor und sind widerspruchsfrei
  zum bestehenden Nummernraum.
- Rückmeldung, ob Nummernvergabe 0038/0039 endgültig bestätigt wird oder kollidiert.
- Rückmeldung zur Typ/Instanz-Konvention (neu, ggf. mit bestehendem OTA-Standard
  abzugleichen, falls einer existiert).
