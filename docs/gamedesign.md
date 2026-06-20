# NOXIA – Game Design Document

Stand: 20. Juni 2026
Autor: Thomas Peter Küper
Status: Alpha 0.1.5 in Betrieb

---

## Vision

Noxia ist langfristig eine Wissens-, Zivilisations- und Gesellschaftssimulation
im realen Sonnensystem. Spieler versorgen Kolonien, treiben Handel und hinterlassen
sichtbare Spuren in einer lebendigen Welt.

---

## Die zwei wichtigsten Regeln

### Regel 1: Die 15-Minuten-Regel
Ein neuer Spieler muss innerhalb von 15 Minuten:
- eine Entscheidung treffen
- eine Konsequenz erleben
- einen Erfolg erzielen

### Regel 2: Die Alpha-Regel
Alpha 0.1.x enthält ausschließlich:
Bevölkerung, Ressourcen, Gebäude, Handel, Transport, Nachfrage, Preise, Aufträge, Wissen (Grundlage)

**Nicht enthalten:** Piraterie, Politik, Fraktionen, vollständige KI-Agenten

---

## Erfolgskriterium Alpha 0.1

> „Kann ein Spieler nach einer Woche sagen:
> Diese Kolonie existiert heute nur, weil ich sie versorgt habe."

---

## Kernkreislauf

```
Spieler liefert Ressourcen
↓ Lagerbestand steigt
↓ Bevölkerung wächst (+1%/Tick)
↓ Nachfrage steigt
↓ Lagerbestand sinkt
↓ Preise steigen (+5% wenn stock < 50)
↓ Aufträge generiert (wenn stock < Schwellwert)
↓ Spieler liefert Ressourcen
```

---

## Spielwelt

| Ort | Slug | Charakter |
|-----|------|-----------|
| Mond / Shackleton | `moon` | Industriestation, Werft, Metall-Produzent, Eis-Ressource |
| Mars / Tharsis Hub | `mars` | Größte Siedlung, wächst schnell, Wasser knapp |
| Phobos | `phobos` | Freihafen, reiner Konsument, abhängig von Lieferungen |

---

## Wirtschaftssystem

### Aktuelle Startpreise (Kauf/Verkauf)
| Ort | Wasser | Energie | Metall |
|-----|--------|---------|--------|
| Mond | 130/95 | 65/48 | 35/25 |
| Mars | 200/155 | 90/68 | 75/58 |
| Phobos | 110/82 | 75/56 | 60/44 |

Preisgrenzen: 10 – 500 Cr.

### Strukturelle Produktionsprofile (nach Rebalancing 20.06.)
| Ort | Wasser | Energie | Metall |
|-----|--------|---------|--------|
| Mond | Defizit (5 base, ~8 cons) | Überschuss | **Stark** (12 base) |
| Mars | **Starkes Defizit** (5 base, ~12 cons) | ausgeglichen | ausgeglichen |
| Phobos | kein (1 base) | leichtes Defizit | ausgeglichen |

Lager hält ohne Lieferung: Mond Wasser ~50h, Mars Wasser ~29h, Phobos Wasser ~33h.

### Arbitrage-Beispiel
Wasser: Mond kaufen (95 Cr) → Mars verkaufen (155 Cr) = +60 Cr/t
Metall: Mond kaufen (25 Cr) → Mars verkaufen (58 Cr) = +33 Cr/t
Preisimpulse erschöpfen Arbitrage kausal (0.3%/Tonne).

---

## Tick-System (Lazy Ticks, seit Alpha 0.1.5)

- **Intervall:** 1 Stunde (TICK_INTERVAL_SECONDS = 3600)
- **Herzschlag:** world-Route beim Dashboard-Load rechnet fällige Ticks nach
- **Fallback:** Vercel Cron täglich (tote Phasen)
- **Max Catchup:** 48 Ticks (2 Tage)
- Bauzeiten, Preise, Einkommen: alles stündlich

---

## Bausystem

Spieler klicken auf freie Kacheln im Koloniegrid und bauen Gebäude.
Gebäude kosten Credits und haben eine Bauzeit in Ticks.

