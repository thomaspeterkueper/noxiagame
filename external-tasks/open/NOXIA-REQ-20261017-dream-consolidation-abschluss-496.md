# NOXIA Request – Abschluss von PR #496 (Traummodell-Konsolidierung)

Datum: 2026-10-17
Status: proposed – Nachtrag zu `NOXIA-REQ-20261016-dream-model-consolidation.md`
Priorität: hoch
Bezug: PR #496 (`feat/dream-consolidation-20261016`, Stand `61921276`, CI grün)

## Zweck

Ein klares Ende für #496 festlegen. Der PR umfasst bereits 51 Commits und 21 Dateien. Danach wird der Umfang eingefroren; alles Weitere kommt in neue PRs.

## Bereits erledigt (nicht erneut anfassen)

- Gemeinsamer Konstruktor `createDreamAssociation`, beide Erzeugungswege angebunden
- Motivgrenze 12 für Erinnerungsträume über `maxMotifs`, `sourceIds` verpflichtend
- Lore-Prüfung über `worldProjection`, keine Textreplikation in Motiven
- Markierter, optionaler Fremdimpuls (`allowForeignImpulse`, `sourceImpulseKinds`)

## Letzter Umfang für #496

### 1. Eine Auswahl, ein Generator
- `recombineDuringDream` erhält bereits gefilterte externe Quellen als dritte Eingangsart neben Erinnerungen und Sinnesmustern (z. B. `externalSources: readonly { id: string; motifs: readonly string[] }[]`).
- Die Rangfolge von Erinnerungen, Mustern und Quellen geschieht dort an einer Stelle.
- `synthesizeNpcDream` übernimmt nur noch: Lore-/Lizenzfilter der Quellen → Aufruf von `recombineDuringDream` → Distress-Bewertung und Episoden-Hülle. Keine eigene Sortierung der Erinnerungen mehr.
- `novelty` wird aus der Rekombination übernommen statt fest auf 0,5 gesetzt.
- Test: Für dieselben Eingaben liefern beide Einstiege dieselben `sourceMemoryIds`, `sourceIds` und Motive (bis auf die Hülle).

### 2. Ein Wortzerleger
- Genau eine exportierte Funktion für Motivschlüssel in `lib/game/cognition/` (Unicode, Mindestlänge, Höchstlänge 48).
- Stoppwörter Deutsch und Englisch, einfache Stammform-Kürzung (z. B. „repaired"/„repair", „Reparatur"/„reparieren" auf gemeinsamen Stamm).
- `motifKeys` in `dreamKnowledge.ts` entfällt.
- Test: „I repaired a bridge" und „bridge repair" haben mindestens zwei gemeinsame Schlüssel; deutsche Füllwörter erscheinen nicht als Motiv.

### 3. Aufräumen
- `selectDreamSourceIds` entfernen (ungenutzt).
- `maxTextLength` aus `DreamBudget` entfernen oder wieder verwenden; `worldProjection.location` entweder auswerten oder streichen.
- `availableFromYear` (real) eindeutig benennen, z. B. `realPublishedYear`, getrennt von `worldProjection.availableFromYear` (in-world).
- Doppelte Felder in `DreamEpisode` (`atTick`/`createdAtTick`, `memoryIds`/`sourceMemoryIds`, doppeltes `sourceIds`) auf die Felder von `DreamAssociation` reduzieren und die nachgelagerten Stufen (Inquiry … Bridge) anpassen.

## Bewusst zu entscheiden und zu dokumentieren

- **NPC ohne verwertbare Erinnerungen:** Derzeit erhalten sie ohne Flag keine externen Impulse (Quellen ohne Bezug fallen heraus). Das betrifft z. B. das Kind im geplanten Pilot. Entweder als Regel festhalten oder dort den Fremdimpuls zulassen.
- **Häufigkeit des Fremdimpulses:** Nicht jede Nacht, sondern über eine Schwelle aus NPC-Eigenschaften (Offenheit/Neugier), deterministisch über den vorhandenen Hash aus `npcId` und Tick.

## Nicht in #496

- Persistenz und Nachwirkung (Schritt 5 des Ursprungs-Requests) – eigener PR nach dem Merge.
- Neue Stufen nach der Population-Bridge.
- Arbeiten an anderen Strängen (#498, `research/npc-information-channels`) erst nach Abschluss von #496.

## Abnahme und Merge

- Alle CI-Workflows grün, `test:dreams` und `test:dream-recombination` laufen gemeinsam über ein Script.
- Danach Draft-Status aufheben und mit **Squash-Merge** nach `main`, damit die vielen Fix-/Test-Paare nicht einzeln in der Historie landen.
- Überholte Drafts schließen: #488 (ersetzt durch #496), #490 (würde über 4.000 Zeilen löschen), #491–#493 (Validierungen bereits gemergter PRs).
