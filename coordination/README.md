# noχ¹ᐃ · Interne Koordination

Dieser Bereich ist die gemeinsame Austausch- und Aufgabenzuweisungsfläche für die dauerhaften **noχ¹ᐃ**-Arbeitsbereiche innerhalb dieses Repositories.

## Zweck

Die Projekt-Chats/Tabs arbeiten fachlich getrennt, teilen sich aber dieselbe Codebasis. `coordination/` verhindert Doppelarbeit, widersprüchliche Änderungen und stillschweigende Abhängigkeiten zwischen den Bereichen.

Die fachlichen Zuständigkeiten stehen in [`docs/project-workstreams.md`](../docs/project-workstreams.md).

## Source of Truth

**Für Entwicklungsaufgaben innerhalb von `noxiagame` ist die Markdown-Anforderung im Repository die Source of Truth.**

Die Produktionsdatenbank ist nicht die primäre Aufgabenverwaltung. Sie enthält Spielzustand und Runtime-Daten. Eine spätere Datenbankansicht darf diese Aufgaben höchstens als abgeleiteten Index/Cache spiegeln; sie darf keinen zweiten konkurrierenden Aufgabenstand erzeugen.

`public.daily_tasks` ist Gameplay-/Spielerdatenbestand und wird ausdrücklich **nicht** für Entwicklungskoordination wiederverwendet.

## Verzeichnisstruktur

```text
coordination/
├─ README.md
├─ TASK-TEMPLATE.md
├─ open/       # zugewiesen oder noch zu übernehmen
├─ active/     # vom Zielbereich übernommen und in Bearbeitung
├─ blocked/    # wartet auf Entscheidung, Abhängigkeit oder Fremdarbeit
├─ done/       # abgeschlossen und mit Commit/Migration/Ergebnis belegt
└─ rejected/   # bewusst verworfen, mit Begründung
```

Die Statusordner entstehen mit den ersten Aufgaben; leere Ordner müssen nicht künstlich versioniert werden.

## Arbeitsbereiche / IDs

| ID | Arbeitsbereich |
| --- | --- |
| `core` | noχ¹ᐃ · Core / Architektur / Backend |
| `earth` | noχ¹ᐃ · Erde |
| `moon` | noχ¹ᐃ · Mond |
| `mars` | noχ¹ᐃ · Mars |
| `orbit` | noχ¹ᐃ · Orbit / Raumstationen |
| `interiors` | noχ¹ᐃ · Gebäude & Innenräume |
| `vehicles` | noχ¹ᐃ · Fahrzeuge & Raumschiffe |
| `graphics` | noχ¹ᐃ · Grafik / Assets |
| `qa` | noχ¹ᐃ · Release / QA / Testspieler |

## Wann wird eine interne Aufgabe angelegt?

Eine Aufgabe gehört hierher, wenn ein Arbeitsbereich etwas von einem **anderen Arbeitsbereich desselben `noxiagame`-Repositories** benötigt.

Beispiele:

- `moon → core`: gemeinsame Himmelskörper-/Projektionsschnittstelle nötig
- `moon → graphics`: Mondkarten-Layer oder Oberflächenasset benötigt
- `interiors → core`: persistentes Raum-/Türmodell benötigt
- `qa → earth`: Regression der Earth-Karte gefunden

Eine rein lokale Aufgabe, die nur den eigenen Bereich betrifft und keine Koordination benötigt, muss nicht hier abgelegt werden.

## Ablauf

1. Quellbereich legt eine Markdown-Datei unter `coordination/open/` nach `TASK-TEMPLATE.md` an.
2. Zielbereich prüft vor Beginn seiner Arbeit offene und aktive Aufgaben für die eigene Area-ID.
3. Bei Übernahme wird die Datei nach `coordination/active/` verschoben und `status: active` gesetzt.
4. Bei Blockade geht sie nach `coordination/blocked/` und enthält den konkreten Blocker.
5. Nach Umsetzung werden Commit-SHA, Migration oder sonstiger Ergebnisnachweis eingetragen und die Datei nach `coordination/done/` verschoben.
6. Verworfenes geht nach `coordination/rejected/` mit Begründung.

## Dateinamen

Keine zentrale fortlaufende Nummer verwenden, weil mehrere Tabs gleichzeitig Aufgaben erzeugen können. Bevorzugt:

```text
YYYYMMDD-HHMM-<source>-to-<target>-<kurzer-slug>.md
```

Beispiel:

```text
20260910-0745-moon-to-core-celestial-spatial-interface.md
```

## Konfliktregel

Vor Änderungen an gemeinsam genutzten Hotspots sollte der bearbeitende Bereich `coordination/active/` prüfen, insbesondere bei:

- `lib/world/spatial/`
- `app/api/game/`
- `supabase/migrations/`
- gemeinsamen Gebäude-/Fahrzeugmodellen
- zentralem Cockpit/Navigation

Eine aktive Aufgabe ist keine globale Dateisperre, aber sie macht parallele Arbeit sichtbar. Bei Überschneidung stimmen sich die beteiligten Bereiche über eine zusätzliche Aufgabe oder einen gemeinsamen Owner-Bereich ab.

## Cross-Repository-Grenze

`coordination/` gilt **nur innerhalb von `noxiagame`**.

Wenn eine notwendige Änderung ein anderes Repository betrifft, wird sie dort nicht direkt umgesetzt. Stattdessen wird im **Ziel-Repository** unter `external-tasks/open/` eine Markdown-Anforderung angelegt. Bearbeitete Anforderungen werden dort später nach `done/` beziehungsweise `rejected/` verschoben. Jedes Repository bleibt Source of Truth nur für seinen eigenen Zuständigkeitsbereich.
