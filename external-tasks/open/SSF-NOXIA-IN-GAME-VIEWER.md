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

## Lernfluss statt Dokumentansicht

Der Viewer soll nicht wie ein eingebettetes Dokument wirken, sondern als klarer Lernablauf:

**Entdecken → Anwenden → Prüfen → Abschluss**

Dabei soll sichtbar sein, in welchem Schritt sich der Spieler befindet. Eine schlichte Fortschrittsanzeige genügt; Punkte, Sterne oder andere Gamification sind dafür nicht erforderlich.

Nach Möglichkeit zeigt der Viewer zusätzlich den Lernpfadkontext, z. B.:

- Fach / Themenbereich,
- aktueller Lernpfad,
- aktuelle Einheit bzw. Position im Pfad,
- nächster sinnvoller Schritt.

## Assessment und Aufgaben

Assessments sollen nicht nur binär korrekt/falsch reagieren.

Mindestens vorgesehen:

- auswählbare Antwortoptionen,
- unmittelbare Rückmeldung,
- erneuter Versuch bei falscher Antwort,
- kurze konstruktive Erklärung, warum die richtige Antwort stimmt,
- der Abschlussstatus wird erst nach erfolgreicher Prüfung gesetzt.

Wenn SSF strukturierte Aufgabenformen liefert, soll der Viewer sie nach und nach unterstützen. Die Architektur darf deshalb nicht auf Multiple Choice fest verdrahtet werden. Geeignete spätere Interaktionen sind insbesondere:

- Zahlen-/Werteingabe,
- Zuordnung,
- Reihenfolge,
- Auswahl einer passenden Darstellung oder eines Diagramms.

Unbekannte zukünftige Interaktionstypen dürfen den Viewer nicht beschädigen.

## Kontext aus dem Spiel erhalten

Wenn der Spieler nicht aus der Akademie, sondern aus einem konkreten Gameplay-Kontext in ein Lernmodul gelangt, muss dieser Kontext erhalten bleiben.

Beispiele:

- „Wissen benötigt für: Spektralanalyse“
- „Benötigt für Gebäude X“
- „Benötigt für Sensor Y“

Nach erfolgreichem Abschluss soll eine passende Rückkehraktion angeboten werden, z. B.:

- **Zurück zum Observatorium →**
- **Gebäude erneut prüfen →**
- **Spektralsensor verwenden →**

Damit entsteht der gewünschte Ablauf:

**Spielproblem → Lernen → Freischaltung → unmittelbare Anwendung**

Die Rückkehr darf nicht auf eine einzige harte Route festgelegt werden; der Aufrufer soll einen sicheren Rückkehrkontext übergeben können.

## Abschluss- und Freischaltungsbereich

Nach erfolgreichem Abschluss darf der Viewer nicht bei einer technischen `unlocks`-Liste enden. Die Freischaltungen sind semantisch zu trennen und als nächster sinnvoller Schritt darzustellen.

Der Abschlussbereich soll drei Fragen beantworten:

1. **Was habe ich jetzt verstanden?**
2. **Was kann ich dadurch im Spiel neu tun?**
3. **Was sollte ich als Nächstes lernen?**

Dazu kann eine kurze Zusammenfassung der erreichten Lernziele aus dem SSF-Inhalt angezeigt werden.

### A. Weiterführende Lernmodule

Wenn eine Freischaltung auf ein SSF-Lernmodul oder einen SSF-Lernpfad auflösbar ist, soll NOXIA daraus eine klickbare Weiterlern-Aktion erzeugen.

Beispiel nach `PHY-L1-000001`:

- `PHY-L1-000002` → **Weiterlernen: PHY-L1-000002**
- `CHE-L1-000001` → **Weiterlernen: CHE-L1-000001**

Ein Klick lädt das Ziel direkt im selben In-Game-Lernviewer. Bei mehreren Folgemodulen wird keine automatische Auswahl erzwungen; der Spieler wählt selbst.

Wenn NOXIA aus dem aktuellen Spielkontext eine Relevanz ableiten kann, dürfen Ziele zusätzlich gekennzeichnet werden, z. B.:

- **Empfohlener nächster Schritt**
- **Für deine aktuelle Aufgabe relevant**
- **Alternative Vertiefung**

Diese Priorisierung ist NOXIA-seitig und darf die kanonische SSF-Lernpfadstruktur nicht verändern.

### B. Gameplay-Freischaltungen

Nicht-didaktische Unlocks wie `SENSOR:SPECTRAL` dürfen nicht als rohe technische IDs in derselben Zeile wie Lernmodule erscheinen. NOXIA löst sie über eine eigene, NOXIA-seitige Unlock-Metadatenquelle auf.

Für jeden Gameplay-Unlock soll NOXIA nach Möglichkeit bereitstellen:

