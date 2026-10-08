# NOXIA-LIVING-0009 – Reibung, Abwechslung und Bewegung

Status: accepted (Reibung, Abwechslung, Mangel), proposed (Umzüge in der Live-Welt)
Date: 2026-10-08
Code: `lib/game/population/socialFriction.ts`, `relocation.ts`, `visitTarget.ts`, `actionEffects.ts`, `decision.ts`, `engine.ts`
Test: `npm run test:social-dynamics`, `npm run test:colony-run`

## Kontext

Nach NOXIA-LIVING-0008 waren Beziehungen begrenzt und unterschiedlich, aber die Kolonie erreichte weiter nach zwei Monaten einen festen Zustand. Es fehlten Quellen von Veränderung: Jede Begegnung verlief gleich, niemand langweilte sich, Mangel hatte keine Folgen, niemand zog um.

## Entscheidung

### 1. Begegnungen haben einen Ausgang

Jede neue Begegnung endet neutral, im Konflikt oder mit Hilfe (`encounterOutcome`).

- **Reizbarkeit** einer Person ergibt sich aus Müdigkeit, Hunger, Langeweile, Unsicherheit, Wut, Schmerz, gedrückter Stimmung und Mangel in der Siedlung.
- **Konflikt** wird wahrscheinlicher mit der Reizbarkeit beider, geringer Verträglichkeit, bestehender Abneigung und Mangel. Enge Bindungen dämpfen ihn.
- **Hilfe** wird wahrscheinlich, wenn jemand sie braucht und das Gegenüber wohlgesinnt ist. Unter Mangel haben Menschen weniger zu geben.

Der Ausgang ist deterministisch: Die „Ziehung" ist ein Hashwert aus Tick und Paar. Gleicher Zustand ergibt denselben Ausgang.

Ein Konflikt wird für beide als `person_conflict` gespeichert, Hilfe für den Empfänger als `person_assistance`. Erinnerung, Beziehung und Affekt folgen wie bei jedem Ereignis dieser Art.

### 2. Abwechslung als sechstes Bedürfnis

`variety` sinkt durch Routine und steigt nur durch wirklich Neues: neue Menschen, ein neuer Wohn- oder Arbeitsort. Das tägliche Treffen mit bekannten Kollegen zählt nicht.

Menschen vertragen Routine verschieden gut. Jede Person hat eine Untergrenze (`varietyFloor`), unter die das Bedürfnis von selbst nicht sinkt: etwa 0,5 bei Häuslichen, etwa 0,1 bei Neugierigen. Sie kommt aus dem Trait `novelty_seeking`, sonst aus einem festen Wert je Person.

Langeweile macht reizbar, lenkt in der Freizeit zu Menschen, die man mag, aber kaum kennt, und führt bei Neugierigen irgendwann zum Wunsch, weiterzuziehen.

Auch Kontakt nutzt sich jetzt ab: Das Bedürfnis `social` sinkt stündlich und wird vor allem durch enge Bindungen gestillt.

### 3. Mangel

Die Versorgung einer Siedlung (0 bis 1) wirkt dreifach: Eine Mahlzeit stillt weniger, alle werden reizbarer, und unter 0,5 sinkt das Sicherheitsgefühl. In der Live-Welt kommt der Wert aus `locations.is_supplied` (versorgt 1,0, sonst 0,4).

### 4. Umzug und Arbeitswechsel

`decideRelocation` entscheidet einmal am Tag, ob eine Person gehen will: wegen Eintönigkeit, schlechter Gesellschaft am Ort oder Mangel. Enge Bindungen am Ort halten. Gewählt wird ein Ort mit freiem Platz, bevorzugt in der Nähe von Freunden und mit guter Versorgung. Nach einem Wechsel folgt ein Jahr Ruhe, außer bei ernstem Mangel.

## Stand in der Live-Welt

| Teil | Live |
|---|---|
| Ausgang von Begegnungen | aktiv |
| Mangel aus `is_supplied` | aktiv |
| Abnutzung von Kontakt | aktiv |
| Besuchsziel nach Einsamkeit oder Langeweile | aktiv |
| Bedürfnis Abwechslung | aktiv nach Migration `20261008060000_person_need_variety.sql` |
| Umzug und Arbeitswechsel | nur im Forschungslauf |

Umzüge werden live nicht ausgeführt, weil Wohnen und Arbeit den Systemen für Mietverhältnisse, Immobilien und Stellen gehören. Die Entscheidung liegt als reine Funktion vor und muss dort angeschlossen werden.

## Wirkung im Forschungslauf

31 Personen in fünf Siedlungen, zehn Spieljahre:

| Größe | Jahr 1 | Jahr 5 | Jahr 10 |
|---|---|---|---|
| Beziehungen | 170 | 334 | 430 |
| Enge Bindungen | 110 | 52 | 45 |
| Konflikte pro Tag | 0,7 | 1,1 | 1,0 |
| Hilfe pro Tag | 0,7 | 0,7 | 1,0 |
| Umzüge pro Jahr | 22 | 18 | 15 |

Die Kolonie pendelt sich nicht mehr ein. In zehn Jahren gab es 174 Wechsel, die Siedlungen sind am Ende ungleich groß (9, 9, 5, 5, 3).

Mangel im Szenario (drei Jahre, 120 Tage Versorgung 0,3 in einer von fünf Siedlungen): Die Konflikte in der ganzen Kolonie steigen von 0,9 auf 1,6 pro Tag, die belasteten Beziehungen von unter 1 auf 7,5, und einige Bewohner verlassen die Siedlung. Das Vertrauen liegt auch ein Jahr später noch etwas niedriger als im Vergleichslauf.

## Grenzen

- Die Raten sind gesetzt, nicht gemessen. Sie sind über Konstanten in `socialFriction.ts`, `relocation.ts` und `actionEffects.ts` einstellbar.
- In einer einzelnen dichten Siedlung, in der jeder jeden kennt, gibt es nichts Neues mehr. Dort bleibt die Langeweile, und es ziehen kaum Menschen um. Neue Gesichter kommen bisher nur durch Umzüge, nicht durch Geburten oder Zuzug.
- Im Lauf dauert ein Besuch eine Stunde und bleibt in der Siedlung, ein Umzug geschieht sofort.
- Angst entsteht aus Mangel bisher nicht, weil die Engine dafür kein Krisenereignis erzeugt.
