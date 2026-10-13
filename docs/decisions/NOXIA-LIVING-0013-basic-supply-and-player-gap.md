# NOXIA-LIVING-0013 – Grundversorgung am Hafen, Lücke für Spieler

Status: accepted (Richtung), Werte proposed
Date: 2026-10-13
Bezug: `docs/workstreams/population-economy.md` Aufgaben 10 und 11, Request R-3 (Gastronomie), NOXIA-LIVING-0012, `docs/gameplay/settlement-tiers.md`

## Kontext

Live am 13.10.2026: 15 von 17 hungrigen Bewohnern leben an Orten ohne jedes Essensangebot (Mars / Tharsis Hub, Phobos, Prometheus Station, Mond / Shackleton). Sie haben Geld, können aber nichts kaufen. Alle vier Orte haben einen Landeplatz bzw. ein Andockmodul und ein öffentliches Konto (`location_public_actors`).

## Entscheidung (Thomas, 13.10.2026)

1. **Wo es nichts gibt, gibt es eine schlichte Grundversorgung am Hafen** – eine Stationskantine oder etwas am Landeplatz, wie am Bahnhof oder Flughafen. Niemand hungert, weil ein Ort noch kein Lokal hat.
2. **Das eigentliche Lokal bleibt eine Gelegenheit für Spieler.** Essen und Trinken irgendwo zu etablieren, ist eine Spieleraufgabe. Ist schon alles attraktiv und fertig, hat ein Spieler weniger Möglichkeiten.

Daraus folgt: Die Grundversorgung muss **ausreichen, aber nicht genügen** – sie stillt Hunger und Durst, bietet aber nichts darüber hinaus.

## Ausgestaltung (Vorschlag)

### Gebäudeart `port_canteen` (Hafenkantine)

- Staatlich (`owner_class = 'STATE'`), kassiert über `location_public_actors`. Nicht von Spielern baubar.
- Steht an Orten mit Landeplatz oder Andockmodul (`landing_pad`, `landing_pad_*`, `docking_bay`). Erst per Migration an den vier Orten ohne Angebot; später Teil der Ortsstufen-Automatik.
- Kein begehbarer Innenraum mit Sitzplätzen, kein Personal mit Gesprächen – Ausgabe und Automat. Optional später: Tresen ohne Gespräch.
- **Rund um die Uhr offen** (Hafenbetrieb). Das beantwortet nebenbei einen Teil von R-4: Nachts gibt es Grundversorgung, auch wenn das Lokal zu hat.

### Karte: nur das Nötige

| Posten | hunger | thirst | Preis |
|---|---|---|---|
| water (Wasser) | – | +0,30 | 2 |
| ration (Ration) | +0,25 | +0,05 | 6 |

- Kein Kuchen, kein Longdrink, keine Wahl.
- Preis nicht unter dem Café: Die Kantine ist nicht billiger als ein gutes Lokal, nur verfügbar.
- Keine Wirkung auf Stimmung, Geselligkeit oder `variety`. Wer nur in der Kantine isst, verliert mit der Zeit an `variety` – das ist der spürbare Unterschied, ohne Strafe.

### Wahl der Bewohner nach Reiz, nicht nur nach Preis (Aufgabe 11)

Heute nimmt `run_npc_consumption` immer das billigste Angebot. Das würde jedes Spielerlokal gegen die Kantine verlieren lassen oder umgekehrt. Neu: Jedes Angebot hat einen Reiz aus Preis, Wirkung auf das drängende Bedürfnis, Geselligkeit/`variety` und Öffnungszeit (R-4). Bei gleichem Reiz streut die Wahl deterministisch nach Person und Tick. Die Kantine ist immer die Rückfallebene, nie die erste Wahl, sobald ein offenes Lokal am Ort ist.

So entsteht für Spieler ein Markt: An einem Ort mit nur der Kantine wandert die Nachfrage sofort zum ersten Lokal.

### Die Lücke erkennbar machen – ohne sie anzusagen

Grundsatz: NPC-Markteinfluss soll für aufmerksame Spieler entdeckbar sein, nicht ausgewiesen. Daher keine Anzeige „hier fehlt ein Café", sondern:

- Bewohner beklagen sich im Gespräch über die Kantine („Immer nur Ration").
- Mit R-8 (Wissen der Personen): Reisende erzählen in anderen Lokalen, dass es auf Phobos nur die Hafenkantine gibt.
- Die Verwaltung kennt die Umsätze der Kantine; wer fragt, erfährt, wie viel dort gegessen wird.

## Reihenfolge

1. Migration: Gebäudeart `port_canteen` (nicht baubar), Karte, je eine Kantine an den vier Orten. Bis LIVING-0012 Schritt 3 trägt sie zusätzlich einen `npc_service_catalog`-Eintrag (`sustenance`, Gewinn wie eine Mahlzeit), damit die Bewohner sofort essen können.
2. Aufgabe 11: Wahl nach Reiz statt Preis in `run_npc_consumption`.
3. Danach erst R-1 (Bar und Restaurant baubar) live.

## Offene Fragen

1. Kantine auch an Orten mit Lokal (z. B. Sauerland) als Nacht- und Rückfallversorgung, oder nur dort, wo es nichts gibt?
2. Soll eine Kantine verschwinden oder schrumpfen, wenn ein Spielerlokal am Ort gut läuft – oder bleibt sie als Grundversorgung immer?