- stabile Unlock-ID,
- spielerfreundlicher Anzeigename,
- kurzer Erklärungstext,
- Typ/Kategorie, z. B. Sensor, Gebäude, Verfahren, Analysefunktion,
- optional Icon,
- optional konkrete In-Game-Aktion bzw. Zielroute,
- optional Einsatzort bzw. Hinweis, wo die Funktion im Spiel nutzbar ist.

Beispiel:

**Neu freigeschaltet: Spektralsensor**

`SENSOR:SPECTRAL`

Der Beschreibungstext soll erklären, was der Spektralsensor **im aktuellen NOXIA-Gameplay tatsächlich ermöglicht**, z. B. welche Messungen, Analysen oder neuen Informationen damit zugänglich werden. Falls eine direkte Nutzung möglich ist, erhält die Karte eine Aktion wie **„Im Spiel verwenden →“**.

Die fachlich-didaktische Ursache der Freischaltung kann aus SSF stammen; Name, Gameplay-Bedeutung, Icon, Einsatzort und Zielaktion sind jedoch NOXIA Source of Truth.

### Generische Unlock-Presentation

Die Darstellung soll nicht speziell für `SENSOR:SPECTRAL` hartcodiert werden. NOXIA benötigt ein generisches Unlock-Presentation-System, das technische Unlock-IDs auf spielerfreundliche Metadaten abbildet. Dasselbe System soll später für Sensoren, Instrumente, Gebäude, Analyseverfahren, Produktionsprozesse und andere Gameplay-Funktionen funktionieren.

Der Abschlussbereich soll dadurch mindestens unterscheiden zwischen:

- **Weiterlernen** — didaktische Folgeziele,
- **Neu im Spiel** — Gameplay-Freischaltungen mit Bedeutung und Handlungsmöglichkeit.

## Robuster Abschlusszustand

Der Abschluss eines Lernmoduls und daraus resultierende NOXIA-Folgen müssen idempotent verarbeitet werden.

Das bedeutet insbesondere:

- erneutes Öffnen eines bereits abgeschlossenen Moduls erzeugt keine doppelten Unlocks,
- Reload oder Navigation verursacht keine mehrfachen Journey-Effekte,
- ein fehlgeschlagener Rücksprung verändert den bereits erreichten Lernstatus nicht,
- die bestehende NOXIA-Journey-/Unlock-Logik bleibt die einzige Source of Truth für Gameplay-Folgen.

## Akzeptanzkriterien

- Ein Spieler kann aus der NOXIA-Akademie ein SSF-Modul starten, lesen und prüfen, ohne NOXIA zu verlassen.
- Ein Gebäude mit Wissensvoraussetzung kann direkt in dasselbe passende Lernmodul führen.
- `pathId` stammt aus SSF und wird nicht dauerhaft in NOXIA dupliziert.
- Mindestens `MAT-L0-000001` und `PHY-L1-000001` lassen sich aus dem SSF-Detailpayload darstellen.
- Unbekannte zukünftige Section- oder Interaktionstypen brechen den Viewer nicht.
- Die vorhandene NOXIA-Journey-/Unlock-Logik bleibt Source of Truth für Gameplay-Folgen; wissenschaftlich-didaktischer Inhalt wird nicht nach NOXIA kopiert.
- Der Viewer zeigt einen verständlichen Lernfortschritt entlang `Entdecken → Anwenden → Prüfen → Abschluss`.
- Falsche Assessment-Antworten liefern eine konstruktive Rückmeldung und erlauben einen neuen Versuch.
- Ein Gameplay-Einstieg kann seinen Kontext bis zum Abschluss behalten und danach eine passende Rückkehraktion anbieten.
- Nach Abschluss von `PHY-L1-000001` werden auflösbare Folgemodule als klickbare Weiterlernziele angeboten.
- Mehrere Folgemodule können kontextabhängig als empfohlen/relevant/Vertiefung gekennzeichnet werden, ohne SSF-Kanon zu verändern.
- `SENSOR:SPECTRAL` wird als Gameplay-Freischaltung mit NOXIA-seitigem Anzeigenamen **Spektralsensor** und erklärter Spielbedeutung dargestellt, nicht nur als technische ID.
- Ein Gameplay-Unlock kann optional direkt zu seiner nutzbaren In-Game-Funktion führen.
- Die Unlock-Darstellung ist generisch und nicht auf den Spektralsensor beschränkt.
- Wiederholtes Öffnen oder Abschließen erzeugt keine doppelten Gameplay-Unlocks oder Journey-Effekte.

## Source-of-Truth-Grenzen

- Knowledge Graph: kanonische Wissensidentität und fachliche Metadaten.
- SSF: didaktischer Inhalt, Darstellungsschema, didaktische Dauer und Lernpfadbezug.
- NOXIA: In-Game-Darstellung, Journey, Gameplay-Anwendung sowie Bezeichnung und Erklärung der Gameplay-Unlocks.

## Referenz

SSF Merge-Commit: `e07cfac2a07032aa75ad6ff42b1b51a04527622f`
SSF API-Schema: `SSF-NOXIA-MODULE-1.0`
