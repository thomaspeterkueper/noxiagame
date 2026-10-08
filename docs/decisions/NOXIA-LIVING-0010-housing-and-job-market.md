# NOXIA-LIVING-0010 – Wohnungs- und Stellenmarkt für Personen

Status: proposed (Stufenplan), accepted (reine Regeln, Stufe 1)
Date: 2026-10-08
Code: `lib/game/population/housing.ts`, `employment.ts`, `access.ts`
Test: `npm run test:housing-market`
Bezug: NOXIA-LIVING-0009 (Umzugsentscheidung), NOXIA-OMNI-0001 (Spielraum)

## Kontext

Die Sozialwelt ist bisher symmetrisch: Niemand verfügt über Wohnung oder Arbeit eines anderen, und der gemessene Spielraum ist fast gleich verteilt. Umzüge existieren nur im Forschungslauf, als sofortiger Wechsel auf einen freien Platz.

Personen sollen wie Spieler über Miete, Eigentum und Stellen an Wohnung und Arbeit kommen. Dabei entscheidet nicht die Person allein: Vermieter und Arbeitgeber können ablehnen. Eine Wohnung, die nicht vergeben wird, ist kein realer Spielraum.

## Befund zum Ausgangszustand (Live, 2026-10-08)

| Gruppe | Personen | Lage |
|---|---|---|
| Benannte Leitungen in Tharsis | 7 | Arbeit, aber keine Wohnzuweisung |
| Unbenannte in Tharsis | 8 | „wohnen" im Verwaltungsgebäude, vier arbeiten auch dort |
| Prometheus, Mond, Phobos | 12 | Wohnzuweisung ohne Gebäude. Auf Mond und Phobos steht je ein leeres staatliches Habitat, auf Prometheus keines |
| Erde | 4 | in Wohnblöcken eines Spielers |
| Q1 | 1 | in einem staatlichen Habitat |

Dazu:

- Alle 25 Mietverhältnisse haben den Status `provided` ohne Miete, 12 davon ohne Vermieter.
- Keine Person hat ein Wirtschaftskonto (`person_economic_actors` ist leer). Lohn, Miete, Konsum und Immobilienkauf laufen deshalb für niemanden.
- Wohngebäude haben keine Kapazität. `residential_block` fehlt in `building_definitions`, `habitat` trägt nur `population_bonus = 100`.
- Es gibt 13 Wohngebäude, keines steht zum Verkauf, und kein Hotel.

Ein Markt braucht also zuerst Konten, Kapazitäten und einen bereinigten Bestand.

## Entscheidung

### Wohnformen

| Form | Bedeutung |
|---|---|
| `provided` | zugewiesen ohne Miete, der heutige Zustand |
| `rented` | Miete je Abrechnungsintervall (720 Ticks) an einen Vermieter |
| `owned` | selbstbewohntes Eigentum, gekauft zum Angebotspreis |
| `hotel` | Preis je Nacht, ohne Bindung: bei Ankunft, nach einer Räumung, während der Suche |
| `none` | ohne Wohnung: Ruhe erholt schlechter, das Sicherheitsgefühl sinkt |

### Wer entscheidet was

- **Die Person** sagt, dass sie wechseln will und wohin (`decideRelocation`, `chooseHousing`). Sie zieht nicht freiwillig ins Hotel und nur in etwas deutlich Besseres, außer sie muss.
- **Bezahlbarkeit** begrenzt das Angebot: Miete bis 40 % des Lohns, Kauf nur mit Preis plus sieben Tageslöhnen Reserve (wie `run_npc_property_market`), Hotel nur mit Geld für drei Nächte.
- **Der Vermieter** vergibt oder lehnt ab (`landlordDecision`). Öffentlicher Wohnraum prüft nur den Platz. Private Vermieter lehnen bei zu geringem Einkommen und nach einer Räumung im letzten Jahr ab, außer eine Kaution wiegt sie auf. Wer persönlich vermietet, kann jemanden ablehnen, den er nicht mag.
- **Der Vermieter setzt den Preis** (`adjustRent`): In einer vollen Siedlung steigt die private Miete um 5 % je Intervall, leerstehender Wohnraum wird billiger. Öffentliche Mieten bleiben fest.
- **Mietschulden** führen nach zwei unbezahlten Intervallen zur Räumung (`settleRent`).
- **Der Arbeitgeber** stellt ein oder lehnt ab (`employerDecision`): fehlende Qualifikation, frühere Kündigung, persönliche Abneigung.
- **Die Person** kann ein Stellenangebot ablehnen (`considerJobOffer`).

### Macht als Protokoll, nicht als Wert

Jede Vergabe, Ablehnung und jedes ausgeschlagene Angebot wird als `AccessRecord` festgehalten. `gatekeeperPower` und `summarizeAccess` werten aus, wer über wie viele Menschen entschieden hat, welcher Anteil des Vorhandenen wirklich zugänglich war und wer überall abgewiesen wurde.

Macht wird damit nicht eingebaut, sondern beobachtet: Sie zeigt sich als Asymmetrie in diesem Protokoll oder gar nicht.

## Stufenplan

| Stufe | Inhalt | Stand |
|---|---|---|
| 1 | Reine Regeln für Wohnen, Stellen und Zugangsprotokoll | fertig |
| 2 | Forschungslauf: Markt mit Löhnen, Mieten, Eigentum, Hotels. Spielraum zählt nur zugängliche Plätze. Über Spieljahre beobachten | offen |
| 3 | Live-Bestand bereinigen: Wohnungen für die sieben Leitungen, Gebäude für die zwölf ohne Gebäude, Verwaltung nicht als Wohnung. Kapazität je Wohngebäude, Hotel als Gebäudetyp, Konten und Lohn für Personen | offen, braucht Entscheidungen |
| 4 | Schattenbetrieb live: Personen treffen echte Entscheidungen gegen den Live-Bestand, protokolliert werden Zusage, Ablehnung und Spielraum. Nichts wird ausgeführt | offen |
| 5 | Atomarer Wohnungswechsel als Datenbankfunktion: Platz reservieren, alte Zuweisung beenden, neue anlegen, Mietverhältnis synchronisieren, bei Fehler alles zurück. Keine direkte Änderung von `current_location_id` | offen |
| 6 | Stellenwechsel entsprechend | offen |

Über Spieljahre lässt sich nur im Forschungslauf beobachten. Der Live-Schattenbetrieb läuft in Echtzeit und zeigt, ob die Entscheidungen auf dem echten Bestand plausibel sind.

## Offene Entscheidungen für Stufe 3

1. Wo wohnen die sieben benannten Leitungen: im vorhandenen Wohnblock eines Spielers in Tharsis, oder in einem neuen staatlichen Habitat?
2. Bekommt Prometheus ein Habitat, oder ziehen die vier dort Arbeitenden in eine andere Siedlung?
3. Wie viele Plätze hat ein Habitat, wie viele ein Wohnblock?
4. Wer betreibt Hotels: der Staat, Unternehmen, Spieler?
