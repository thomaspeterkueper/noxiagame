# NOXIA Request – Wasserextraktor Typ M im Spiel konsistent machen

Datum: 2026-11-01
Status: proposed
Priorität: mittel
Von: SSF / Lernvideo „Wasser auf dem Mars“
An: NOXIAGAME
Bezug: `OTA-TEC-0034-2026-DE` (`canonicalId: OTA-TEC-0034-WEX-M`, `objectId: wasserextraktor-mars-typ-m`), SSF-Modul `PHY-WASSER-VAKUUM-0001`

## Zweck

Das Lernvideo zum Wasserextraktor soll im Outro auf das Spiel verweisen („Im Spiel erlebbar“). Das geht erst, wenn das Spiel Typ M so zeigt, wie Dossier und Lernmodul ihn beschreiben. Derzeit ist Typ M baubar, aber unter einem anderen Namen und mit einem anderen Mechanismus.

## Befund

1. **Name und Beschreibung passen nicht zu Typ M.**
   `lib/game/buildings/index.ts`: `water_recycler` ist per `externalTechnicalObject` mit `OTA-TEC-0034-WEX-M` als `buildable` verknüpft, heißt aber „Wasserrecycler“ mit der Beschreibung „Atmosphären-Kondensation“. Typ M gewinnt Wasser aus eishaltigem Regolith über Erwärmung, Sublimation und Kondensationsfalle.

2. **Die Freischaltung läuft über das falsche Lernmodul.**
   `BLD:NOX:wasseraufbereitung-1` verlangt `UNL:NOX:water-processing`, und das setzt `LRN:SSF:CHE-1101` voraus (`lib/knowledge/data.ts`, `lib/knowledge/buildRequirements.ts`). Das Modul, das Typ M erklärt, ist `PHY-WASSER-VAKUUM-0001` mit dem Key `UNL:NOX:ISRU:WATER-EXTRACTION`. Dieser Key wird im Spiel bisher nicht ausgewertet.

3. **Kosten sind doppelt und widersprüchlich.**
   Katalog `lib/game/buildings/index.ts`: 2000 Credits, 2 Ticks. Build-API `app/api/game/build/route.ts`: 2500 Credits, 3 Ticks.

## Vorschlag (Entscheidung liegt bei NOXIAGAME)

- **Variante A – trennen:** `water_recycler` bleibt Recycler/Kondensation ohne OTA-Verknüpfung. Ein neues Gebäude `water_extractor_m` („Wasserextraktor Typ M“) bekommt die Verknüpfung zu `OTA-TEC-0034-WEX-M` und wird durch `UNL:NOX:ISRU:WATER-EXTRACTION` freigeschaltet.
- **Variante B – umbenennen:** `water_recycler` wird in Anzeige und Beschreibung zu „Wasserextraktor Typ M – Regolith-Sublimation“. Die Freischaltung akzeptiert zusätzlich `UNL:NOX:ISRU:WATER-EXTRACTION`.

In beiden Fällen: Kosten und Bauzeit an einer Stelle festlegen und von der Build-API lesen statt doppelt pflegen.

Hinweis zur Physik (kanonisch im KG seit 2026-11-01): Mars-Bodendruck im Mittel 6,36 mbar, jahreszeitlich 4,0–8,7 mbar – knapp am Tripelpunkt. Spieltexte sollten nicht „kein flüssiges Wasser möglich“ behaupten, sondern „Eis sublimiert meist direkt“.

## Abnahme

- Im Baumenü auf dem Mars ist „Wasserextraktor Typ M“ sichtbar, mit Beschreibung Regolith/Sublimation.
- Wer `PHY-WASSER-VAKUUM-0001` abgeschlossen hat, kann ihn bauen.
- Kosten und Bauzeit sind in Katalog und Build-API identisch.
- Danach Rückmeldung an SSF, damit das Video-Outro den Hinweis „Im Spiel erlebbar“ bekommt.
