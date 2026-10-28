# NOXIA-NPC-RELIGION-0001 — Geistliche Rollen, religiöse Orte und Resonanzplätze

Status: architecture baseline
Date: 2026-10-14

## Grundsatz

Religiöse und weltanschauliche Rollen sind Teil derselben persistenten Personenarchitektur wie alle anderen Berufe und Gemeinschaftsrollen.

Ein Priester, eine Pfarrerin, ein Imam, eine Rabbinerin, eine Ordensperson oder eine religiöse Lehrkraft ist:
- eine normale persistente Person,
- mit Wohnung, Arbeit, Beziehungen, Bedürfnissen, Erinnerungen und eigener Biografie,
- ohne privilegierten Zugriff auf Ground Truth,
- ohne besondere Dialog-/LLM-Klasse,
- ohne automatisch höhere Moral, Weisheit oder Glaubensgewissheit.

Die Rolle beschreibt soziale Funktion und institutionellen Kontext, nicht die Wahrheit ihrer Überzeugungen.

## Funktionen

Je nach Tradition und Person können geistliche Rollen unter anderem tragen:
- Gottesdienst / Gebet / Ritual,
- Lehre,
- Seelsorge,
- Gemeinschaftsorganisation,
- Gespräche,
- Begleitung bei Lebensereignissen,
- Pflege von Tradition und Erinnerung.

Diese Funktionen werden später aus normalen Handlungen, Terminen, Innenraumpräsenz, Beziehungen und Wissen zusammengesetzt. Es gibt zunächst keinen separaten "Religion-Tick".

## Gebäude

Gemeinsame Fallback-Topologie:
`sacred-place-standard-v1`

Sie kann vorerst für folgende Building Types verwendet werden:
- church
- mosque
- synagogue
- temple
- shrine
- sacred_place

Die gemeinsame Topologie ist nur eine räumliche Abstraktion. Sie behauptet nicht, dass die Traditionen architektonisch oder theologisch gleich sind. Sobald ein konkreter Ort Gameplay-relevant wird, kann er eine eigene Topologie erhalten.

## Omnizedenz

Omnizedenz erhält eine getrennte Ortsfamilie:

- `resonance_place`
- `omnizedenz_resonance_place`

mit `resonance-place-standard-v1`.

Ein Resonanzplatz ist **kein Tempel-Ersatz** und kein privilegiertes Wahrheitszentrum. Er ist ein Ort für Begegnung, Gespräch, Reflexion, Lesen, gemeinsames Verweilen und Beobachtung.

Der vorläufige Rollenbegriff `resonance_facilitator` ist ausdrücklich **kein Klerus**. Er beschreibt nur eine mögliche Gastgeber-/Begleitfunktion und darf später umbenannt oder entfernt werden, wenn der Omnizedenz-Kanon etwas anderes verlangt.

## Alltag

Geistliche NPCs sollen nicht dauerhaft in ihrem Sakralbau stehen.

Ihre normalen Tagesverläufe können enthalten:
- Wohnen und Schlafen,
- Weg zum Arbeits-/Gemeinschaftsort,
- Büro-/Vorbereitungszeit,
- Gespräche und Seelsorge,
- Lehre,
- Gottesdienst/Ritual zu bestimmten Zeiten,
- Besuche bei Menschen,
- private Freizeit,
- eigene soziale Beziehungen.

Damit werden sie zu Personen und nicht zu stationären Funktionsfiguren.

## Wissen und Überzeugung

Religiöse Aussagen eines NPCs sind:
- Überzeugungen,
- Interpretationen,
- Traditionen,
- Zeugnisse oder Erinnerungen,

nicht automatisch Ground Truth.

Das bestehende epistemische Beobachtungsmodell bleibt vollständig gültig.

## Keine unnötige Detailtiefe

Gemäß Adaptive Detail Resolution werden Konfession, Liturgie, institutionelles Recht und Ritualabläufe nur dort tiefer modelliert, wo sie für eine konkrete Person, einen Ort, eine Handlung oder einen Konflikt relevant werden.

Ein gewöhnlicher Kirchenbesuch benötigt keine vollständige Simulation einer Religionsorganisation.

## Nächste sichere Schritte

1. ✅ erster geistlicher NPC an realer Kirche produktiv: Elias Hartmann · St. Johannes Sundern;
2. reale Kirchen/Moscheen/Tempel/Synagogen weiter über die gemeinsame Fallback-Familie anbinden;
3. ✅ Vertreter weiterer Religionen in derselben Architektur angelegt (28.10.2026, siehe unten);
4. ✅ Spielwoche (Montag = Tag 0) und Termine je Gotteshaus (28.10.2026);
5. Resonanzplätze der Omnizedenz als eigene Weltorte definieren, sobald reale/fiktive Standortentscheidungen vorliegen.


