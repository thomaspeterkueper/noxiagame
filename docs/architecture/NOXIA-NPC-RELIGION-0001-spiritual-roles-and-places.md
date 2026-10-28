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
