# Request: Gesprächsauswertung ohne Mitlesen

**Projekt:** noxiagame
**Zuständig:** Teilprojekt Adminbereich / Backend
**Datum:** 05.11.2026
**Priorität:** hoch – Voraussetzung für Tests mit externen Testspielern

## Ziel

Testspieler sollen authentisch sprechen können. Deshalb gibt es im Adminbereich **keine Einsicht in Gesprächsinhalte von Spielern**. Gespräche werden ausschließlich automatisch ausgewertet. Die Auswertung wird den Spielern offen mitgeteilt. Die Zusage „Kein Mensch liest mit“ muss technisch durchgesetzt sein, nicht nur versprochen.

## Begriffe

| Gesprächsart | Personenbezug | Behandlung |
|---|---|---|
| Spieler ↔ Spieler | ja | geschützt (Regeln unten) |
| Spieler ↔ NPC | ja – auch die NPC-Antworten, weil sie die Spielereingaben spiegeln | geschützt (Regeln unten) |
| NPC ↔ NPC (Simulation ohne Spielerbeteiligung) | nein | frei lesbar im Adminbereich |
| Gespräche von Admin-Testkonten | eigene Daten | frei lesbar im Adminbereich |

## Anforderungen

### 1. Keine Rohtext-Ansicht
- Der Adminbereich enthält keine Ansicht, keinen Export und keinen API-Endpunkt, der Rohtexte geschützter Gespräche liefert.
- Auch NPC-Antworten aus Spieler-NPC-Gesprächen sind nicht einzeln einsehbar.
- Datenbankrechte: Die Admin-Rolle hat keinen Lesezugriff auf die Rohtext-Tabelle. Nur der Auswertungsdienst darf lesen (z. B. per Row Level Security bzw. eigener Service-Rolle).

### 2. Automatische Auswertung
- Ein Auswertungsdienst verarbeitet abgeschlossene Gespräche und speichert **nur Ergebnisse**, z. B.:
  - Themen/Kategorien, Stimmung, Gesprächslänge, Abbruchrate
  - NPC-Qualität: Rollenbruch, Wiederholungen, Widersprüche zur Spielwelt, Fehlerfälle
  - Spielrelevantes: genannte Orte, Gebäude, Waren, Jobs
- Ergebnisse enthalten keine wörtlichen Zitate aus Spielereingaben.

### 3. Nur Aggregate, keine Spielerprofile
- Admins sehen Auswertungen nur zusammengefasst, ab einer Mindestgruppe von **5 Spielern** je Auswertungszelle.
- Keine Ansicht „Auswertung von Spieler X“.
- Auswertungen pro NPC oder Ort sind erlaubt, sofern die Mindestgruppe erreicht ist.

### 4. Löschfrist
- Rohtexte geschützter Gespräche werden nach der Auswertung gelöscht, spätestens nach **14 Tagen** automatisch (Frist konfigurierbar).
- Ausnahmen nur für Spielmechanik (siehe 5) und gemeldete Ausschnitte (siehe 6).

### 5. NPC-Gedächtnis
- NPCs dürfen sich an Spieler erinnern, das ist Spielmechanik (Beziehungen, die ohne Kontakt verblassen).
- Gespeichert werden **kurze Zusammenfassungen/Fakten** pro Beziehung, keine vollständigen Gesprächsprotokolle.
- Das NPC-Gedächtnis ist für Admins nicht einsehbar.
- Spieler können ihr Gedächtnis bei einem NPC zurücksetzen (optional, später).
- Beim Löschen eines Spielerkontos wird auch das NPC-Gedächtnis zu diesem Spieler gelöscht.

### 6. Melden/Teilen durch Spieler
- Button „Gespräch melden/teilen“ (Fehler, Belästigung, Feedback).
- Nur der vom Spieler ausdrücklich geteilte Ausschnitt wird für Admins lesbar, mit Hinweis, dass er gelesen wird.
- Geteilte Ausschnitte haben eine eigene Löschfrist (z. B. 90 Tage).

### 7. Admin-Testkonten
- Admins prüfen NPC-Verhalten mit eigenen, gekennzeichneten Testkonten. Deren Gespräche sind vollständig lesbar.

### 8. Hinweis für Spieler
- Einmalig im Onboarding und in der Datenschutzerklärung, nicht bei jedem Gespräch. Vorschlag:

  > Gespräche in NOXIA werden automatisch ausgewertet, um die Welt und ihre Figuren zu verbessern. Kein Mensch liest sie. NPCs merken sich in Kurzform, was ihr miteinander erlebt habt. Wenn du willst, dass wir ein Gespräch ansehen, nutze „Gespräch melden“.

- Falls Gesprächstexte an einen externen KI-Dienst gehen: diesen in der Datenschutzerklärung nennen.

## Offene Punkte

- Rechtliche Prüfung der Formulierungen (insbesondere bei Schulen/Minderjährigen).
- Endgültige Löschfristen und Mindestgruppengröße.
- Welche Auswertungsergebnisse für die Spielbalance tatsächlich gebraucht werden.

## Abnahme

- Kein Weg im Adminbereich (UI, Export, API) führt zu Rohtexten geschützter Gespräche.
- Admin-Rolle bekommt beim direkten Datenbankzugriff auf Rohtexte einen Fehler.
- Rohtexte verschwinden nach Ablauf der Frist automatisch.
- Auswertungsansichten unter der Mindestgruppe zeigen „zu wenig Daten“.