## Pilot: Elias Hartmann · St. Johannes Sundern

Der erste vollständige geistliche NPC ist produktiv angelegt:

- `person_key = earth-sundern-st-johannes-priest-001`
- Rolle: `priest`, öffentlich „Pfarrer · St. Johannes“
- Arbeitsort: reales importiertes OSM-Feature St. Johannes, kein dupliziertes `tile_entity`
- Wohnung: reguläre Mietwohnung im bestehenden Earth-Wohnungsmarkt
- Bedürfnisse, Wirtschaftsakteur und Life State: normale Living-Population-Systeme
- Alltag: normaler Person-Tick; keine eigene Religionssimulation
- soziale Basis: eine schwache lokale Bekanntschaft zu Mika Berger, keine vorgefertigte Freundschaft
- Surface Presence: bei Arbeit `region_feature_anchor` an St. Johannes
- World-Lab: autoritative `person_surface_presence` hat Vorrang vor Gebäude-Fallbacks

Damit ist der Pilot nicht nur Seed-Datenbestand, sondern in derselben Personen-, Wohn-, Beziehungs-,
Beobachtungs- und Kartenarchitektur wie andere Bewohner verankert.

### Bewusste Grenze

Der Gemeindeträger existiert als institutioneller Arbeitgeberbezug, aber die geistliche Stelle ist
noch nicht in die automatische Payroll aufgenommen. Einnahmen und Finanzierung religiöser
Institutionen sind noch nicht modelliert; deshalb wird hier keine künstliche Geldquelle eingeführt.



## St. Johannes als sozialer Ort

Der Pilot ist um echte Ortsaktivität erweitert.

Grundregel:
- keine zweite Religionsuhr und kein eigener Religion-Tick;
- Zeitfenster werden ausschließlich aus dem autoritativen Simulationstick abgeleitet;
- reale Orte werden über `region_feature_id` besucht, nicht als künstliche `tile_entities` dupliziert;
- temporäre Besuche erzeugen normale Presence und können normale Encounter auslösen;
- Encounter verändern Beziehungen/Erinnerungen über dieselbe Population-Pipeline wie an anderen Orten.

Für St. Johannes existieren zunächst zwei kleine Aktivitätsfenster:
- eine regelmäßige offene Gemeinde-/Gesprächszeit;
- eine wöchentliche Gottesdienst-/Andachtszeit.

Der erste mögliche Besucher stammt ausschließlich aus einer bereits vorhandenen lokalen Beziehung
zu Elias. Teilnahme an einem solchen Termin wird **nicht** als Beweis für Religionszugehörigkeit,
Glauben oder Zustimmung interpretiert. Der Zustand trägt deshalb explizit
`attendanceDoesNotImplyBelief=true`.

Schlaf und Reisen haben Vorrang. Ist Elias nicht verfügbar, findet im Pilot kein von ihm
getragenes Fenster statt.

Die erste Version hält die Teilnehmerzahl absichtlich klein. Wachstum soll später aus
tatsächlichen Beziehungen, wiederholten Besuchen und gegebenenfalls expliziter Ortsaffinität
entstehen — nicht aus zufälliger Zuweisung von Religion.

### Technische Wiederverwendung

Die Erweiterung ist nicht kirchenspezifisch:
- `PersonAssignment.regionFeatureId` kann reale Arbeits- und Besuchsorte tragen;
- Surface Presence kennt `region_feature_anchor`;
- Population Presence und Encounter erkennen gemeinsame reale Orte;
- dieselbe Mechanik kann später Museen, Parks, Moscheen, Synagogen, Tempel und andere
  reale Gemeinschaftsorte tragen.

Damit bleibt Religion Domäneninhalt; Ortsbesuch, Co-Location und Begegnung bleiben
allgemeine Simulationsmechanik.

## Fortsetzung

Philosophische Wege (Weg des DaVaRu, Omnizedenz), die Rolle Omnizedent/in und die Gesprächshaltungen: siehe `NOXIA-NPC-RELIGION-0002-philosophie-npcs-davaru-omnizedenten.md`.


## Vertreter der Religionen (Thomas, 28.10.2026)

Thomas: „katholisch, evangelisch, muslimisch, jüdisch, hinduistisch, buddhistisch – müssen nicht alle in Sundern sein, aber wichtig, dass sie vertreten sind und man mit ihnen sprechen kann.“