Während des Baus: Kachel zeigt Streifenmuster. Laufender Bau kann abgebrochen
werden (50% Rückerstattung). Nach Fertigstellung wirkt das Gebäude ab dem nächsten Tick.

### Staatliche Startgebäude (is_state_owned = true, profile_id = null)
Jede Station hat bei Gründung automatisch:
- **Verwaltung (admin)** — Mitte des Grids (row 3, col 5), blauer Rahmen
- Bei zukünftigen Stationen: immer erstes Gebäude, immer Mitte

Staatliche Gebäude sind erkennbar an **blauem Rahmen** im Grid.
Eigene Gebäude: **goldener Rahmen**. Fremde Spieler: **roter Rahmen**.

---

## Gebäude-Katalog (baubar)

| Gebäude | Kosten | Bauzeit | Effekt | Standort |
|---------|--------|---------|--------|---------|
| Mine | 1.500 Cr | 2 Ticks | +5 Metall/Tick | alle |
| Solarfeld | 1.200 Cr | 1 Tick | +4 Energie/Tick | alle |
| Habitat | 2.000 Cr | 3 Ticks | +100 max. Bevölkerung | alle |
| Scanner | 1.800 Cr | 2 Ticks | Anomalien sichtbar | alle |
| Eisbohrung | 2.500 Cr | 3 Ticks | +4 Wasser/Tick | Mond |
| Wasserrecycler | 2.000 Cr | 2 Ticks | +2 Wasser/Tick | Mars |
| Akademie | 3.000 Cr | 4 Ticks | Wissens-Terminal | alle |

Standortfremde Gebäude erscheinen im Bau-Dialog ausgegraut mit Hinweis.

---

## Wissens-System (Solar Academy Fundament, seit 20.06.)

### Konzept
- **knowledge_points** — globales Spieler-Wissen (auf `profiles`)
- Erworben durch Aufgaben in der Akademie
- Wirkt als Stationsbonus wo der Spieler eine Akademie gebaut hat

### Akademie-Overlay
- Klick auf Akademie → Aufgaben-Overlay
- Aufgaben dynamisch generiert (Claude API, echte Kolonie-Daten)
- Schwierigkeit: max. 8. Schuljahr (Grundrechenarten, Prozent, Proportionen)
- Thematisch: Verbrauch ausrechnen, Handelsmarge, Lagerreichweite
- Richtige Antwort → knowledge_points gutgeschrieben
- Serien-Bonus: ab 2 richtigen in Folge +50%
- Rate-Limit: 10 Aufgaben/Stunde

### Bonus-Formel
```
schoolBonus = hat_akademie_auf_station
  ? MIN(0.005, knowledge_points / 10000 × 0.005)
  : 0
effectiveGrowthRate = GROWTH_RATE + schoolBonus
```
Max-Bonus: +0.5%/Tick (bei 10.000 Punkten, verdoppelt Basiswachstum).

---

## Gebäude-Verkauf (marktwertbasiert)

Der Verkaufswert richtet sich nach dem **Ertragswert** zur aktuellen Marktlage.
Bewertung auf gleitendem 7-Tick-Durchschnitt (nicht manipulierbar).

### Formeln
```
Mine/Solar/Wasser: Ertragswert = Produktion/Tick × avg_sell_7 × 20
Habitat:           Ertragswert = 100 × Kolonie-Auslastung × 1 Cr × 20
Rückbau:           20% der Baukosten
Verkaufswert =     Ertragswert − Rückbau
```

### Zwei Verkaufswege
- **Regulär:** voller Wert, Auszahlung nach 2 Ticks
- **Sofort:** 15% Abschlag, sofortige Auszahlung

### Einkommensströme (seit Alpha 0.1.5)
Tick schüttet an Gebäude-Eigentümer aus:
- Mine/Solar/Eisbohrung/Recycler: Produktionswert × lokaler Verkaufspreis
- Habitat: MIETWERT_PRO_PLATZ × belegte Plätze

---

## Eigentum & Entitäten

