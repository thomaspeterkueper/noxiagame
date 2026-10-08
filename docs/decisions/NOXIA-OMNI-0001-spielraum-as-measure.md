# NOXIA-OMNI-0001 – Spielraum als Messgröße

Status: accepted (Messung im Forschungslauf)
Date: 2026-10-08
Code: `lib/game/population/spielraum.ts`, `lib/research/colony/colonyRun.ts`
Test: `npm run test:spielraum`
Bezug: Kanonstand der Omnizedenz vom 24.09.2026 (Abschnitte 5 bis 8)

## Kontext

Die Simulation zeigt bisher Befinden: Stimmung, Freude, Vertrauen. Die Omnizedenz fragt etwas anderes: wie viele Verläufe einer Person tatsächlich offenstehen. Ihr Kanon nennt drei Prüfdimensionen: gegenwärtige realisierbare Möglichkeiten, Folgewirkungen auf künftige Möglichkeiten und Regenerationsfähigkeit nach Beschädigung.

Dieser Schritt macht Spielraum messbar. Er ändert kein Verhalten: Niemand entscheidet anders, weil Spielraum gemessen wird.

## Entscheidung

Spielraum einer Person an einem Tag, 0 bis 1, aus drei Anteilen:

| Anteil | Gewicht | Was gezählt wird |
|---|---|---|
| Handeln | 0,40 | wie viele Handlungen der besten nahekommen, gemittelt über die wachen Stunden. Wer hungert oder erschöpft ist, hat eine einzige dominante Handlung und damit keinen Spielraum, obwohl technisch alles möglich bleibt. |
| Beziehung | 0,35 | an wie viele Menschen sich die Person wenden kann. Eine enge Bindung zählt doppelt, eine belastete Beziehung zieht etwas ab. |
| Ort | 0,25 | wie viele andere Wohnungen und Arbeitsplätze ihr offenstehen, verringert bei schlechter Versorgung der Siedlung. |

Jede Zählung sättigt: Die fünfte Möglichkeit bringt weniger als die zweite.

Die Prüfdimensionen des Kanons:

- **Gegenwart:** der Tageswert.
- **Folgewirkung:** sein Verlauf über die Zeit.
- **Regeneration:** `spielraumRegeneration` misst nach einer Beschädigung, wie viel Spielraum verloren ging und nach wie vielen Tagen wieder vergleichbar viel da ist. Gefragt ist nicht, ob der frühere Zustand zurückkehrt.

Dazu Verteilungsgrößen: die Person mit dem geringsten Spielraum, der Anteil mit engem Spielraum (unter 0,35) und der Gini-Koeffizient.

Der Forschungslauf gibt die Werte je Tag aus, je Person am Ende und als Tagesreihe je Siedlung (`.spielraum.json`).

## Grenzen der Messung

- **Die Operationalisierung ist eine Setzung.** Die drei Anteile, ihre Gewichte und Schwellen folgen nicht aus dem Kanon. Sie sind eine von mehreren möglichen Übersetzungen.
- **Gemeinraum wird nicht gemessen.** Der Mittelwert einer Siedlung ist eine Summe einzelner Spielräume. Der Kanon sagt ausdrücklich, dass Gemeinraum mehr ist. Dafür fehlen der Simulation Formationen.
- **Gezählt wird, was die Simulation kennt.** Sie kennt neun Handlungen, Beziehungen zwischen Paaren und Wohn- und Arbeitsorte. Bildung, Besitz, Recht und Macht kommen nicht vor.
- **Die Messung belegt die Philosophie nicht.** Sie zeigt, ob der Begriff in dieser Simulation etwas unterscheidet.

## Befund

31 Personen, drei Spieljahre. Stand: `docs/research/colony-run.md`, vierter Befund.

1. **Spielraum und Befinden laufen auseinander.** Eine einzelne dichte Siedlung hat die bessere Stimmung (0,41 gegen 0,13), aber den kleineren Spielraum (0,59 gegen 0,64): Alle kennen sich, aber es gibt kaum einen Ort, an den man gehen könnte.
2. **Mangel verengt und regeneriert.** In der betroffenen Siedlung fällt der Spielraum um bis zu 18 % und ist mit dem Ende des Mangels sofort wieder da. Die Stimmung der Kolonie erholt sich im Lauf nicht.
3. **Gebrauch verbraucht Möglichkeiten.** Ohne Umzüge ist der gemessene Spielraum höher (0,67 gegen 0,64), weil freie Plätze frei bleiben und Bindungen nicht reißen.
4. **Alltägliche Reibung ist im Spielraum nicht sichtbar.** Mit und ohne Konflikte liegt er fast gleich.
5. **Es gibt keine Ungleichheit.** Der Gini-Koeffizient liegt bei 0,02 bis 0,04, und niemand hat je engen Spielraum. Die Simulation hat keinen Mechanismus, der Spielraum ungleich verteilt.

Punkt 5 ist der wichtigste: Der Kanon fasst Macht als Fähigkeit, den Möglichkeitsraum anderer zu verändern. Solange niemand über Wohnung, Arbeit oder Zugang anderer verfügt, hat die Messung wenig zu unterscheiden.
