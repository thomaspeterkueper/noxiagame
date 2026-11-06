# NOXIA-LIVING-0016 – Träume und Einsicht aus übergeordnetem Wissen

Stand: 06.11.2026 · Status: **Entwurf – Entscheidungen von Thomas offen** (Abschnitt „Zu entscheiden“)

## Vorgabe (Thomas, 06.11.2026)

„Das übergeordnete Wissen kommt aus unserem Knowledge Graph sowie aus zufälligen Nachrichten aus dem Internet. Wir können da gerne öffentliche Nachrichtenquellen anzapfen, jeweils regionbezogen.“

## Was es schon gibt (Bestand 06.11.2026)

| Baustein | Ort | Stand |
|---|---|---|
| Schlaf als eigener Zustand („sleep_and_consolidate“) | `lib/game/personBrain.ts` | im Code; live hatte keine Figur diesen Zustand als letzte Handlung |
| Erinnerungen gewichten (Bedeutung, Gefühl, Alter) | `consolidateMemories` in `lib/game/personCognition.ts` | live, aber nur als Rangfolge im Gesprächsgedächtnis |
| Traum-Verknüpfung vorhandener Erinnerungen und Muster | `lib/game/cognition/dreamRecombination.ts` | nur in der Säuglings-Simulation (`newbornEarlyLifeSimulation.ts`), Ergebnis `canonical: false`, keine neuen Erinnerungen |
| Einsichts-Modus und Einsichts-Kandidat | `selectCognitiveState` (`mode: 'insight'`), `createInsightCandidate` (`provenance: dream_recombination \| meditation_recombination \| knowledge_gateway`) | im laufenden Spiel nicht erreichbar: Der Aufruf übergibt weder ungelöstes Problem noch Traumzustand; `createInsightCandidate` hat keinen Aufrufer |
| Grundsatz Einsichtstor | `docs/design/npc-cognitive-modes.md` | „Die Figur bekommt eine Vermutung, keine Wahrheit“; Herkunft wird gespeichert |
| Reale Meldungen | `lib/game/worldAwareness.ts`, `/api/game/world-awareness` | Deutschlandfunk, ESA, NASA, JPL – **überregional**, ohne Speicherung, nur im Dashboard-Gespräch; tagesschau und DLR eingetragen, aber gesperrt (Lizenz bzw. kein Feed) |
| Gesprächsregel für Meldungen | `npc-conversation`: „Belegte reale Meldung: …“ | Fakten und Meinung getrennt (Auswertung prüft das täglich) |
| Knowledge Graph | `docs/SSF-INTEGRATION.md`: KUEPER Knowledge Graph → SSF → NOXIA | NOXIA liest nur Modul-Metadaten und Freischaltungen über die SSF-API, keine Wissensknoten |

## Vorschlag

### 1. Zwei Quellen übergeordneten Wissens

**a) Regionale Nachrichten.** Ein Abruf (Cron, alle 2–3 Stunden) holt öffentliche Feeds je Region und legt **Titel, Link, Quelle, Zeit, Region, Themen und höchstens einen Satz Kurzfassung** in einer neuen Tabelle `world_news_items` ab (kein Volltext; Lizenz: nur Anreißer und Verweis). Jede Meldung läuft vor dem Speichern durch den Schutzfilter (`realWorldRisk`); Meldungen zu Gewaltverbrechen, Missbrauch, Suizid und Unfällen mit Toten werden nicht als Traum- oder Einsichtsstoff verwendet (im Gespräch weiter als belegte Meldung möglich, wenn der Spieler danach fragt).

Region = wo die Figur lebt:

| Region im Spiel | Quellen (öffentlich, Feed noch zu prüfen) |
|---|---|
| Sundern / Sauerland | WDR (Südwestfalen), Deutschlandfunk |
| Deutschland allgemein | Deutschlandfunk (läuft), tagesschau (Lizenzfrage offen) |
| Istanbul | öffentlich-rechtlicher Anbieter TRT (deutsch/englisch), zu prüfen |
| Dvārakā / Gujarat | öffentliche indische Quellen (z. B. Prasar Bharati / DD News), zu prüfen |
| Mond, Mars, Phobos, Stationen | ESA, NASA, JPL (laufen) – als „Nachrichten von der Erde“, mit Laufzeit-Verzögerung |

Neue Region = Eintrag in `WORLD_AWARENESS_SOURCES` mit `region` und `ingestEnabled` erst nach Prüfung von Feed und Nutzungsbedingungen.

**b) Knowledge Graph.** Über die SSF-API eine neue, nur lesende Schnittstelle „Wissensknoten zu Stichworten“ (z. B. `GET /api/noxia/knowledge?topics=…&limit=3`): liefert Knoten-ID, Titel, ein bis zwei Sätze, Fachgebiet. NOXIA schreibt nichts zurück. Bis die Schnittstelle steht, fällt Quelle b aus – Träume laufen dann nur mit Nachrichten und eigenen Erinnerungen.

### 2. Träume (Nachtlauf, ohne Sprachmodell)

