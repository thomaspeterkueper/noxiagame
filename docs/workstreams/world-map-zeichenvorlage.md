# Zeichenvorlage für den Baukasten der Erdkarte

Festgelegt mit Thomas am 13.10.2026. Gilt für alles, was in `/world-lab` auf Gebäudeblöcke gelegt wird.

## Die drei Festlegungen

| Was | Festlegung | Warum |
|---|---|---|
| Zeichenart | **Fassaden von vorn**: Wandstücke und Dachflächen werden flach gezeichnet, die Karte legt sie schräg auf jede Wand | Echte Orte haben schräge Straßen; ein Wandstück passt auf jede Länge und Drehung |
| Blickwinkel | **2:1, geometrisch richtig**: Blick 30° von oben, um 45° gedreht. Ein Meter Höhe ist im Bild √1,5 ≈ 1,22 so lang wie ein Meter nach rechts | Ein gezeichnetes quadratisches Fenster bleibt auf der Karte quadratisch |
| Auflösung | **16 Pixel je Meter** | Ein Geschoss von 3 m ist 48 px hoch – genug für Sprossen und Türgriff; einzelne Stücke lassen sich später auf 32 px nachzeichnen |

## Was gezeichnet wird

Je Blockart drei Bilder, alle als PNG:

| Datei | Inhalt | Wiederholung |
|---|---|---|
| `wand-erdgeschoss.png` | ein Wandabschnitt im Erdgeschoss (Sockel, Tür oder Fenster) | nach rechts |
| `wand-obergeschoss.png` | ein Wandabschnitt eines Obergeschosses | nach rechts und nach oben (je Geschoss einmal) |
| `dach.png` | ein Stück Dachfläche, Ziegelreihen waagerecht, oben = zum First | in beide Richtungen, nahtlos |

Maße (Breite × Höhe in Pixeln):

| Blockart | wofür | Geschoss | Wandabschnitt | Dach |
|---|---|---|---|---|
| `house` | Wohnhaus | 3 m | 48 × 48 | 64 × 64 |
| `row` | Zeile, Mehrfamilienhaus, Schule | 3 m | 48 × 48 | 64 × 64 |
| `hall` | Halle, Lager, Gewerbe, Handel | 4 m | 96 × 64 | 64 × 64 |
| `factory` | Fabrik, Industriebau (nur Weltkarte) | 5 m | 96 × 80 | 64 × 64 |
| `church` | Kirche, Kapelle | 3,5 m | 64 × 56 | 64 × 64 |
| `shed` | Schuppen, Garage | 2,5 m | 48 × 40 | 64 × 64 |

Die Breite eines Wandabschnitts ist frei wählbar, solange sie ein Vielfaches von 16 px ist; die Höhe muss genau ein Geschoss sein. Dachbilder dürfen jede Größe haben, die ein Vielfaches von 16 px ist.

## Worauf beim Zeichnen zu achten ist

- **Von vorn und flach.** Keine Perspektive, keine Schatten von links oder rechts – die Karte dunkelt die abgewandte Seite selbst ab.
- **Nahtlos.** Der rechte Rand muss an den linken passen, beim Obergeschoss auch der obere an den unteren, beim Dach alle vier Ränder.
- **Wände werden an den Ecken abgeschnitten.** Eine Wand ist selten ein Vielfaches des Abschnitts breit. Fenster deshalb mittig setzen und links und rechts etwas glatte Wand lassen; dann sieht jeder Schnitt ordentlich aus.
- **Jeder Abschnitt wiederholt sich.** Eine Tür im Erdgeschossbild erscheint in jedem Abschnitt. Wer weniger Türen will, zeichnet im Erdgeschoss ein Fenster; Türen an einzelnen Stellen kommen später als eigenes Stück.
- **Dachfläche entlang des Hangs gemessen.** 16 px sind ein Meter Dachfläche, nicht Grundriss.

## Vorlagen und Prüfen

