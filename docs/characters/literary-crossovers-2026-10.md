# Literarische Figuren: Aristeas Lux, Xerxes, Mr. Marx — Intake 2026-10-09

Status: **Quellengebundene Kandidatenregistrierung, nicht live gespawnt.**

Die Einbindung verwendet die bestehende `CanonicalCharacterRef`-Brücke (siehe `docs/canonical-character-bridge.md` und `lib/game/population/canonicalCharacter.ts`), nicht ein alternatives NPC-System. Initiale Einträge: `lib/game/population/literaryCharacterIntake.ts`.

## Aristeas Lux
Beleg: Drive-Dokument `Charakter Aristeas Lux.docx`. Geistiger Abenteurer, Erzähler und Rätseldeuter; versucht philosophische, symbolische und hermeneutische Deutungen. Gewünschte Rolle: Vertreter des DaVaRu. Frühere Entwurfsfassung überbetonte Klang/Frequenz; dies ist ausdrücklich keine feste Fähigkeit oder bevorzugte Ontologie. Interpretation und überprüfte Erkenntnis im Spiel stets trennen.

## Xerxes
Beleg: Drive `OTA-LIT-0004-2026.docx` zum Zyklus `Das Gefälle`, Buch 1 `XERXES` (68–72 V.Ä.). Xerxes versteht Mishkenaz, spricht es nicht vollständig; Vârun-Gemeinschaft und Velun sind Teil des Quellenkontexts. Wünsche: als tatsächliche Buchfigur in NOXIA leben lassen, allerdings keine willkürliche Zeitsynchronisation. Vor Spawn kanonische Datierung, Alter und Ort überprüfen. Bücherkanon bleibt unberührt von emergenter Simulation.

## Mr. Marx
Beleg: Drive `Liv Dawn - der Plan funktioniert - noch.docx`. YoSunVR-Zentrale und Büro von Mr. Marx; befasst sich in einer Szene mit Liv Dawn. Gewünschte Integration: CEO. Firmenzuordnung, Beteiligungen, Verfügbarkeit und Berechtigungen in NOXIA müssen vor Live-Simulation explizit an vorhandene Corporation-/Ökonomiesysteme gebunden werden. CEO ist kein pauschaler Adminstatus.

## Vor Aktivierung
1. Vergleiche Live-Personen und kanonische Einträge, um Duplikate zu vermeiden.
2. Lege kanonische `canonSourceRef` und `canonRevision` nur anhand verifizierter ORE-Referenzen fest; Drive-Link ist zunächst Quelle, keine erfundene ORE-ID.
3. Ort, Erscheinungsbild, Lebensphase und Zeitachse vom Kanon ableiten bzw. beim NOXIA-Eintritt nachvollziehbar festlegen; keine ungeprüften Fakten erfinden.
4. Erst dann Person + `CanonicalCharacterRef` mit idempotentem Migrations-/Onboardingpfad anlegen.
5. Keine privilegierte Weltkenntnis; Gesprächs- und Religionsmechaniken greifen nur auf tatsächlich verfügbare Informationen zu.
6. Kosten: keine generierten Bilder oder LLM-Dialoge bei jedem Tick; Porträts nach Freigabe einmalig erzeugen und referenzieren.

## Teststatus
Wissensübertragung (A→B→C) ist als Test im Repository; erfolgreiche Ausführung in CI/Laufzeit ist noch nicht nachgewiesen. Quellenregistrierung wurde auf GitHub geschrieben und nachgelesen.
