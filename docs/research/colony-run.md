# Forschungslauf der Kolonie

Rechnet die lebende Bevölkerung im Zeitraffer durch, ohne die Live-Welt zu berühren. Entscheidung: `docs/decisions/NOXIA-TIME-0001-time-scale-and-research-run.md`.

## Aufruf

```
npm run research:colony -- --years 10 --people 31 --settlements 5
npm run research:colony -- --days 90 --snapshot experiments/colony/tharsis.snapshot.json --out experiments/colony/out/lauf1
npm run research:colony -- --years 1 --scenario experiments/colony/konflikt.scenario.json
```

| Option | Bedeutung |
|---|---|
| `--years`, `--days`, `--hours` | Dauer in Spielzeit |
| `--people`, `--settlements` | Größe einer künstlichen Kolonie, wenn kein Abbild angegeben ist |
| `--snapshot` | Abbild der echten Kolonie, erzeugt mit `experiments/colony/export-snapshot.sql` |
| `--scenario` | Eingriffe als JSON-Liste, siehe unten |
| `--out` | Pfad-Präfix für `.days.csv` (eine Zeile je Spieltag), `.final.json` (Endzustand), `.moves.json` (Umzüge) und `.spielraum.json` (Spielraum je Siedlung und Tag) |
| `--no-friction`, `--no-relocation` | einen Mechanismus abschalten, um seinen Beitrag zu sehen |

## Szenario: die Frage „was wäre, wenn"

Eine Liste von Eingriffen. `tick` zählt Spielstunden ab Beginn des Laufs.

```json
[
  { "tick": 252, "type": "person_conflict", "personId": "A", "otherPersonId": "B" },
  { "tick": 400, "type": "workplace_accident", "personId": "A", "severity": 0.8 },
  { "tick": 900, "type": "crisis_experience", "personId": "C", "severity": 0.9 }
]
```

Möglich sind `person_conflict`, `person_assistance`, `shared_work`, `crisis_experience`, `loss_experience` sowie die Gesundheitsereignisse `workplace_accident`, `environmental_exposure` und `exhaustion`. Ein Ereignis mit `otherPersonId` wirkt auf beide Personen, mit `"mutual": false` nur auf die erste.

Mit `supply` ändert sich die Versorgung einer Siedlung, etwa für einen Mangel und sein Ende:

```json
{ "tick": 8760, "type": "supply", "locationId": "settlement-0", "level": 0.3 }
```

Mit `reassign` wechselt eine Person Arbeits- oder Wohnort, etwa um Menschen zu trennen oder zusammenzubringen:

```json
{ "tick": 720, "type": "reassign", "personId": "A", "assignment": "work", "tileEntityId": "anderer-arbeitsplatz" }
```

Zwei Läufe mit und ohne Szenario sind bis zum ersten Eingriff identisch. Jede Abweichung danach ist Folge des Eingriffs.

## Was der Lauf abbildet

Tagesrhythmus und Schlaf, Arbeit und Bedürfnisse, Begegnungen mit Ausgang (neutral, Konflikt, Hilfe), Besuche, Umzug und Arbeitswechsel, Versorgung, Erinnerung und Beziehung, Affekt und Schmerz.

Nicht abgebildet, weil im Live-Tick noch an die Datenbank gebunden: Wirtschaft, Bau, Familien und Geburten, Wissen und Kolonie-Druck. Ein Besuch dauert eine Stunde und bleibt in der Siedlung, ein Umzug geschieht sofort. Benannte Personen entscheiden hier wie alle anderen und nicht nach ihrer Rollenlogik.

## Erster Befund (2026-10-08)

Zehn Spieljahre, 31 Personen in fünf Siedlungen, ohne Eingriffe:

| Größe | Verlauf |
|---|---|
| Schlaf | 8 Stunden täglich, über die ganze Zeit |
| Bekanntheit | nach 13 Tagen bei allen Paaren auf dem Höchstwert |
| Vertrauen | nach 28 Tagen bei allen Paaren auf dem Höchstwert |
| Zuneigung | nach 68 Tagen bei allen Paaren auf dem Höchstwert |
| Beziehungen | 56 am ersten Tag, 56 nach zehn Jahren, von 930 möglichen |
| Stimmung | ab dem ersten Monat konstant bei 0,16 |

Nach gut zwei Monaten ändert sich nichts mehr. Die Gründe liegen im Modell:

