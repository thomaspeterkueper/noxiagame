# NOXIA-LEARN-0001 · Figuren lernen von Spielern

**Stand:** 2026-11-05
**Entscheidung (Thomas):** NPCs sollen lernen, am besten in der Interaktion mit echten Spielern, die möglichst unzensiert sind. NPCs sollen nicht pauschal nach 14 Tagen vergessen.

## Grundsatz: unzensierte Eingabe, keine ungeprüfte Übernahme

- **Spieler dürfen alles sagen.** Gefiltert wird nur Realwelt-Kriminalität ([NOXIA-SAFETY-0001](NOXIA-SAFETY-0001-schutzfilter-realwelt.md)). Grenztests beantworten die Figuren wie bisher selbst (Wiederholung, Abbruch).
- **Was eine Figur übernimmt** (`lib/game/knowledge/playerClaims.ts`): Aussagen über die Welt – Neuigkeiten, Orte, Arbeit, Reisen. Nicht: Fragen, Persönliches über Sprecher oder Gegenüber (ich/du/wir), Kontaktdaten, alles mit Schutzfilter-Merkmal. Gekürzt auf 200 Zeichen, gespeichert in `npc_learned_claims`.
- **Was eine Figur weitererzählt:** nur Aussagen anderer Spieler, gebündelt nach Inhalt (gemeinsame Schlüsselwörter), gewichtet nach **unabhängigen Quellen**. Ab zwei Spielern: „Mehrere Leute haben dir erzählt“. Bei einem: „unbestätigt, du bist dir nicht sicher“. Ein Spieler zählt nur einmal, egal wie oft er etwas wiederholt – ein einzelner Troll bringt den Figuren nichts als Tatsache bei. Die Quelle wird nie genannt.

## Vergessen: gestuft, nicht pauschal

| Was | Wie lange |
|---|---|
| Persönliches Gedächtnis je Spieler (`npc_player_conversation_memory`) | verblasst nach Nähe: frisch 3–9 Tage, verblasst bis 21–63, schwach bis 90–270 Tage |
| Gehörtes, nur von einer Quelle | 30 Tage |
| Gehörtes, von mehreren bestätigt | 180 Tage |
| Wortlaut im Diagnoseprotokoll | 14 Tage (betrifft nicht das Gedächtnis der Figuren) |

Alles Gelernte verschwindet mit dem Konto der Quelle (Fremdschlüssel mit Kaskade).

## Ersetzt

Den nie aktiven Testimony-Pfad (`NOXIA_TESTIMONY_CAPTURE_ENABLED`, Tabelle `person_epistemic_traces` existierte in der Datenbank nicht). Der Kausalschritt heißt weiter `testimony_write`.

## Nächste Schritte

- Figuren tauschen Gehörtes untereinander aus (über das vorhandene Testimony-Modell `deliverNpcTestimony`), damit sich Gerüchte in der Welt ausbreiten.
- Bestätigung auch über Widerspruch: Erzählen mehrere das Gegenteil, sinkt das Gewicht.
