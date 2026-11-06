# noχ¹ᐃ Erde – Krokusweg 10, Friedrichsdorf / DER DUFT DER BLEIBT

Status: Innenraum gebaut (06.11.2026, `lib/game/landmarks/rowhouse.ts`); Bewohner offen (R-37)
Stand: 2026-11-06
Entscheidung: Thomas, 06.11.2026 – „genau dieses Haus in noxiagame integrieren, als Schauplatz“
Verantwortung: Erdkarte (Ort, Grundriss, Betreten), Gastronomie (Innenraum-Motor, Einrichtung), Bevölkerung und Ökonomie (Bewohner, Wohnen)

## Ort und Identität

- Vorgeschlagene Landmark-ID: `earth-de-friedrichsdorf-krokusweg-10`
- Adresse: Krokusweg 10, 61381 Friedrichsdorf (Hochtaunuskreis, Hessen)
- Werkbezug: Roman **„Der Duft der bleibt“** (Thomas Peter Küper) – das Haus ist die WG, in die Priya kommt, nachdem sie zuerst bei ihrer Schwester gewohnt hat.
- Relation im Register: `setting`
- Stand 06.11.2026: In `region_features` gibt es für den Krokusweg noch keinen Grundriss, Friedrichsdorf ist noch nicht geladen.
- Koordinaten nicht von Hand festschreiben, sie kommen aus dem OSM-Grundriss (Muster der übrigen Landmarks).

## Das Haus (Angaben Thomas)

- Mittelhaus in einem Reihenhaus-Ensemble.
- **Versatz:** Von vorn gesehen schließt das Haus links bündig an das Nachbarhaus an. Zum rechten Nachbarn steht es etwa 1 m vor. Die Rückseite ist genauso versetzt.
- **Terrassen hinten:** eine im 1. OG und eine im Dachgeschoss. Dazu kommt die Gartenterrasse im EG.
- **Bäder:** im 1. OG und im DG je ein innenliegendes Bad (ohne Fenster) mit Dusche und Badewanne.
- **Vorn:** 1. OG und DG kragen etwa 1,20 m über die Küche vor und stehen vorn auf zwei Betonpfeilern. Darunter liegt vor der Küche eine Terrasse, daneben der Hauseingang.
- **Keller:** schließt hinten mit dem Wohnraum ab. Vorn reicht die Tiefgarage der Reihe über die Küche hinaus; vom Keller-Flur führt eine Tür direkt hinein.
- **Hinten:** Das Haus treppt sich ab – EG bis zur Gartenterrasse, darauf der Balkon von Kind 1, darüber die Dachterrasse, die bündig mit der Rückwand von Kind 1 abschließt.

### Grundriss (Bauvorhaben 1979, Flächen aus den Plänen)

| Ebene | Raum | m² | Lage |
|---|---|---|---|
| Keller | Tiefgarage-Stellplatz, Flur, Vorraum, Heizung, Hausanschluss, Keller (≈ 14) | – | Tiefgarage vorn, Keller hinten |
| EG | Flur 7,94 · WC 2,90 · Küche 10,84 · Wohnraum mit Essplatz 30,83 | | Küche vorn, Wohnraum hinten |
| 1. OG | Elternzimmer 18,27 · Flur 4,80 · Bad 1 6,23 · Kind 1 11,31 · Kind 2 12,06 · Balkon | | Eltern vorn, Kind 1/2 hinten |
| DG | Hobbyraum 20,65 · Flur 5,60 · Bad 2 3,89 · Mehrzweckraum 5,90 · Abstellraum 8,23 · Dachterrasse | | Hobbyraum vorn, übrige hinten |

Die ganze Reihe Krokusweg 2–14 hat diesen Grundriss. Im Spiel: Nr. 10 als WG eingerichtet, die übrigen als Familienhäuser.

### Umgebung (aus dem Luftbild, 06.11.2026)

- Blumenviertel: Krokusweg, Rosenweg, Narzissenweg, Anemonenweg.
- Autofreie Wohnwege, die Autos stehen gesammelt an der Straße.
- Vor dem Haus liegt auf der Seite des Wohnwegs ein Spielplatz mit Sandkasten.
- Ausrichtung (unter Vorbehalt, Schrägansicht): Die Reihe läuft etwa Süd-Südwest – Nord-Nordost. Die Vorderseite mit Spielplatz liegt nach Ost-Südost (Morgensonne), die Gartenseite mit den Terrassen nach West-Nordwest (Abendsonne).

## Belegung

| Ebene | Zimmer / Raum | Bewohner (Romanfigur) |
|---|---|---|
| Dachgeschoss | Hobbyraum, Abstellraum, Mehrzweckraum (mit Dachterrasse), innenliegendes Bad | Chinesin (2), Russin, Tunesier – Zuordnung offen |
| 1. OG | Kind 2, Gartenseite ohne Terrasse | **Priya** (Inderin) |
| 1. OG | Kind 1, Gartenseite mit Balkon | Chinesin (1) |
| 1. OG | Elternzimmer, Spielplatzseite | Deutscher |
| 1. OG | innenliegendes Bad | gemeinsam für die drei |
| EG | große Küche, Wohn- und Esszimmer, Gartenterrasse, Garten | alle |
| Keller | – | ab und zu ein Freund des Deutschen (Russe), nicht offiziell |

Die Dachterrasse gehört zum Mehrzweckraum; wer von den dreien dort wohnt, ist noch offen.