1. **Beziehungen können nur wachsen.** Jede neutrale Begegnung erhöht Bekanntheit, Vertrauen und Zuneigung. Es gibt kein Verblassen ohne Kontakt, und die normale Simulation erzeugt keine negativen Ereignisse.
2. **Das Netz ist durch Wohn- und Arbeitsort festgelegt.** Niemand wechselt Arbeit oder Wohnung und niemand besucht jemanden. Wer sich am ersten Tag nicht trifft, trifft sich nie.
3. **Eingriffe waschen sich aus.** Ein Konflikt senkt das Vertrauen spürbar, aber die täglichen Begegnungen heben es binnen Wochen wieder auf den Höchstwert.

Die Folge für das Spiel: Mehr Tempo allein zeigt nicht mehr Veränderung, sondern denselben Stillstand schneller. Die Simulation braucht Quellen von Veränderung: Verblassen von Beziehungen, abnehmender Ertrag wiederholter Begegnungen, Reibung im Alltag, Wechsel von Arbeit und Wohnung, Besuche.

## Zweiter Befund nach NOXIA-LIVING-0008 (2026-10-08)

Mit Sättigung, begrenzten engen Bindungen und Verblassen, 31 Personen in einer Siedlung, drei Spieljahre:

| Größe | Verlauf |
|---|---|
| Vertrauen im Mittel | 0,62 statt 1,0 |
| Enge Bindungen | genau 4 je Person, bei 14 bis 16 Bekannten |
| Freude im Mittel | 0,54 am ersten Tag, 0,18 ab dem ersten Monat |
| Gleichgewicht | weiterhin nach etwa zwei Monaten erreicht |

Die Beziehungen sind jetzt unterschiedlich und begrenzt, und Trennung lässt sie verblassen. Von selbst entsteht im Alltag aber noch keine Veränderung. Offen bleiben Reibung im Alltag und Bewegung im Netz.

## Dritter Befund nach NOXIA-LIVING-0009 (2026-10-08)

Mit Reibung, Abwechslung und Umzügen, 31 Personen in fünf Siedlungen, zehn Spieljahre:

| Größe | Jahr 1 | Jahr 5 | Jahr 10 |
|---|---|---|---|
| Beziehungen | 170 | 334 | 430 |
| Enge Bindungen | 110 | 52 | 45 |
| Konflikte pro Tag | 0,7 | 1,1 | 1,0 |
| Umzüge pro Jahr | 22 | 18 | 15 |

Die Kolonie pendelt sich nicht mehr ein. Das Netz wächst über die ganze Zeit, enge Bindungen lösen sich nach Umzügen und bilden sich neu, die Siedlungen werden ungleich groß.

In einer einzelnen dichten Siedlung bleibt es dagegen ruhig: Jeder kennt jeden, es gibt nichts Neues und kaum einen Ort, an den man ziehen könnte.

## Vierter Befund: Spielraum als Messgröße (2026-10-08)

Entscheidung und Definition: `docs/decisions/NOXIA-OMNI-0001-spielraum-as-measure.md`. 31 Personen, drei Spieljahre, Mittel des dritten Jahres:

| Lauf | Spielraum | Handeln | Beziehung | Ort | Stimmung |
|---|---|---|---|---|---|
| fünf Siedlungen | 0,64 | 0,56 | 0,74 | 0,62 | 0,13 |
| ohne Reibung | 0,62 | 0,56 | 0,70 | 0,59 | 0,14 |
| ohne Umzüge | 0,67 | 0,47 | 0,78 | 0,83 | 0,12 |
| eine dichte Siedlung | 0,59 | 0,46 | 1,00 | 0,25 | 0,41 |

Mangel (120 Tage Versorgung 0,3 in einer Siedlung):

| Größe | vorher | tiefster Wert | Verlust | Tage bis zur Regeneration |
|---|---|---|---|---|
| Spielraum der betroffenen Siedlung | 0,65 | 0,54 | 18 % | 0 |
| Stimmung der Kolonie | 0,16 | 0,05 | 67 % | im Lauf nicht erreicht |

Die Stimmung sinkt über drei Jahre auch ohne Mangel leicht (auf 0,13). Mit Mangel liegt sie am Ende bei 0,10.

Die Verteilung ist in allen Läufen fast gleich: Gini 0,02 bis 0,04, niemand unter 0,35.