- Die Vorlagen liegen in `public/worldlab/vorlagen/<art>/` – mit Meterraster, Sockel, Platzhaltern für Fenster und Tür. Erzeugt von `scripts/worldlab-templates.py`.
- Solange für ein Bild keine eigene Zeichnung eingetragen ist, legt `/world-lab` die Vorlage auf die Blöcke. `?art=vorlage` zeigt nur Vorlagen, `?art=farbe` einfarbige Quader (zum Vergleichen der Bildrate).

## Eine Zeichnung einbauen

1. Vorlage kopieren, übermalen, unter `public/worldlab/blocks/<art>/<datei>` ablegen (gleicher Dateiname, gleiche Maße).
2. In `lib/worldlab/blocks.ts` bei `DRAWN` eintragen, z. B. `house: { wallGround: true, wallUpper: true, roof: true }`.
3. Was nicht eingetragen ist, zeigt weiter die Vorlage. Nicht alles muss auf einmal gezeichnet werden.

## Stand der Zeichnungen

Seit 13.10.2026 sind alle Blockarten gezeichnet (die Fabrik seit dem Abend) (je Erdgeschoss, Obergeschoss, Dach) und in `DRAWN` eingetragen. Die Bilder sind errechnet: `python3 scripts/worldlab-blocks.py` erzeugt sie neu nach `public/worldlab/blocks/`. Wer ein Stück von Hand nachzeichnet, übermalt die Datei – ein erneuter Lauf des Skripts überschreibt sie.

| Blockart | Wand | Dach |
|---|---|---|
| `house` | Putz, Sprossenfenster mit grünen Läden, Sockel | rote Tonziegel |
| `row` | Putz, hohe Fenster mit Fasche, Sockel | dunklere Tonziegel |
| `hall` | Trapezblech, unten Sektionaltor, oben Lichtband | Trapezblech |
| `factory` | Wellblech, unten Rolltor mit Anfahrschutz, oben durchgehendes Fensterband | Sheddach von oben: Oberlichter alle 4 m, Flachdach |
| `church` | Quadermauerwerk, Spitzbogenfenster | Schiefer |
| `shed` | senkrechte Bretter, kleines Fenster | Dachpappe in Bahnen |

Im Erdgeschoss von `house`, `row`, `church` und `shed` sitzt ein Fenster, keine Tür – Türen kommen als eigenes Stück. Die Halle hat in jedem Abschnitt (6 m) ein Tor.

## Einzelbilder für besondere Gebäude (später)

Kirche, Bahnhof, das Café oder NOXIA-Gebäude können als ganzes Bild gezeichnet werden, schon schräg. Dafür gilt dieselbe Ansicht bei 16 px je Meter:

- Ein Meter nach Osten: 16 px nach rechts, 8 px nach unten.
- Ein Meter nach Süden: 16 px nach links, 8 px nach unten.
- Ein Meter nach oben: 19,6 px nach oben (16 × √1,5).
- **Fußpunkt** ist die Mitte des Grundrisses am Boden; er wird im Bild markiert und mit dem Bild abgelegt.

Einzelbilder sind noch nicht eingebaut; sie stehen als offene Aufgabe in `world-map.md`.

## Wo es im Code steht

- Ansicht und Abbildung der Bilder auf Wände und Dächer: `lib/worldlab/facade.ts` (mit Tests)
- Geschosshöhen, Abschnittsbreiten, Liste der fertigen Zeichnungen: `lib/worldlab/blocks.ts`
- Zeichnen: `drawBlock` in `app/world-lab/worldEngine.ts`

## Fabriken und große Hallen

- Industriebauten (`building=industrial|factory|manufacture`) sind in der Weltkarte eine eigene Blockart `factory`; die begehbare Erdszene zeigt sie weiter als `hall` (`blockKind` unverändert, die Weltkarte nutzt `worldBlockKind`).
- Fabriken haben ein Flachdach; das Dachbild zeigt das Sheddach von oben, oben im Bild liegt die Oberlicht-Reihe, es wiederholt sich quer zur Längsachse.
- Hallen und Fabriken mit verwinkeltem Grundriss (Fläche unter 90 % ihres Rechtecks) werden mit ihrem echten Grundriss gezeichnet, nicht als Rechteck – z. B. das Metallwerk Sundern.
