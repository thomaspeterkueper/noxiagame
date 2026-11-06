# NOXIA-LIVING-0016 – Träume und Einsicht aus übergeordnetem Wissen

Stand: 06.11.2026 · Status: **Schritte 1–3 umgesetzt** (regionale Meldungen, Träume, Stimmung und seltene Einsicht); Schritte 4–5 offen

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

## Entscheidungen (Thomas, 06.11.2026)

1. **Quellen zum Start:** WDR, Deutschlandfunk und tagesschau. tagesschau ist damit freigegeben (nur Titel, Link, ein Satz).
2. **Knowledge Graph:** KG oder SSF stellen die lesende Schnittstelle bereit. SSF ist besonders interessant, wenn ein Thema gerade ohnehin dran ist (z. B. ein Modul, das der Spieler oder die Figur gerade lernt) – dann kommt der Fremdimpuls bevorzugt aus diesem Thema. (Im Vercel-Team gibt es dafür die Projekte `kueper-knowledge-graph` und `solarsciencefoundation`.)
3. **Wer träumt:** Jede Figur träumt, mehr oder weniger intensiv. Nur wenige können sich ein bisschen erinnern oder werden sogar erleuchtet.
4. **Sichtbarkeit:** Manche Träume kann man erzählen, die meisten sind unterbewusst.

## Umgesetzt (06.11.2026)

- **Meldungen:** `world_news_items`, `world_news_source_status`; Cron `/api/cron/world-news` alle zwei Stunden (`50 */2 * * *`). Quellen mit `region` in `lib/game/worldAwareness.ts`: tagesschau und Deutschlandfunk (`de`), WDR (`de-nrw`), ESA/NASA/JPL (`space`). Die WDR-Feed-Adresse ist noch ungeprüft; ob sie stimmt, steht nach dem ersten Lauf in `world_news_source_status`. Traumtauglich (`dream_ok`) nur ohne Gewalt, Tod, Unglück, Krieg, Missbrauch, Suizid und ohne Verdacht des Schutzfilters (`lib/game/worldNewsFeed.ts`). Löschen nach 14 Tagen.
- **Träume:** `npc_dreams` (ein Traum je Figur und Nacht, `canonical = false`, Löschen nach 30 Tagen). `runDreamTick` (`lib/game/cognition/dreamRuntime.ts`) läuft in jedem Tick nach der Bevölkerung für alle Figuren, die gerade schlafen. Stoff: Begegnungen der letzten 24 Ticks (fiktive Namen), Arbeit, manchmal eine Meldung der Region – Namen aus Meldungen fallen weg (`newsMotifs`).
- **Erinnern:** Fest je Figur (`dreamRecallAbility`, Trait `dream_recall` geht vor), schief verteilt. Zusammen mit der Intensität der Nacht: `none` (unterbewusst, die meisten), `fragment` (Bruchstück), `clear` (deutlich, wenige). Im Test mit 400 Figuren: über 55 % unterbewusst, unter 20 % deutlich.
- **Gespräch:** Nur ein erinnerter Traum der letzten 30 Stunden kommt ins Gespräch (`dreamConversationLines`), mit der Regel „nur wenn es passt, kein Ausschmücken, keine Vorhersage“. Hing er an einer Meldung, wird die Meldung als belegt, der Traum als Traum genannt.
- **Stimmung (Schritt 3, Thomas: „machen wir so“):** Jeder Traum hat einen Grundton (`tone`, −1..1: Streit dunkel, Hilfe hell, dazu Zufall je Nacht). Auch unterbewusste Träume färben die Gefühle leicht (`dreamAffectDelta`, höchstens 0,12 je Gefühl; über `applyDreamAffect` bewegt sich die Grundstimmung um wenige Hundertstel).
- **Erleuchtung (Schritt 3):** Nur bei deutlich erinnertem Traum und offenem Problem (drängendstes Bedürfnis unter 0,45, `openProblemFromNeeds`), höchstens eine je Figur und Woche. Das Einsichtstor im Traum wiegt Intensität, Druck des Problems, Assoziationsweite, Fachwissen und Zufall. Ergebnis in `npc_insights` als Vermutung (`status = vermutet`, `canonical = false`); Herkunft `knowledge_gateway`, wenn der Traum an einer Meldung hing, sonst `dream_recombination`. Im Gespräch: „Dir ist neulich nach einem Traum eine Idee gekommen, sicher bist du nicht …“.
- **Verteilung (Simulation, 2000 Träume):** 76 % unterbewusst, 16 % Bruchstück, 8 % deutlich; bei offenem Problem führt etwa jeder 27. Traum zu einer Einsicht, die Wochensperre bremst weiter.
- **Erster Abruf 06.11.2026 15:50:** Deutschlandfunk (2 Feeds) und tagesschau je 20 Meldungen. WDR und NASA lieferten, scheiterten aber an doppelten IDs (abgeschnittener Link als ID) – behoben mit vollem Hash. ESA (404) und JPL (403) liefern nicht; das betrifft auch das Dashboard und ist noch offen.
- **Noch nicht:** Einsichten verändern noch keine Entscheidung und werden noch nicht bestätigt oder verworfen (Schritt 5). Knowledge Graph und SSF als zweiter Fremdimpuls (Schritt 4).

## Ursprünglich offene Fragen

1. **Quellenliste:** Reichen WDR und Deutschlandfunk für Sundern zum Start? Darf tagesschau verwendet werden (Lizenz)?
2. **Knowledge Graph:** Wer baut die lesende Schnittstelle in SSF – oder gibt es schon einen anderen Zugang zu den Knoten?
3. **Häufigkeit:** Ein Traum je Nacht für jede schlafende Figur, oder nur für Figuren mit Kreativität über einer Schwelle?
4. **Sichtbarkeit:** Sollen Spieler Träume auch außerhalb von Gesprächen sehen können (z. B. am Morgen im Café)?
