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

### 3. Spielerbedürfnisse: abgeleitet, nach Spielzeit

**Entschieden (Thomas, 12.10.2026): Ist der Spieler nicht da, ändert sich sein Zustand nicht.** Spielerbedürfnisse laufen deshalb nicht nach Weltzeit (Ticks), sondern nach aktiver Spielzeit. Bewohner leben weiter nach Weltzeit. Das sind bewusst zwei Uhren.

**Aktive Spielzeit messen**

- `profiles.active_minutes` (Zähler) und `profiles.last_active_minute` (letzte gezählte Minute, z. B. Unix-Minuten).
- Der Client sendet höchstens einmal pro Minute ein Lebenszeichen (`POST /api/game/player/presence`) – nur wenn der Tab sichtbar ist (`document.visibilityState === 'visible'`) und es in den letzten 5 Minuten eine Eingabe gab. Ein vergessener offener Tab zählt nicht als Spielzeit.
- Der Server zählt atomar und höchstens einmal je Minute:
  `update profiles set active_minutes = active_minutes + 1, last_active_minute = :jetzt where id = :spieler and coalesce(last_active_minute, 0) < :jetzt`
  Doppelte oder vorgezogene Lebenszeichen bewirken nichts. Die Minute bestimmt der Server, nicht der Client.

**Bedürfniswert ableiten**

Neue Tabelle `player_needs(profile_id, need_code, satisfaction, active_minutes_at, updated_tick)`, `need_code in ('hunger','thirst')`, RLS nur Service Role. Gespeichert wird nur der Stand nach dem letzten Essen oder Trinken, samt Zählerstand der Spielzeit zu diesem Moment. Der aktuelle Wert wird beim Lesen berechnet:

```
aktuell = max(UNTERGRENZE, gespeichert − Rate × (active_minutes jetzt − active_minutes_at))
```

Kein Cron, keine Schreibvorgänge für Abwesende, und es stimmt auch über mehrere Sitzungen mit Pausen dazwischen. Erste Zeile beim ersten Lesen: 1,0 (neuer Spieler ist versorgt). `updated_tick` bleibt nur als Historie.

Vorgeschlagene Raten (je Minute aktiver Spielzeit):

| Bedürfnis | Rate je Minute | bis „durstig/hungrig" (0,4) | bis Untergrenze (0,25) |
|---|---|---|---|
| thirst | 0,005 | 2 Stunden Spielzeit | 2,5 Stunden |
| hunger | 0,0033 | 3 Stunden Spielzeit | 3,75 Stunden |

In einer normalen Sitzung kommt so einmal der Anlass, ins Lokal zu gehen – spürbar, aber nicht ständig. Wer eine Woche nicht spielt, kommt genau so zurück, wie er gegangen ist.

### 4. Was bei Mangel passiert

**Bewohner:** wie bisher bei `sustenance` – Druck in der Entscheidung, Aufwachen bei kritischem Wert, `restore_sustenance`. Durst bekommt ein höheres Gewicht als Hunger (Vorschlag 1,4 gegenüber 1,1; bisher `sustenance` 1,25).

**Spieler – entschieden (Thomas, 12.10.2026): Mangel ist vorerst nur sichtbar.** Er kostet nichts: keine Abzüge in Handel, Verhandlung, Reise oder Bau. Untergrenze 0,25 – ein Spieler verhungert und verdurstet nicht. Mangel zeigt sich in der Topbar (Abschnitt 6) und darf in Gesprächen auftauchen: Personen nehmen einen erschöpften Spieler wahr und dürfen das ansprechen, ohne dass es Werte ändert. Mechanische Folgen erst, wenn sie eine echte Entscheidung erzeugen (15-Minuten-Regel), und nur mit eigener Entscheidung.

### 5. Welcher Posten was stillt – eine Quelle für Spieler und Bewohner

Neue Tabelle `hospitality_item_effects(entity_id, item_code, need_code, satisfaction_gain)`, Primärschlüssel über alle drei Codes. Ein Posten kann mehrere Bedürfnisse stillen. Sie gilt für Spielerbestellungen und Bewirtung; `npc_service_catalog` zieht später auf dieselben Posten um, damit Spieler und Bewohner nicht zwei Wirkungstabellen haben.

Startwerte Café:

| Posten | hunger | thirst | Preis |
|---|---|---|---|
| drink (Getränk) | – | +0,35 | 3 |
| cake (Kuchen) | +0,15 | – | 5 |
| meal (Mahlzeit) | +0,30 | +0,10 | 8 |

Bar und Restaurant (Karte aus Request R-2 der Gastronomie, 13.10.2026):

| Lokal | Posten | hunger | thirst | Preis |
|---|---|---|---|---|
| bar | drink (Getränk) | – | +0,35 | 3 |
| bar | snack (Snack) | +0,10 | – | 4 |
| bar | longdrink (Longdrink) | – | +0,30 | 6 |
| restaurant | drink (Getränk) | – | +0,35 | 3 |
| restaurant | dessert (Nachtisch) | +0,15 | – | 5 |
| restaurant | starter (Vorspeise) | +0,15 | +0,05 | 6 |
| restaurant | main (Hauptgericht) | +0,40 | +0,10 | 12 |

Der Longdrink stillt etwas weniger Durst als ein Getränk und kostet mehr: In der Bar zahlt man für den Ort und die Gesellschaft, nicht für die Versorgung. Diese Wirkung (Stimmung, `variety`) gehört zur offenen Aufgabe „Wirkung des Lokals auf Stimmung", nicht in diese Tabelle.

### 6. Sichtbarkeit für den Spieler

- **Topbar** (`DashboardTopbarManager`): zwei kleine Anzeigen neben den Credits, Hunger und Durst als Balken. Wörter statt Zahlen im Tooltip: „satt / hungrig / sehr hungrig", „versorgt / durstig / sehr durstig" (Grenzen 0,6 und 0,4). Der Wert wird beim Laden mitgeliefert und im Client mit derselben Formel weitergerechnet, aber nur für Minuten, die als aktiv zählen (dieselbe Bedingung wie beim Lebenszeichen). Ist der Tab im Hintergrund, steht die Anzeige still. Keine Abfrage im Sekundentakt.
- **API:** `GET /api/game/player/needs` liefert `{ hunger, thirst, activeMinutes, ratePerMinute }` (bereits abgeleitet). Die Antwort auf das Lebenszeichen liefert dieselben Felder. Die Bestellantwort liefert die neuen Werte mit, damit die Anzeige nach dem Bestellen sofort springt.
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
3. Spielzeit-Zähler (`profiles.active_minutes`, Lebenszeichen) + Spielerbestellung wirkt auf `player_needs` + Topbar-Anzeige + `GET /api/game/player/needs`.
4. Ausgeben im Lokal (Empfänger, Anwesenheit, Beziehungstabelle, Stimmungsereignis).
5. Migration C (`sustenance` entfernen).

Jeder Schritt ist ein eigener Deploy.

## Offene Fragen für Thomas

Entschieden am 12.10.2026: Mangel beim Spieler vorerst nur sichtbar (Abschnitt 4); Zustand ändert sich nicht, solange der Spieler nicht da ist (Abschnitt 3).

1. Untergrenze 0,25 beibehalten – oder darf der Wert auf 0 fallen, da Mangel ohnehin nichts kostet?
2. Durst an den Wasserbestand der Kolonie koppeln (nur Bewohner) – jetzt mitplanen oder als eigener Schritt nach 5?
3. Raten nach Spielzeit (2 bzw. 3 Stunden bis „durstig/hungrig") – nach den ersten Testsitzungen nachjustieren?