`tile_entities` — Weltzustand:
- `profile_id`: Eigentümer (null = staatlich)
- `is_state_owned`: true = staatliches/NPC-Gebäude
- `entity_type`: building | vehicle | specialist | ship
- Max. EIN Gebäude pro Kachel; andere Typen können stapeln

`player_builds` — Auftragsbuch (Historie aller Vorgänge)

---

## Schiffstypen

| Schiff | Kosten | Laderaum | Geschwindigkeit |
|--------|--------|----------|-----------------|
| Frachter Mk.I | Startschiff | 100t | 1.0× |
| Schnellfrachter | 8.000 Cr | 60t | 1.7× |
| Schwerfrachter | 15.000 Cr | 200t | 0.77× |

Reisezeiten: orbital (deterministisch aus Tick-Position).
Reichweiten: Mk.I 55, Schwerfrachter 50, Schnellfrachter 75.

---

## NPC — HeliosCorp (seit 15.06.)

Erster deterministischer Marktteilnehmer:
- Kauft Metall/Energie am Mond, treibt dort Preise
- Lager-Cap 250t — dann Ruhe, Preis erholt sich
- Sichtbar im Statistiken-Tab (Marktteilnehmer-Karte)

---

## Kachelgrid-System

Jede Kolonie hat ein **12×8-Kachelgrid** (44×44px pro Kachel).
- Terrain seed-basiert deterministisch
- Staatliche/NPC-Gebäude: blauer Rahmen
- Eigene Gebäude: goldener Rahmen
- Fremde Spieler: roter Rahmen
- Straßen + NPC-Habitate: staatlich (blau)
- Klick auf Verwaltung → AdminOverlay
- Klick auf Akademie → SchoolOverlay (Aufgaben)

---

## Entwicklungsphasen

| Phase | Fokus | Status |
|-------|-------|--------|
| Alpha 0.1 | Bevölkerung, Wirtschaft, Handel, Transport, Bausystem | ✅ |
| Alpha 0.1 (Rest) | Onboarding, Avatar, Erstauftrag | ✅ |
| Alpha 0.1.5 | Lazy Ticks, Preisimpulse, Gebäude-Einkommen, Rebalancing, Wassergebäude, Akademie | ✅ In Betrieb |
| Alpha 0.2 | Multiplayer (Auth, geteilte Welt, Realtime) | Geplant |
| Alpha 0.3 | Solar Academy (Lernfortschritt, Technologie-Freischaltung) | Fundament gelegt |
| Alpha 0.4 | OverTime Archive | Geplant |
| Alpha 0.5 | Konflikte, Schiedsgericht, Piraterie | Geplant |

### Multiplayer-Voraussetzungen (vor jeder Ably-Zeile)
1. Middleware reaktivieren (Auth-Schutz /dashboard)
2. world-Route liefert tile_entities aller Spieler
3. Doppel-Verkaufs-Schutz serverseitig härten

---

## Backlog

**Bei Multiplayer:**
- Auktionssystem für Gebäude
- Handels-Symmetrie: Spielerkäufe senken Stock (echte Knappheit)

**Solar Academy 0.3:**
- Technologie-Freischaltung durch knowledge_points
- Aufgaben-Bibliothek erweitern (Physik, Astronomie, Wirtschaft)
- NPC-`grund` anzeigen im Statistiken-Tab

**Später:**
- Kolonieschiffe / Bevölkerungstransport
- Präsenz-Prinzip (Informationsasymmetrie)
- Dependancen mit Verwalter (relay_tower + trade_depot)
- 4-Ebenen-UI fürs Grid
- Private Stationen (Spieler baut eigene Station, wird Gouverneur)

**Bewusst verworfen:**
- Zufallsbasierte Spekulationsblasen
- Handels-Reputation als Verkaufsbonus

---

## Weitere Ressourcen

- Technisches Setup: `NOXIA_SETUP.md`
- Gebäude-Katalog: `SPEC_gebaeude_katalog.md`
- Spielkonstanten: `lib/game/config.ts` + `lib/game/buildingSale.ts`
- Buchuniversum: https://thomas-kueper.de/universen/nox
