# NOXIA-LIVING-0013 – Grundversorgung am Hafen, Lücke für Spieler

Status: accepted, live seit 13.10.2026 (Migration `20261013100000_port_canteen.sql`)
Date: 2026-10-13
Bezug: `docs/workstreams/population-economy.md` Aufgaben 10 und 11, Request R-3 (Gastronomie), NOXIA-LIVING-0012, `docs/gameplay/settlement-tiers.md`

## Kontext

Live am 13.10.2026: 15 von 17 hungrigen Bewohnern leben an Orten ohne jedes Essensangebot (Mars / Tharsis Hub, Phobos, Prometheus Station, Mond / Shackleton). Sie haben Geld, können aber nichts kaufen. Alle vier Orte haben einen Landeplatz bzw. ein Andockmodul und ein öffentliches Konto (`location_public_actors`).

## Entscheidung (Thomas, 13.10.2026)

1. **Wo es nichts gibt, gibt es eine schlichte Grundversorgung am Hafen** – eine Stationskantine oder etwas am Landeplatz, wie am Bahnhof oder Flughafen. Niemand hungert, weil ein Ort noch kein Lokal hat.
2. **Das eigentliche Lokal bleibt eine Gelegenheit für Spieler.** Essen und Trinken irgendwo zu etablieren, ist eine Spieleraufgabe. Ist schon alles attraktiv und fertig, hat ein Spieler weniger Möglichkeiten.
3. **Die Kantine gibt es überall und dauerhaft** – auch dort, wo schon ein Lokal ist. Sie ist der Notfallplan für arme Bewohner und Spieler und verschwindet nicht, wenn ein Spielerlokal gut läuft.

Daraus folgt: Die Grundversorgung muss **ausreichen, aber nicht genügen** – sie stillt Hunger und Durst, bietet aber nichts darüber hinaus.

## Ausgestaltung (Vorschlag)

### Gebäudeart `port_canteen` (Hafenkantine)

- Staatlich (`owner_class = 'STATE'`), kassiert über `location_public_actors`. Nicht von Spielern baubar.
- Sitzt **im** staatlichen Hafengebäude (`parent_id` + `slot`, wie das Café im Q1-Transferknoten) und belegt keine Kachel. Hafen ist je Ort das erste von `spaceport_core`, `q1_harbour_district`, `docking_bay`, `landing_pad*`.
- Live an allen sechs Orten mit Hafen: Mars / Tharsis Hub, Phobos, Prometheus Station, Mond / Shackleton, Tharsis Hub Sauerland, Q1. Deimos hat keinen Hafen und keine Bewohner. Neue Orte bekommen sie später mit der Ortsstufen-Automatik (Stufe 0, zusammen mit dem Landeplatz).
- Kein begehbarer Innenraum mit Sitzplätzen, kein Personal mit Gesprächen – Ausgabe und Automat. Optional später: Tresen ohne Gespräch.
- **Rund um die Uhr offen** (Hafenbetrieb). Das beantwortet nebenbei einen Teil von R-4: Nachts gibt es Grundversorgung, auch wenn das Lokal zu hat.

### Karte: nur das Nötige

| Posten | hunger | thirst | Preis |
|---|---|---|---|
| water (Wasser) | – | +0,30 | 2 |
| ration (Ration) | +0,25 | +0,05 | 6 |

- Kein Kuchen, kein Longdrink, keine Wahl.
- Der Preis entscheidet nicht über die Wahl: Bewohner gehen zuerst ins Lokal, die Kantine ist Rückfallebene. Sie darf deshalb günstig sein.
- Bewohner: Dienst `canteen_ration` (`sustenance` +0,20, 6 Credits). Das Café bringt +0,22.

### Notration – ohne Geld

Wer am Ort kein Angebot bezahlen kann, bekommt in der Kantine eine **Notration**: `sustenance` +0,12, höchstens alle 6 Ticks, Preis 0. Es fließt kein Geld – keine Emission, kein Transfer, nichts zu buchen. Das ist ehrlich, solange Lebensmittel keine Ware mit Bestand sind; sie entstehen heute in jedem Lokal ohne Einkauf. Sobald sie eine Ware sind, trägt die Koloniekasse die Notration als Fiskaltransfer (Koloniekasse → Kantine). Heute stehen alle Koloniekassen bei 0, weil die Steuersätze 0 sind.