| Religion | Person | Rolle | Ort (real, OSM) | Wohnung (reales Haus) | Termine |
|---|---|---|---|---|---|
| katholisch | Elias Hartmann | `priest` | St. Johannes, Sundern | öffentlicher Wohnblock Selmecke | täglich 18 Uhr offene Zeit, Sonntag 10 Uhr Gottesdienst |
| evangelisch | Katrin Vogelsang | `pastor` | Lukaskirche, Sundern | Bäumkesweg 1 | Dienstag 18 Uhr offene Zeit, Sonntag 10 Uhr Gottesdienst |
| Islam (sunnitisch) | Yusuf Demir | `imam` | Hamidiye-Moschee, Frankfurt-Sachsenhausen | Weckmarkt 3 | Freitag 13 Uhr Freitagsgebet |
| Judentum | David Rosenthal | `rabbi` | Baumweg-Synagoge, Frankfurt | Lange Straße 22 | Freitag 18 Uhr Schabbatbeginn, Samstag 10 Uhr Schabbat-Gottesdienst |
| Hinduismus | Mahesh Pandya | `priest` (Pujari) | Dwarkadhish-Tempel, Dvārakā | Wohnhaus in der Nähe | täglich 7 und 19 Uhr Aarti |
| Buddhismus (Fo Guang Shan) | Miao Ling | `monastic` | Fo-Guang-Shan-Tempel, Frankfurt | im Tempel | Sonntag 10 Uhr Andacht und Dharma-Vortrag |

Migrationen: `20261028150000_religious_representatives.sql`, Korrektur `20261028151500_rabbi_home_correction.sql` (die erste Wohnung des Rabbiners war das katholische Kolpinghaus).

- **Gleiches Muster wie die Omnizedent/innen:** normale aktive Personen, Arbeitsort am realen Gotteshaus, Wohnung als Zuweisung an ein reales Wohnhaus ohne Eigentumswechsel. Gemeindeträger als Institution ohne Lohnsatz, weil Einnahmen religiöser Institutionen noch nicht modelliert sind.
- **Erfunden, nicht stellvertretend:** Die Figuren sind erfunden und sprechen nicht für die realen Gemeinden. Bios bleiben allgemein.
- **Gespräch:** Alle werden über ihre öffentliche Rolle als `clergy` erkannt (`worldviewVoices.ts`). Neu: Sie erklären ihre Religion aus der Innensicht, genau, ohne Klischees, und sagen offen, was sie nicht sicher wissen. Die Tradition steht in der Bio, die das Gespräch mitbekommt.
- **Rollen:** `priest` gilt jetzt auch für den Hinduismus.
- **Spielwoche:** Tag = floor(tick / 24) mod 7, Tag 0 = Montag (`WEEKDAY`, `weekPhase` in `realPlaceActivity.ts`). Weiterhin keine zweite Uhr. Dabei korrigiert: Der Gottesdienst an St. Johannes lag auf Phase 108 = Freitag 12 Uhr; jetzt Sonntag 10 Uhr.
- **Ortszeit:** Termine zählen in Spielstunden ohne Zeitzone; in Dvārakā liegt die Aarti damit nicht genau auf indischer Ortszeit. Offen, bis es Ortszeiten im Tagesablauf gibt.
- **Besucher:** wie beim Pilot nur aus bestehenden Beziehungen (Zuneigung ab 0,5); Teilnahme heißt nicht Zugehörigkeit.

## Innenräume (Thomas, 28.10.2026: „haben die Kirchen und Begegnungsstätten schon Innenräume?“ – „ja mach das“)

Vorher bekam jedes Gotteshaus denselben Kirchenraum, die Hubertushalle hatte keinen Raum, und Personen der Simulation erschienen drinnen nicht.

