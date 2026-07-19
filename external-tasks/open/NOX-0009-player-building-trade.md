# NOX-0009 — Spieler-zu-Spieler Gebäudekauf / Kaufangebot

**Erstellt:** 19.07.2026
**Status:** open
**Abhängigkeit:** Multiplayer-Voraussetzungen (world-Route, Cargo-Atomicity)

## Problem

Wenn Spieler A auf ein Gebäude von Spieler B klickt, sieht er nur
„👤 Username — nicht bebaubar". Es gibt keine Möglichkeit ein Kaufangebot
zu machen oder das Gebäude zu erwerben.

## Gewünschtes Verhalten

**Option A — Direktkauf (einfach):**
Eigentümer setzt einen Verkaufspreis. Andere Spieler können zum Festpreis kaufen.

**Option B — Kaufangebot (komplex):**
Spieler macht ein Angebot. Eigentümer erhält eine Benachrichtigung und kann
annehmen/ablehnen/Gegenangebot machen.

**Empfehlung:** Option A zuerst — einfacher zu implementieren, kein
Echtzeit-Benachrichtigungssystem nötig.

## UI-Vorschlag

Sidebar bei fremdem Gebäude:
```
👤 thomas — Eisbohrung
Kaufpreis: 8.000 Cr  [Kaufen]
oder: [Angebot machen]
```

## Technische Voraussetzungen

1. `tile_entities.asking_price` — nullable integer, Verkaufspreis den
   der Eigentümer setzt (NULL = nicht zum Verkauf)
2. `trade_offers` Tabelle — Kaufangebote zwischen Spielern
3. `build/route.ts` — `action=make_offer`, `action=accept_offer`
4. Benachrichtigungs-System (Ably oder polling)

## Abhängigkeiten

- Multiplayer: world-Route liefert fremde tile_entities ✅ (teilweise)
- Ably Realtime für Benachrichtigungen (noch nicht implementiert)
- Mindestens Alpha 0.2 (Multiplayer-Grundlagen)

## Priorität

Medium — sinnvoll aber nicht dringend. Erst nach Multiplayer-Grundlagen.