Die Notration greift nur bei echter Mittellosigkeit, nicht wenn jemand gerade erst gegessen hat und in der Wartezeit ist. Für Spieler folgt sie mit den Spielerbedürfnissen (LIVING-0012 Schritt 3): Wer weniger Credits hat als der billigste Posten, kann die Notration am Tresen nehmen.
- Keine Wirkung auf Stimmung, Geselligkeit oder `variety`. Wer nur in der Kantine isst, verliert mit der Zeit an `variety` – das ist der spürbare Unterschied, ohne Strafe.

### Wahl der Bewohner nach Reiz, nicht nur nach Preis (Aufgabe 11)

Erster Schritt live: Lokale vor der Kantine, erstes **bezahlbares** Angebot statt des ersten überhaupt, unter gleichwertigen Lokalen gestreut je Person und Tick (vorher bekam bei Gleichstand immer dasselbe Gebäude alle Käufe). Offen bleibt der volle Reiz unten.

Vorher nahm `run_npc_consumption` immer das billigste Angebot. Das würde jedes Spielerlokal gegen die Kantine verlieren lassen oder umgekehrt. Neu: Jedes Angebot hat einen Reiz aus Preis, Wirkung auf das drängende Bedürfnis, Geselligkeit/`variety` und Öffnungszeit (R-4). Bei gleichem Reiz streut die Wahl deterministisch nach Person und Tick. Die Kantine ist immer die Rückfallebene, nie die erste Wahl, sobald ein offenes Lokal am Ort ist.

So entsteht für Spieler ein Markt: An einem Ort mit nur der Kantine wandert die Nachfrage sofort zum ersten Lokal.

### Die Lücke erkennbar machen – ohne sie anzusagen

Grundsatz: NPC-Markteinfluss soll für aufmerksame Spieler entdeckbar sein, nicht ausgewiesen. Daher keine Anzeige „hier fehlt ein Café", sondern:

- Bewohner beklagen sich im Gespräch über die Kantine („Immer nur Ration").
- Mit R-8 (Wissen der Personen): Reisende erzählen in anderen Lokalen, dass es auf Phobos nur die Hafenkantine gibt.
- Die Verwaltung kennt die Umsätze der Kantine; wer fragt, erfährt, wie viel dort gegessen wird.

## Test (13.10.2026)

In einer zurückgerollten Transaktion gegen die Live-Daten: 6 Kantinen in den Hafengebäuden, 13 Käufe bei 13 hungrigen Bewohnern an Orten ohne Lokal, Summe aller Geldbuchungen 0. Ein künstlich mittelloser Bewohner bekam zweimal im Abstand von 6 Ticks die Notration (Preis 0, +0,12) und blieb bei 0 Credits. Danach eingespielt.

## Reihenfolge

1. ~~Migration: Gebäudeart, Kantinen, Karte, Dienst, Notration, erste Wahlregel.~~ Live seit 13.10.2026.
2. Spieler können die Kantine betreten und bestellen – Request an Gastronomie (Kantine sichtbar machen, Bilder für `water` und `ration`).
3. Aufgabe 11 vollständig: Reiz aus Preis, Wirkung, Geselligkeit, Öffnungszeit (R-4, R-5).
4. Danach R-1 (Bar und Restaurant baubar).

## Offene Fragen

Entschieden am 13.10.2026: Kantine überall, auch neben Lokalen; sie bleibt bestehen.

Entschieden am 13.10.2026 (Thomas): Die Kantine hat kein menschliches Personal. Kleine Kantinen haben nur einen Automaten; größere werden von einem oder mehreren humanoiden Robotern bedient – Robotern, wie sie in etwa 50 Jahren gebaut werden. Diese sind vernetzt, erinnern sich und haben ein Schwarmbewusstsein. Siehe Abschnitt „Bedienung“.

1. Reichweite des Schwarms: ein Schwarm je Kolonie bzw. Station, oder ein gemeinsamer Schwarm über alle Häfen, der über Funk mit Lichtlaufzeit abgleicht (Erde–Mars je nach Stellung etwa 3 bis 22 Minuten)? Vorschlag: ein Netz über alle Häfen, Abgleich mit Verzögerung – dann weiß der Schwarm auf dem Mars erst nach Minuten, was auf der Erde geschah, und Spieler können das merken.
2. Was weiß der Schwarm? Vorschlag unten: nur, was die Roboter selbst wahrgenommen haben.

## Bedienung: Automat oder Roboter

### Automat (kleine Kantinen)

- Wirklich nur ein Automat: Auswahl, Bezahlung, Ausgabe. Keine Stimme, kein Gespräch, kein Gedächtnis. Anzeige von Karte, Preisen und Notration.
- Vorschlag: an kleinen Landeplätzen (Mond / Shackleton, Phobos, später neue Außenposten).

### Humanoide Roboter (größere Kantinen)

- **Keine Bewohner, keine Stelle, kein Lohn.** Die Roboter sind Ausstattung der Kantine, keine Personen in `people`; sie haben keine Stimmung, keine Bedürfnisse und keine Beziehungen im Sinne von NOXIA-LIVING-0008.
- **Plausible Technik:** erkennbar Maschine – Gelenke, Sensorkopf, abwischbare Schalen, Gebrauchsspuren; greifen, reichen aus, sprechen knapp mit synthetischer Stimme. Keine täuschend menschliche Haut, kein Mienenspiel, keine Gefühle.
- **Vernetzt mit Schwarmbewusstsein:** Alle Kantinenroboter teilen ein Gedächtnis. Was einer gesehen hat, wissen alle im Netz; ein Gast, den ein Roboter auf Phobos bedient hat, wird vom Roboter in Prometheus wiedererkannt. Der Schwarm spricht von sich gern im Plural („Wir haben Sie zuletzt auf Phobos gesehen.“). Mehrere Roboter in einer Kantine sind Körper desselben Schwarms, nicht verschiedene Figuren.
- **Gedächtnis:** Der Schwarm erinnert sich an Gäste (wer, wann, wo, was bestellt, ob Notration), an Ankünfte und Abflüge, die man vom Hafen aus sieht, und an das, was in seiner Hörweite in der Kantine gesagt wurde. Grundsatz bleibt: Er weiß nur, was er wahrnehmen konnte – kein Zugriff auf Datenbanken der Verwaltung, keine Gedanken von Personen, nichts aus Lokalen, in denen kein Roboter steht.
- **Gesprächsumfang:** mehr als ein Automat – Karte, Preise, Notration, Weg zum Hafen, dazu was der Schwarm erlebt hat: wer zuletzt angekommen ist, wie viele Notrationen ausgegeben werden, welcher Gast wiederkommt. Sachlich und ohne Klatsch-Ton; Deutungen und Gerüchte bleiben Sache der Menschen im Lokal. So bleibt die Lücke für Spieler: Der Schwarm weiß Tatsachen, das Lokal erzählt Geschichten.
- **Anschluss an R-8 (Wissen der Personen):** Der Schwarm ist ein eigener Wissensträger im selben Modell wie die Wissensspuren der Bewohner (Quelle, Alter, Verlässlichkeit), mit Quelle „Kantinenschwarm“. Ob er Auskunft gegen Geld gibt oder Wissen an Bewohner weitergibt, wird dort entschieden.
- **Technisch:** ein Akteur „Kantinenschwarm“ (kein Bewohner), ein gemeinsames Gedächtnis als Ereignisliste (wer, wo, wann, was), abgeleitet aus vorhandenen Ereignissen wie `person_consumption_events`, Bestellungen und Ankünften – nichts wird doppelt gespeichert.
- Vorschlag: Roboter an größeren Häfen und Stationen (Mars / Tharsis Hub, Prometheus Station, Q1, Tharsis Hub Sauerland). Gastronomie entscheidet beim Innenraum.
- Später möglich: Wartung als Kostenposten der Koloniekasse; Ausfall eines Automaten oder Netzausfall des Schwarms als Ereignis – dann erinnert sich die betroffene Kantine vorübergehend an nichts Neues.