- **Räume je Religion** (`lib/game/landmarks/interiors.ts`): Kirche (`worship`, wie bisher), Moschee (Gebetsteppich, Mihrab, Minbar, Waschraum, Schuhregal), Synagoge (Toraschrein, Ewiges Licht, Bima, Bänke), Hindu-Tempel (Schrein, Aarti-Lampen, Halle mit Säulen, Glocke), buddhistischer Tempel (Buddhafigur, Räucherwerk, Gong, Meditationskissen), Gemeindesaal (Bühne, Stuhlreihen, Tische, Teeküche, Pinnwand). Typische Grundrisse, nicht vermessen; Texte sachlich aus der Innensicht. Test: Jeder Ort im Raum ist zu Fuß erreichbar.
- **Auswahl:** nach OSM-Religion (`worshipRoomKind`). Kartenpunkte bringen ihre Tags mit; reale Gebäude kennen in der Kachel nur die Nutzung, die Religion holt `/api/world-lab/place-info` aus den Ortsdaten.
- **Betretbar in der Weltkarte:** neben Wahrzeichen jetzt auch reale Gebäude mit Nutzung Gotteshaus oder Gemeindezentrum (Lukaskirche, Hubertushalle, Dwarkadhish-Tempel …) und das Haus der CAMALEO-ArtLounge (`buildingRoomKind`).
- **Personen drinnen** (`lib/game/population/placePresence.ts`): Der Raum zeigt, wer laut Simulation dort ist – über die OSM-Kennung des Gebäudes, bei Kartenpunkten über den Abstand (45 m). Wer dort arbeitet, steht vorne (`hostAt`), Besucher auf den Plätzen (`gatherAt`). Bei Terminen steht der Anlass dabei („Freitagsgebet“, „Resonanzrunde“). Die Gebäudetafel nennt schon draußen, wer drinnen ist.
- **Gespräch:** Ansprechen führt zum Gespräch mit der echten Person (ihre ID, Rolle, Biografie, Gesprächsstimme); sie begrüßt von sich aus und weiß, wo sie ist und was gerade stattfindet.
- **Grenze:** Wer gerade nicht da ist, steht auch nicht im Raum. Außerhalb der Termine sind Gotteshäuser oft leer, Träger(innen) arbeiten aber tagsüber meist dort.

## Gottesdienste erleben (Thomas, 28.10.2026: „how about churches? gottesdienst?“ – „alle 4“)

Vorher kam zu jedem Termin genau eine Person (die erste enge Bekannte des Gastgebers), auf der Karte sah man nichts, und im Raum lief kein Ablauf.

1. **Gemeinde** (`lib/game/population/worship.ts`, `pickCongregation`, Test vorhanden). Zu einem Termin kommen Menschen mit enger Beziehung zur Gastgeberin oder zum Gastgeber (Zuneigung ≥ 0,5) und ein Teil der Nachbarschaft (Wohnung bis 900 m, je näher, desto eher; rund 30 %). Höchstzahl je Anlass: Gottesdienst und Freitagsgebet 10, Schabbat und Aarti 8, Andacht und Resonanzrunde 6, offene Gesprächszeit 2. Fester Zufall je Person und Termin: jeder Tick eines Termins ergibt dieselbe Gemeinde, nächste Woche eine andere. Wer arbeitet, schläft oder unterwegs ist, kommt nicht. Keine Konfession wird erfunden; Teilnahme bedeutet nicht Glauben. Die Gastgeberin oder der Gastgeber ist für die Dauer selbst am Ort (`last_action` `host:…`) und steht im Raum vorne.
2. **Auffindbar.** `/api/world-lab/worship` liefert je Gotteshaus laufenden und nächsten Termin aus der einen Spieluhr (`tick_log`, Tick = Stunde) mit echten Zeitpunkten. Weltkarte: Zielgruppe „Gottesdienste und Gebete“ (z. B. „St. Johannes · Gottesdienst So 10 Uhr“ oder „jetzt: …“), goldene Plakette mit Glocke über dem Haus, solange etwas läuft, und ein Knopf „◉ Jetzt: … “ für das Nächste bis 6 km. Die Tafel des Hauses nennt Termin, Gastgeber und Zahl der Besucher.
3. **Teilnehmen.** Im Innenraum zeigt eine Karte den Ablauf nach Tradition (katholische Messe, evangelischer Gottesdienst, Freitagsgebet, Schabbat am Abend und am Morgen, Aarti, Andacht mit Dharma-Vortrag, Resonanzrunde) mit dem aktuellen Abschnitt nach echter Uhr. Im Abschnitt Predigt/Hutbe/Drascha/Impuls lässt sich die Ansprache hören: `npc-conversation` mit `sermon` – 4 bis 6 Sätze aus der Tradition, Texte nur sinngemäß, nie werbend, Gäste ausdrücklich willkommen; zählt nicht als Gesprächszug (keine Wiederholungssperre). „Platz nehmen“ setzt die Figur in eine Bank. Die Gemeinde sitzt in den Bänken (`crowdSpots`), danach kann man mit allen reden.
4. **Sondertermine.** `population_events` vom Typ `place_activity_scheduled` mit `personKey`, `kind`, `label`, `startsTick`, `endsTick` gelten zusätzlich zum Wochenplan (Tick, Karte, Innenraum). Erster Einsatz: Probe-Gottesdienst in St. Johannes am 28.10.2026, 20–22 Uhr.