## Grundsätze

- **Romanfiguren, keine realen Bewohner.** Die NPCs sind die Figuren aus „Der Duft der bleibt“. Es gibt keine Daten über tatsächliche Mieter des Hauses, weder Namen noch Herkunft noch Biografie.
- **Namen und Biografien aus dem Manuskript.** Bisher ist nur Priya benannt. Die übrigen Namen werden aus der freigegebenen Werkfassung übernommen (eine Quelle: `buecherwelten`) und nicht im Spiel neu erfunden.
- **Sprache:** Nach NOXIA-LIVING-0014 kommen die Sprachen aus der Herkunft der Person. Priya ist die Einzige im Haus ohne jemanden, der ihre Sprache spricht. Das soll nicht erklärt werden, es soll sich aus der Belegung ergeben.
- **Gestelltes Wohnen** wie bei Samira Haddad (Ziegelhüttenweg 15): Wohnzuweisung an den OSM-Grundriss, Mietverhältnis `provided`, Vermieter vorerst unbekannt. Später wird `buy_earth_building` die Bewohner beim Kauf übernehmen.
- Der Kellergast hat **kein** Wohnverhältnis. Er ist zeitweise anwesend (Besuch beim Deutschen).

## Was der Ort im Spiel tragen soll

- **Gerüche und Geräusche als Daten:** Kochgerüche aus der Küche im EG, Parfüm im fensterlosen Bad (bleibt länger als die Person), Rauch von den Terrassen und aus dem Keller, Kinderstimmen vom Spielplatz am Nachmittag, Schritte von der Dachterrasse über Priyas Zimmer. Als Ortsfakten für die Figuren (NOXIA-INTERIOR-0001 „Wissen“) und, sobald es sie gibt, als Raumklang.
- **Sichtbereiche:** Von Priyas Fenster sieht man seitlich auf die Terrasse im 1. OG, von der Dachterrasse sieht man auf die Terrasse darunter, aber nicht umgekehrt. Der Deutsche sieht von der Spielplatzseite, wer kommt und geht.
- **Bad als Engpass:** drei Personen je Etage, ein Bad. Die morgendliche Reihenfolge ist Tagesrhythmus (NOXIA-LIVING-0007) und Reibung (0009).
- **Küche als Bühne:** gemeinsame Kühlschrankfächer, Kochzeiten, Begegnungen. Hier treffen sich die Bewohner, und hier können Spieler sie antreffen.
- **Zugang für Spieler:** Das Haus ist ein privates Wohnhaus. Betreten nur auf Einladung einer Bewohnerin oder eines Bewohners, sonst klingeln an der Haustür (Gespräch an der Tür).

## Nicht festlegen

- Keine erfundenen Kapitel- oder Szenenstellen im Register (`references` leer lassen, bis das Manuskript sie liefert).
- Keine Plotauflösung des Romans über Figurengespräche.
- Keine Bauzeit, keine Preise, kein Eigentümer, bis Thomas entscheidet.

## Im Spiel (06.11.2026)

Auf Wunsch von Thomas („jetzt müssen wir das Gebäude bzw. die ganze Gebäudeserie ins Spiel integrieren“) im Schauplatz-Chat gebaut, ausnahmsweise über die Teilprojektgrenzen:

- **Raumart** `rowhouse` (Familienhaus) und `rowhouse_wg` (Nr. 10) mit vier Geschossen: 0 EG, 1 erstes OG, 2 DG, 3 Keller (`lib/game/landmarks/rowhouse.ts`, Tests in `rowhouse.test.ts`). Wände mit Türen, Möbel, Bereiche mit Texten, Treppen zwischen allen Geschossen. Neue Möbelarten: Bett, Schrank, Wanne, Dusche, Waschbecken, WC, Herd, Kühlschrank, Pfeiler, Geländer, Heizkessel, Waschmaschine.
- **Erkennung auf der Weltkarte:** Anschrift „Krokusweg 2…14“ und Lage im Umkreis von 350 m um Nr. 10 (`rowhouseVariantFor`, eingehängt in `WorldPanels.tsx`). Sobald Friedrichsdorf auf der Karte geladen ist (lädt beim Hingehen nach), zeigen die Häuser „Betreten“.
- **Register:** `earth-de-friedrichsdorf-krokusweg-10` in `earthLandmarks.ts`, Relation `setting`.
- **Noch nicht:** Bewohner (R-37), Einladen und Klingeln – vorerst ist jedes Haus der Reihe offen begehbar.

## Requests

- **W-21** an Erdkarte – `docs/workstreams/world-map.md` (Register und Betreten erledigt; offen: prüfen, dass die Reihe als Einzelhäuser mit Versatz erscheint)
- **G-9** an Gastronomie – erledigt im Schauplatz-Chat, siehe „Im Spiel“
- **R-37** an Bevölkerung und Ökonomie – `docs/workstreams/population-economy.md`

## Offen für Thomas

1. Wer im DG wohnt im Mehrzweckraum mit der Dachterrasse, wer im Hobbyraum, wer im Abstellraum?
2. Namen der übrigen Figuren (oder Pfad im Manuskript)?
3. Gibt es im Roman einen Vermieter im Haus (früher erwähnt: Klaus, 58, der das Haus betreibt) und soll er im Spiel auftreten?
4. Bleibt die echte Hausnummer im Spiel, oder soll – wie im Buch erwogen – eine leicht veränderte Adresse gelten?