- Wenn eine Figur schläft (`namedPersonSleeps`), läuft **einmal je Nacht** `recombineDuringDream` mit ihren Erinnerungen (Gespräche, Begegnungen) – dazu mit einer Wahrscheinlichkeit nach Kreativität (`creativityFromTraits`) **ein Fremdimpuls**: eine Meldung ihrer Region aus den letzten 48 Stunden oder ein Wissensknoten, ausgewählt über gemeinsame Stichworte mit ihren Erinnerungen, sonst zufällig.
- Ergebnis: höchstens ein Traum je Nacht in `npc_dreams` (Figur, Nacht, Motive, Quell-Erinnerungen, Quell-Meldung/Knoten, Stärke, `canonical = false`). Motive sind Stichworte, kein ausgeschriebener Text. Nach 7 Tagen verblasst er (wie NOXIA-LIVING-0015).
- **Reale Personen** aus Meldungen werden nie zu Traumfiguren: Namen werden aus den Motiven entfernt, übrig bleibt das Thema („Hochwasser an der Röhr“, nicht wer was gesagt hat).

### 3. Einsicht (Tor für übergeordnetes Wissen)

- **Ungelöste Probleme** entstehen aus dem, was die Figur schon kennt: blockierte Absicht (`intentBlocker` in `last_decision_factors`), länger unerfüllte Bedürfnisse, eigene offene Wünsche. Neue Tabelle `npc_open_problems` (Figur, Art, Bezug, seit wann).
- Der Nachtlauf ruft `selectCognitiveState` mit `unresolvedProblem` und `reflectiveState: 'dream'` auf. Erreicht die Figur das Einsichtstor, entsteht über `createInsightCandidate` eine **Vermutung** in `npc_insights` (Problem, Hypothese als kurzer Satz aus Vorlage, Quellen, Herkunft `dream_recombination` oder `knowledge_gateway`, Zuversicht, `canonical = false`, Status `vermutet → bestätigt / verworfen`).
- Bestätigt wird nur durch die Welt (Handlung führt zum Ziel), nie durch die Quelle selbst. Seltenheit: höchstens eine Einsicht je Figur und Woche (`insight_cooldown_until_tick` existiert in `socialLife.ts` bereits als Feld).

### 4. Wirkung im Spiel

- **Gespräch:** `npc-conversation` bekommt höchstens eine Zeile: „Du hast letzte Nacht geträumt: … (Motive)“ oder „Dir ist eine Idee gekommen, sicher bist du nicht: …“. Hängt an einer Meldung, gilt die bestehende Regel: Meldung als belegte Tatsache mit Quelle, der Traum oder die Idee als eigene Deutung. Die Figur erzählt das nur, wenn es passt (Frage nach Befinden, Träumen, dem Thema) – nicht ungefragt bei jedem Gruß.
- **Handeln:** Eine bestätigungsfähige Einsicht darf eine Entscheidung der Figur einmal anders gewichten (z. B. einen anderen Weg, Händler, Arbeitsort probieren). Ergebnis geht in `npc_insights.status`.
- **Beobachten:** Das NPC-Observatorium (Admin) zeigt Träume und Einsichten je Figur. Spieler sehen sie nur, wenn die Figur davon erzählt.

### 5. Kosten und Grenzen

- Nachtlauf und Einsichtstor bleiben deterministisch und ohne Sprachmodell (Kosten-Grundsatz in `npc-cognitive-modes.md`). Das Sprachmodell kommt nur im Gespräch, wie heute.
- Keine Gewalt als Selbstzweck, nichts Sexuelles, keine Herabsetzung als Traumstoff (NOXIA-ETHICS-0001). Figuren erfinden aus Träumen keine Fakten über die Welt.
- Spielraum (NOXIA-OMNI-0001): eröffnet den Eigenraum der Figur (eigene Ideen, Veränderung), Fremdraum der Spieler (Gesprächsstoff, Anlass zum Helfen); Folgeraum bewahrt, solange Einsichten nur Vermutungen sind.

## Umsetzung in Schritten

1. Regionale Feeds: `region` in `WORLD_AWARENESS_SOURCES`, Tabelle `world_news_items`, Cron-Abruf mit Schutzfilter, Feeds für Sundern prüfen und freischalten.
2. Nachtlauf Träume: `recombineDuringDream` im Personen-Cron für schlafende Figuren, `npc_dreams`, Zeile im Gespräch.
3. Ungelöste Probleme und Einsichtstor: `npc_open_problems`, `npc_insights`, Aufruf mit `unresolvedProblem`/`reflectiveState`.
4. Knowledge-Graph-Schnittstelle über SSF, dann als zweiter Fremdimpuls.
5. Einsicht wirkt auf Entscheidung, Bestätigen/Verwerfen, Anzeige im Observatorium.

Jeder Schritt ist für sich nutzbar; die tägliche Auswertung bekommt je Schritt einen Befund-Bereich („Traum“, „Einsicht“).

## Zu entscheiden (Thomas)

1. **Quellenliste:** Reichen WDR und Deutschlandfunk für Sundern zum Start? Darf tagesschau verwendet werden (Lizenz)?
2. **Knowledge Graph:** Wer baut die lesende Schnittstelle in SSF – oder gibt es schon einen anderen Zugang zu den Knoten?
3. **Häufigkeit:** Ein Traum je Nacht für jede schlafende Figur, oder nur für Figuren mit Kreativität über einer Schwelle?
4. **Sichtbarkeit:** Sollen Spieler Träume auch außerhalb von Gesprächen sehen können (z. B. am Morgen im Café)?
