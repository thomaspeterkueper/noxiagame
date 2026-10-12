# NOXIA-LIVING-0012 – Hunger und Durst, für Bewohner und Spieler

Status: proposed
Date: 2026-10-12
Bezug: `docs/workstreams/population-economy.md` Aufgaben 5 und 9, NOXIA-LIVING-0006 (Affekt), NOXIA-LIVING-0008 (Beziehungen), NOXIA-FIN-0001 (Bestellung im Lokal)
Code (betroffen): `lib/game/population/types.ts`, `tick.ts`, `actionEffects.ts`, `decision.ts`, `lib/game/personBrain.ts`, `app/api/game/hospitality/order/route.ts`, `app/dashboard/DashboardTopbarManager.tsx`

## Kontext

Entschieden (Thomas, 12.10.2026): Durst und Hunger werden eigene Bedürfnisse, für Bewohner und für Spieler.

Heute:

- Bewohner haben `sustenance` (Essen und Trinken zusammen) in `person_needs`, Wert 0–1.
- Spieler haben gar keine Bedürfnisse. Es gibt keine Personenzeile für Spieler.
- `order_hospitality_item` bucht nur Geld. Der Posten wirkt auf niemanden.
- `npc_service_catalog` hat genau ein `need_code` je Dienst (`cafe_meal` → `sustenance`, +0,22).
- Ein Tick ist eine Stunde (`/api/cron/population` stündlich).
- Eine Beziehung zwischen Person und Spieler gibt es nicht. `person_relationships` verbindet nur Personen untereinander.

## Entscheidung (Vorschlag)

### 1. Zwei Bedürfnisse: `hunger` und `thirst`

Wie bei allen Bedürfnissen gilt: 1 = versorgt, 0 = Mangel. Der Name bezeichnet das Bedürfnis, nicht das Gefühl.

Durst sinkt schneller als Hunger. Als Faustregel für Bewohner: Durst sinkt um das 1,5-fache des bisherigen `sustenance`-Verlusts, Hunger um das 1,0-fache. Die Tabellen in `tick.ts` und `actionEffects.ts` werden so umgerechnet, nicht neu erfunden – das hält die Kolonie im bekannten Gleichgewicht.

| Handlung | bisher `sustenance` | neu `hunger` | neu `thirst` |
|---|---|---|---|
| work | −0,04 | −0,04 | −0,06 |
| rest | −0,01 | −0,01 | −0,015 |
| travel | −0,02 | −0,02 | −0,03 |
| social_interaction | −0,01 | −0,01 | −0,015 |
| satisfy_basic_need | +0,22 | +0,22 | +0,22 |

`satisfy_basic_need` bleibt vorerst eine Mahlzeit mit Getränk und stillt beides. Getrennte Handlungen (essen, trinken) erst, wenn die Karte im Lokal die Bewohnerversorgung trägt (Abschnitt 4).

Später möglich, nicht Teil dieses Schritts: Der Durstausgleich hängt am Wasserbestand der Kolonie (`environment.supply` in `actionEffects.ts` ist schon da). Dann wird Wasserknappheit auf dem Mars als Durst der Bewohner spürbar – kausal, nicht erzählt.

### 2. Übergang der Bestandswerte (Bewohner)

Drei Schritte, jeder einzeln deploybar, wie bei `variety` (NOXIA-LIVING-0009):

1. **Migration A:** `need_code`-Check um `hunger` und `thirst` erweitern. Für jede Person beide Zeilen mit dem aktuellen `sustenance`-Wert anlegen (`on conflict do nothing`). Niemand wird durch die Umstellung plötzlich hungrig oder satt.
2. **Code B:** Engine liest und schreibt `hunger` und `thirst`. Fehlen die Zeilen, gilt der `sustenance`-Wert (Rückfall). Alle bisherigen Leser von `sustenance` (`personBrain.ts` Schlafgrenze und `restore_sustenance`, `decision.ts` Weckgrenze und Gewicht) bekommen einen abgeleiteten Wert `sustenance = min(hunger, thirst)`. Das ist eine Ansicht, kein gespeicherter Zwischenstand.
3. **Migration C:** nach Verifikation `sustenance`-Zeilen löschen und den Code aus dem Check nehmen.

