# NOXIA-LEARN-0001 · Figuren lernen von Spielern

**Stand:** 2026-11-05
**Entscheidung (Thomas):** NPCs sollen lernen, am besten in der Interaktion mit echten Spielern, die möglichst unzensiert sind. NPCs sollen nicht pauschal nach 14 Tagen vergessen.

## Grundsatz: unzensierte Eingabe, keine ungeprüfte Übernahme

- **Spieler dürfen alles sagen.** Gefiltert wird nur Realwelt-Kriminalität ([NOXIA-SAFETY-0001](NOXIA-SAFETY-0001-schutzfilter-realwelt.md)). Grenztests beantworten die Figuren wie bisher selbst (Wiederholung, Abbruch).
- **Was eine Figur übernimmt** (`lib/game/knowledge/playerClaims.ts`): Aussagen über die Welt – Neuigkeiten, Orte, Arbeit, Reisen. Nicht: Fragen, Persönliches über Sprecher oder Gegenüber (ich/du/wir), Kontaktdaten, alles mit Schutzfilter-Merkmal. Gekürzt auf 200 Zeichen, gespeichert in `npc_learned_claims`.
- **Was eine Figur weitererzählt:** nur Aussagen anderer Spieler, gebündelt nach Inhalt (gemeinsame Schlüsselwörter), gewichtet nach **unabhängigen Quellen**. Ab zwei Spielern: „Mehrere Leute haben dir erzählt“. Bei einem: „unbestätigt, du bist dir nicht sicher“. Ein Spieler zählt nur einmal, egal wie oft er etwas wiederholt – ein einzelner Troll bringt den Figuren nichts als Tatsache bei. Die Quelle wird nie genannt.

## Vergessen: gestuft, ab der letzten Erwähnung

Ergänzt am 06.11.2026 (Thomas: „Warum verschwindet etwas, obwohl es wiederholt und wiederholt wird?“).

| Was | Wie lange |
|---|---|
| Persönliches Gedächtnis je Spieler (`npc_player_conversation_memory`) | wird nicht gelöscht; verblasst in der Erinnerung nach Nähe (frisch 3–9 Tage, verblasst bis 21–63, schwach bis 90–270 Tage) |
| Gehörtes, nur von einer Quelle | 30 Tage nach der **letzten** Erwähnung |
| Gehörtes, von mehreren bestätigt | 180 Tage nach der **letzten** Erwähnung |
| Festes Wissen: ≥3 unabhängige Quellen, erzählt über ≥30 Tage | nie automatisch vergessen (`established`) |
| Wortlaut im Diagnoseprotokoll | 14 Tage (betrifft nicht das Gedächtnis der Figuren) |

- Wiederholung frischt auf: `remember_player_claim` setzt `last_heard_at` und zählt `times_heard`, auch wenn dieselbe Person denselben Satz wiederholt. Für die Bestätigung zählen weiterhin nur unabhängige Quellen.
- Der Löschjob entfernt Gelerntes erst 180 Tage nach der letzten Erwähnung und festes Wissen nie. Unbestätigtes, das nach 30 Tagen nicht mehr erzählt wird, bleibt bis dahin gespeichert: Erzählt es später jemand anderes, lebt es als bestätigt wieder auf.

## Biografie bleibt bei Kontolöschung

Entscheidung Thomas (06.11.2026): Erinnerungen an Gespräche mit echten Spielern verschwinden nicht, nur weil der Spieler sich abmeldet – das würde die Biografie der Figuren zerstören.

- `npc_player_conversation_memory.player_profile_id` wird bei Löschung des Profils auf `null` gesetzt, `detached_at` markiert den Zeitpunkt (Trigger `detach_npc_memories_on_profile_delete`). Die Erinnerung bleibt bei der Figur.
- `npc_learned_claims.source_profile_id` wird ebenfalls gelöst; gezählt werden Quellen über `source_key` (sha256 der früheren Spieler-ID), damit Bestätigungen erhalten bleiben.
- Das Diagnoseprotokoll (`npc_conversation_log`) wird weiterhin mitgelöscht – es ist kein Teil der Biografie.
- **Rechtlich zu prüfen:** Die Erinnerungen enthalten gekürzte Aussagen des Spielers (ohne Kontaktdaten). Nach einer Kontolöschung sind sie pseudonym, nicht zwingend anonym. Ob ein ausdrücklicher Löschwunsch nach Art. 17 DSGVO auch diese Erinnerungen umfassen muss, ist vor dem öffentlichen Start zu klären; bis dahin auf Anfrage manuell löschen.

## Ersetzt

Den nie aktiven Testimony-Pfad (`NOXIA_TESTIMONY_CAPTURE_ENABLED`, Tabelle `person_epistemic_traces` existierte in der Datenbank nicht). Der Kausalschritt heißt weiter `testimony_write`.

## Nächste Schritte

- Figuren tauschen Gehörtes untereinander aus (über das vorhandene Testimony-Modell `deliverNpcTestimony`), damit sich Gerüchte in der Welt ausbreiten.
- Bestätigung auch über Widerspruch: Erzählen mehrere das Gegenteil, sinkt das Gewicht.
