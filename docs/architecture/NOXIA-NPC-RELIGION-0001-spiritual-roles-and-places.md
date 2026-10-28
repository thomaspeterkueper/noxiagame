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
3. als nächsten Vergleichspilot eine nichtchristliche geistliche Rolle in derselben Architektur anlegen;
4. erst danach Kalender-/Veranstaltungslogik ergänzen;
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