Prüfsatz für B: Ein Lauf über die Forschungskolonie (`colonyRun`) mit gleichem Seed liefert über 60 Tage dieselbe Zahl an Mangelereignissen ±10 % wie vorher.

### 3. Spielerbedürfnisse: abgeleitet, nicht getickt

Neue Tabelle `player_needs(profile_id, need_code, satisfaction, updated_tick)`, `need_code in ('hunger','thirst')`, RLS nur Service Role.

Der Wert wird **nicht** vom Cron heruntergezählt. Gespeichert wird nur der Stand nach dem letzten Essen oder Trinken. Der aktuelle Wert wird beim Lesen berechnet:

```
aktuell = max(UNTERGRENZE, gespeichert − Rate × (jetziger Tick − updated_tick))
```

Das folgt dem Grundsatz „Zustand = Basiswert + Ereignisse + verstrichene Zeit" und erzeugt für inaktive Spieler keine Schreibvorgänge. Erste Zeile beim ersten Lesen: 1,0 (neuer Spieler ist versorgt).

Vorgeschlagene Raten für Spieler (Tick = Stunde):

| Bedürfnis | Rate je Tick | von voll bis „hungrig/durstig" (0,4) |
|---|---|---|
| thirst | 0,03 | 20 Stunden |
| hunger | 0,02 | 30 Stunden |

Wer einmal am Tag spielt, kommt also durstig, aber nicht am Ende wieder. Das ist der gewünschte Anlass, ins Lokal zu gehen.

### 4. Was bei Mangel passiert

**Bewohner:** wie bisher bei `sustenance` – Druck in der Entscheidung, Aufwachen bei kritischem Wert, `restore_sustenance`. Durst bekommt ein höheres Gewicht als Hunger (Vorschlag 1,4 gegenüber 1,1; bisher `sustenance` 1,25).

**Spieler (Alpha):** Untergrenze **0,25**. Ein Spieler verhungert und verdurstet nicht und verliert nichts, auch nicht nach einer Woche Abwesenheit. Er kommt hungrig und durstig zurück, mit Wert 0,25. Mangel ist sichtbar (Abschnitt 6) und wirkt zunächst nur auf Begegnungen: Personen nehmen einen erschöpften Spieler wahr, was sie im Gespräch zeigen dürfen. Spürbare Nachteile (z. B. Abzug in Verhandlungen) sind bewusst offen, siehe „Offene Fragen" – die 15-Minuten-Regel gilt: neue Härte nur, wenn sie eine Entscheidung erzeugt.

### 5. Welcher Posten was stillt – eine Quelle für Spieler und Bewohner

Neue Tabelle `hospitality_item_effects(entity_id, item_code, need_code, satisfaction_gain)`, Primärschlüssel über alle drei Codes. Ein Posten kann mehrere Bedürfnisse stillen. Sie gilt für Spielerbestellungen und Bewirtung; `npc_service_catalog` zieht später auf dieselben Posten um, damit Spieler und Bewohner nicht zwei Wirkungstabellen haben.

Startwerte Café:

| Posten | hunger | thirst | Preis |
|---|---|---|---|
| drink (Getränk) | – | +0,35 | 3 |
| cake (Kuchen) | +0,15 | – | 5 |
| meal (Mahlzeit) | +0,30 | +0,10 | 8 |

Bar und Restaurant folgen mit Aufgabe 7 nach demselben Muster.

### 6. Sichtbarkeit für den Spieler

