# noχ¹ᐃ Erde – Krokusweg 10, Friedrichsdorf / DER DUFT DER BLEIBT

Status: Ortskonzept und Grundlage für Requests (noch nicht gebaut)
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

### Umgebung (aus dem Luftbild, 06.11.2026)

- Blumenviertel: Krokusweg, Rosenweg, Narzissenweg, Anemonenweg.
- Autofreie Wohnwege, die Autos stehen gesammelt an der Straße.
- Vor dem Haus liegt auf der Seite des Wohnwegs ein Spielplatz mit Sandkasten.
- Ausrichtung (unter Vorbehalt, Schrägansicht): Die Reihe läuft etwa Süd-Südwest – Nord-Nordost. Die Vorderseite mit Spielplatz liegt nach Ost-Südost (Morgensonne), die Gartenseite mit den Terrassen nach West-Nordwest (Abendsonne).

## Belegung

| Ebene | Zimmer / Raum | Bewohner (Romanfigur) |
|---|---|---|
| Dachgeschoss | 3 Zimmer, innenliegendes Bad, Dachterrasse hinten | Chinesin (2), Russin, Tunesier |
| 1. OG | Gartenseite ohne Terrasse | **Priya** (Inderin) |
| 1. OG | Gartenseite mit Terrasse | Chinesin (1) |
| 1. OG | Spielplatzseite | Deutscher |
| 1. OG | innenliegendes Bad | gemeinsam für die drei |
| EG | große Küche, Wohn- und Esszimmer, Gartenterrasse, Garten | alle |
| Keller | – | ab und zu ein Freund des Deutschen (Russe), nicht offiziell |

Wer im DG die Dachterrasse hat, ist noch offen.

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

## Requests

- **W-21** an Erdkarte – `docs/workstreams/world-map.md`
- **G-9** an Gastronomie (Innenraum-Motor) – `docs/workstreams/hospitality.md`
- **R-37** an Bevölkerung und Ökonomie – `docs/workstreams/population-economy.md`

## Offen für Thomas

1. Wer im DG hat die Dachterrasse?
2. Namen der übrigen Figuren (oder Pfad im Manuskript)?
3. Gibt es im Roman einen Vermieter im Haus (früher erwähnt: Klaus, 58, der das Haus betreibt) und soll er im Spiel auftreten?
4. Bleibt die echte Hausnummer im Spiel, oder soll – wie im Buch erwogen – eine leicht veränderte Adresse gelten?
