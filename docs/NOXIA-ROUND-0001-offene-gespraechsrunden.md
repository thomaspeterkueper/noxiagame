# NOXIA-ROUND-0001 – Offene Gesprächsrunden

Stand: 02.11.2026 · Entschieden: Thomas, 31.10.2026

## Ziel

In einer offenen Gesprächszeit oder Resonanzrunde reden die Anwesenden miteinander. Man sieht und hört das und kann sich einklinken – es ist ein Gruppengespräch, kein Einzelgespräch mit einer Figur.

## Entscheidung

- **Live, solange jemand im Raum ist.** Etwa alle 22 Sekunden sagt eine Figur etwas, für alle im Raum gleich. Kosten fallen nur an, solange ein Spieler die Runde sieht.
- **Alle offenen Runden:** `open_community` (offene Gesprächszeit) und `resonance_round`.

## Umsetzung

- `lib/game/rounds/roundTalk.ts` – Regeln, Aufforderungen an das Sprachmodell, Lesen der Antwort (rein, getestet).
- `app/api/game/round-talk/route.ts` – GET liest Beiträge, POST führt die Runde fort oder nimmt einen Beitrag des Spielers an.
- Tabelle `round_talk_lines` (Migration 20261102010000).
- `app/earth/RoundTalk.tsx` – Anzeige im Innenraum, in der Karte „Jetzt“ des Termins.

## Schutz

- Beiträge der Figuren sind für alle gleich. **Was ein Spieler schreibt und was darauf geantwortet wird, sieht nur er selbst** (`visible_to`). So gelangt kein Text eines Spielers zu anderen Spielern.
- Höchstens 6 Beiträge je Minute und Spieler, 400 Zeichen je Beitrag, 60 Beiträge je Runde, danach wird die Runde ruhig.
- Notlagen („will sterben“ …) gehen nicht ins Modell; es erscheint die Hilfe (TelefonSeelsorge, Nummer gegen Kummer).
- Figuren erfinden nichts (Orte, Termine, Zahlen, Nachrichten); Glaube und Sinn sind persönliche Überzeugungen; bei Trauer wird zugehört und nichts als „hilfreich“ bewertet.
- Beiträge werden nach drei Tagen aufgeräumt.

## Offen

- Sprechblasen über den Figuren (bisher ein Verlauf im Fenster).
- Hören, wenn man nur am Eingang steht, ohne den Termin im Fenster zu öffnen.