- **Topbar** (`DashboardTopbarManager`): zwei kleine Anzeigen neben den Credits, Hunger und Durst als Balken. Wörter statt Zahlen im Tooltip: „satt / hungrig / sehr hungrig", „versorgt / durstig / sehr durstig" (Grenzen 0,6 und 0,4). Der Wert wird beim Laden mitgeliefert und im Client bis zum nächsten Abruf mit derselben Formel weitergerechnet – keine Abfrage im Sekundentakt.
- **API:** `GET /api/game/player/needs` liefert `{ hunger, thirst, tick }` (bereits abgeleitet). Die Bestellantwort liefert die neuen Werte mit, damit die Anzeige nach dem Bestellen sofort springt.
- **Im Lokal:** Die Karte zeigt je Posten, was er stillt (Symbol Tropfen/Teller), nicht die Zahl.
- Später, nicht Teil dieses Schritts: Spieler sehen bei Personen nur Wahrnehmbares („wirkt durstig") ab einer Grenze – passend zur wahrnehmungsbasierten Identität (`player_person_identity_knowledge`).

### 7. Ausgeben im Lokal (Aufgabe 9) – baut auf 3 und 5 auf

`order_hospitality_item` bekommt `p_recipient_person_id uuid default null`.

- **Ohne Empfänger:** Wirkung aus `hospitality_item_effects` auf `player_needs` des Bestellers.
- **Mit Empfänger:** Wirkung auf `person_needs` der Person, dazu Beziehung und Stimmung.

Prüfungen in derselben Transaktion, vor der Abbuchung:

1. Die Person ist in diesem Gebäude (`person_interior_presence` mit diesem `tile_entity_id`). Sonst `NOXIA_ORDER_RECIPIENT_NOT_PRESENT`, nichts wird gebucht.
2. Idempotenz: `player_hospitality_orders` bekommt `recipient_person_id`. Dieselbe `request_id` wirkt nur einmal – Geld, Bedürfnis, Beziehung und Stimmung werden im selben Aufruf gebucht oder gar nicht.
3. Wirkung nach Bedarf: Der Beziehungseffekt skaliert mit dem Bedarf der Person (`1 − satisfaction` vor der Gabe). Ein Getränk für eine durstige Person zählt viel, für eine versorgte wenig. Das macht Aufmerksamkeit wertvoll statt Gießkanne.

**Beziehung:** neue Tabelle `person_player_relationships(person_id, profile_id, familiarity, trust, affinity, last_interaction_tick)`, gerichtet aus Sicht der Person. Es gelten die Regeln aus NOXIA-LIVING-0008: abnehmender Ertrag (Anteil der Lücke bis zur Obergrenze), Obergrenze Bekanntschaft 0,55, Verblassen ohne Kontakt. Wer jeden Tag einen Kaffee spendiert, wird nicht automatisch Freund.

**Stimmung:** ein `population_events`-Eintrag „bewirtet von Spieler", der über den bestehenden Replay-Schutz (`person_affect.source_event_id`) `joy` anhebt. Kein direkter Schreibzugriff auf `person_affect`.

## Reihenfolge

1. Migration A (hunger/thirst für Bewohner, Werte aus `sustenance`) + `hospitality_item_effects` + `player_needs`.
2. Code B (Engine, abgeleitetes `sustenance`) – Prüfsatz colonyRun.
3. Spielerbestellung wirkt auf `player_needs` + Topbar-Anzeige + `GET /api/game/player/needs`.
4. Ausgeben im Lokal (Empfänger, Anwesenheit, Beziehungstabelle, Stimmungsereignis).
5. Migration C (`sustenance` entfernen).

Jeder Schritt ist ein eigener Deploy.

## Offene Fragen für Thomas

1. Untergrenze 0,25 für Spieler – oder sollen Spieler auch auf 0 fallen können, mit Folgen?
2. Soll Mangel beim Spieler mechanisch etwas kosten (z. B. schlechtere Verhandlung), oder vorerst nur sichtbar sein und in Gesprächen auftauchen?
3. Sinken Spielerwerte während langer Abwesenheit weiter bis zur Untergrenze (Vorschlag), oder friert der Wert nach z. B. 12 Ticks ohne Aktivität ein?
4. Durst an den Wasserbestand der Kolonie koppeln – jetzt mitplanen oder als eigener Schritt nach 5?
