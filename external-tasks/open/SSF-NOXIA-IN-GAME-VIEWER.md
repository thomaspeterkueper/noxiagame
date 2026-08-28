# SSF → NOXIA: In-Game-Lernviewer auf strukturierte Modul-API umstellen

**Status:** open
**Quelle:** Solar Science Foundation
**Ziel-Repository:** `thomaspeterkueper/noxiagame`
**Priorität:** hoch

## Anlass

SSF PR #18 ist umgesetzt und stellt NOXIA jetzt eine versionierte, strukturierte Modul-API bereit:

- `GET /api/noxia/modules`
- `GET /api/noxia/modules/{moduleId}`

Die Listen-API liefert jetzt u. a. `pathId` und `detailUrl`. Die Detail-API liefert den vollständigen strukturierten Lerninhalt ohne React-/HTML-Abhängigkeit.

NOXIA soll diese Schnittstelle jetzt tatsächlich im Spiel verwenden, damit Lernende die Akademie nicht mehr verlassen müssen.

## Gewünschte Änderung

Den bestehenden NOXIA-Akademie-/Lernflow auf die neue SSF-Modul-API umstellen und einen In-Game-Viewer bereitstellen.

Mindestens umzusetzen:

1. `GET /api/noxia/modules` konsumieren und `pathId` als kanonische Lernpfad-ID verwenden.
2. Lokale dauerhafte `moduleId -> PATH:SSF:*` Übergangsmappings entfernen, sobald die SSF-Antwort für den jeweiligen Flow verfügbar ist.
3. Für einen ausgewählten Kurs `detailUrl` bzw. `GET /api/noxia/modules/{moduleId}` abrufen.
4. Strukturierte SSF-Sections im Spiel rendern, zunächst mindestens:
   - `heading`
   - `text`
   - `key_point`
   - `example`
   - `task`
5. `assessment` als In-Game-Fragen rendern und auswerten.
6. `unlocks`, `prerequisites`, `sources`, `schemaVersion` und `contentVersion` korrekt übernehmen.
7. Der normale Akademie-Flow und der Flow „Wissen X benötigt“ beim Bauen sollen auf denselben In-Game-Lernviewer führen.
8. Kein iframe und keine eingebettete SSF-HTML-Seite; SSF bleibt Content-Provider, NOXIA rendert die Spiel-UX selbst.
9. Bestehende `ssfUrl` nur als Fallback/Debug-Link behandeln, nicht als primären Lernpfad.
10. Fehlerfälle sauber behandeln: unbekanntes Modul, leere Sections, API nicht erreichbar, unbekannter Section-Typ.

## Akzeptanzkriterien

- Ein Spieler kann aus der NOXIA-Akademie ein SSF-Modul starten, lesen und prüfen, ohne NOXIA zu verlassen.
- Ein Gebäude mit Wissensvoraussetzung kann direkt in dasselbe passende Lernmodul führen.
- `pathId` stammt aus SSF und wird nicht dauerhaft in NOXIA dupliziert.
- Mindestens `MAT-L0-000001` und `PHY-L1-000001` lassen sich aus dem SSF-Detailpayload darstellen.
- Unbekannte zukünftige Section-Typen brechen den Viewer nicht; sie werden robust ignoriert oder als nicht unterstützter Inhalt kenntlich gemacht.
- Die vorhandene NOXIA-Journey-/Unlock-Logik bleibt Source of Truth für Gameplay-Folgen; wissenschaftlich-didaktischer Inhalt wird nicht nach NOXIA kopiert.

## Source-of-Truth-Grenzen

- Knowledge Graph: kanonische Wissensidentität und fachliche Metadaten.
- SSF: didaktischer Inhalt, Darstellungsschema, didaktische Dauer und Lernpfadbezug.
- NOXIA: In-Game-Darstellung, Journey und Gameplay-Anwendung.

## Referenz

SSF Merge-Commit: `e07cfac2a07032aa75ad6ff42b1b51a04527622f`
SSF API-Schema: `SSF-NOXIA-MODULE-1.0`
