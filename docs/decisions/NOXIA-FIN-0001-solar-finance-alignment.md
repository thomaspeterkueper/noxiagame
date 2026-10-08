# NOXIA-FIN-0001 — Abgleich solarer Finanzkanon und lokale Simulation

Status: Architekturabgleich / Konzept, NICHT für Live-Aktivierung
Datum: 2026-10-08
Quellen: OTA-FND-0008-2025-DE (Solares Finanzsystem), OTA-TEC-0023-2091-DE (Mars Credit), OTA-TEC-0024-2150-DE (relativistische Finanzmetriken).
Code-Bestand: docs/core/RESOURCE_INVENTORY_ECONOMY_MAP.md, docs/decisions/NOXIA-LIVING-0010-housing-and-job-market.md, lib/game/npcEconomy.ts, supabase/migrations/20261008150000_employer_funding.sql.

## Trennung der Ebenen

1. Lokale Simulationscredits: operative Löhne, Mieten, Konsum, Steuern, Eigentümer-Einlagen; keine vorschnelle Benennung als MCR.
2. Historisch/fiktionaler Mars Credit (MCR): eigenständiges Mars Financial Network, Einführung 2075/2082, Settlement zur Erde; zeitgebunden.
3. Solar Clearing Unit (SCU-1): überplanetares Clearing, keine örtliche Alltagswährung.
4. Entropy Credit / relativistische Metriken: spekulative spätere Stufe; keine Produktionsregel aus physikalischer Behauptung ableiten.

Ein Simulation-Credit ist NICHT ohne explizite Epoch-/Standort-/Wechselkursentscheidung ein Mars Credit oder SCU-1. Der physikalische Entropie-Anker ist fiktionale/spekulative Designannahme, kein bewiesenes finanzphysikalisches Gesetz.

## Stand am 08.10.2026 (Repository, nicht als Live-DB-Migrationsbestätigung)

- `npc_ledger` dient für Einnahmen, Löhne und Einlagen; `runNpcPayrollTick` führt Synchronisation, Payroll und Mieten im 24-Tick-Raster aus. `runNpcConsumptionTick` läuft alle 6 Ticks.
- `fund_player_corp` erlaubt Eigentümer-Einlagen; Einnahmen und Einlagen sind nicht identisch mit Umsätzen.
- Migration `20261008150000_employer_funding.sql` korrigiert Ledger-Constraint für `building_payout`/`tax_payout`, überträgt bestimmte lokale Steuereinnahmen an öffentliche Arbeitgeber und gibt einmalig 14 Tageslöhne als `endowment` aus. Vorhandensein im Repository bestätigt NICHT Anwendung in der Datenbank.
- Bei ungenügendem Arbeitgeberkonto entfällt Lohn. Eine Übergangsreserve verhindert keinen strukturellen Liquiditätsmangel.
- Core-Vertrag erlaubt explizite monetäre Quellen/Senken (u.a. Loans), fordert aber atomare Transfers und idempotente Buchungen. Das ist keine Bestätigung, dass alle gewünschten Kreditprodukte implementiert sind.

## Geldmengen- und Buchungssemantik

Unterscheide verpflichtend:
- TRANSFER: gleich hohe Soll-/Habenbuchung zwischen Akteuren; Geldmenge unverändert.
- FISKALISCH: Steuer als Transfer Akteur -> öffentliche Kasse; Auszahlung als Transfer öffentliche Kasse -> Empfänger. Steuern dürfen nicht zugleich Einnahme des Staates und zusätzliche Geldschöpfung sein.
- EMISSION/ENDOWMENT: explizite neue Simulationseinheiten mit Ursache, Emittent, Epoch-Kontext, Obergrenze und Audit-Referenz.
- KREDITVERGABE: Forderung und Verbindlichkeit gleicher Höhe; falls Depositen neu geschaffen werden, Geldmengenänderung gesondert ausweisen. Rückzahlung reduziert Forderung/Verbindlichkeit und ggf. Einlagen; Zins ist Ertragstransfer, keine automatische reale Wertschöpfung.
- VERNICHTUNG/SINK: expliziter, auditierbarer Abfluss aus dem Geldkreislauf.
- VERRECHNUNG (SCU-1): Austausch/Netting getrennt von lokaler Emission.

Nicht allein `SUM(credit_delta)` über unterschiedlich definierte Konten als globale Geldmenge interpretieren: Kontenabgrenzung, Transfers, Quellen und Schulden vorher typisieren.

## Abgleich mit Arbeitgeberproblem

1. Erst feststellen, ob Migration in Live-DB tatsächlich angewendet und `colony_ledger` wieder befüllt wird.
2. `colony_ledger -> npc_ledger` auf exakte Referenzen, Idempotenz und **Doppelzählung** prüfen. Öffentliches Arbeitgeberbudget darf bei der Spiegelung nicht zusätzliches Geld aus dem Nichts schaffen, sofern ursprünglich ein Steuertransfer vorgesehen ist.
3. Budgetidentität öffentlich: Anfangsbestand + echte Steuereingänge + explizite Zuschüsse - Löhne - Beschaffung - sonstige Ausgaben = Endbestand.
4. Private Firmen benötigen Verkäufe/Aufträge/Einlagen oder später echten Kredit; eine pauschale tägliche Zuschreibung wäre nur für klar ausgewiesenen Förderbetrieb sinnvoll.
5. Einmalige Bootstrap-Endowments getrennt von normaler Geldschöpfung und wirtschaftlicher Leistung statistisch führen.
6. Danach Forschungsläufe mit unveränderten Ausgangsdaten und alternativen nachhaltigen Einnahmequellen vergleichen.

## Kreditsystem — Entwurf, nicht aktiv

Kreditvertrag benötigt mindestens `lender_actor_id`, `borrower_actor_id`, `principal`, `outstanding_principal`, `annual_rate`, `opened_tick`, `due_tick`, `currency_scope`, `status`, `default_state`, `purpose`, `reference`. Dazu unveränderliche Buchungshistorie, eindeutig referenzierte Auszahlung/Tilgung/Zins und getrennte Sicherheiten.

Vor jeder Einführung festlegen, ob Banken Depositen erzeugen dürfen oder nur bestehende Mittel verleihen. Beide Regime in **getrennten Forschungsläufen** testen. Keines unbemerkt als kanonisch setzen.

## Aktivierungsgates

G0: Dokumentiert (dieses Dokument).
G1: Buchungssemantik und Geldmengen-Invarianten als reine Regeln + Tests. **Umgesetzt am 08.10.2026** in `lib/game/financeSemantics.ts` und `financeSemantics.test.ts`; der Forschungslauf weist zusätzlich Anfangs-/Endgeldmenge, explizite Emissionen, Senken und unerklärte Differenzen aus.
G2: Deterministischer Forschungslauf inkl. Insolvenzen, Zins, Tilgung und Fiskaltransfer.
G3: Lesender Audit auf tatsächlichem Live-Bestand; keine Mutationen.
G4: Schattenbetrieb mit Auditlog und Feature-Flag standardmäßig AUS.
G5: Erst nach expliziter Freigabe Migration/Produktionsaktivierung.

Tests mindestens: Nullsummen-Transfer, steuerliche Doppelzählung, Kredit-Doppelvergabe bei Retry, Lohn ohne Deckung, Tilgung, Zins, Ausfall, Begrenzung pro Währungsraum, Konjunktions-/Settlement-Latenz im separaten späteren Modell.

## Kein vorschneller Kanonwechsel

Die OTA-Dokumente bleiben Weltkanon, die heute laufende Ökonomie bleibt lokale technische Implementation. Finanzierungsmechanismen sind Hypothesen, bis durch mehrjährige Experimente validiert. Komplexe interplanetare und relativistische Verträge bleiben vorbereitet, aber deaktiviert.


## G1-Implementierungsbefund (2026-10-08)

Die reine Finanzsemantik klassifiziert Transaktionen als Transfer, Fiskaltransfer, Emission, Senke, Clearing oder Kreditvorgang. Transfer/Fiskal/Clearing müssen Nullsummenbuchungen sein; Emissionen und Senken brauchen eine Audit-Referenz und müssen die Geldmenge in der erwarteten Richtung ändern. Kreditvorgänge werden bewusst noch nicht als normale Geldbewegung akzeptiert, sondern verlangen später eine eigene Forderungs-/Verbindlichkeitsinvariante.

Der Forschungslauf weist nun zusätzlich eine Geldmengenbilanz aus:

- `initial` / `final`: erfasste liquide Bestände von Personen, Arbeitgebern und externen Eigentümerkonten,
- `employerIncomeEmission`: bisherige vereinfachte tägliche Arbeitgeber-Einnahmen ohne modelliertes Gegenkonto,
- `livingCostSink`: Lebenshaltung, solange kein Empfängerkonto modelliert ist,
- `propertyBuybackEmission`: explizit ausgewiesene Vereinfachung beim Rückverkauf von Eigentum an den abstrakten Markt,
- `unexplainedDelta`: Differenz zwischen erwarteter und tatsächlicher Geldmengenänderung.

Damit wird eine neue implizite Emission sichtbar: Der bisherige Forschungsmarkt zahlt beim Rückverkauf eines Hauses 90 % an die Person, ohne ein Gegenkonto zu belasten. Der Mechanismus bleibt vorerst unverändert, wird aber nicht mehr als neutraler Transfer missverstanden.

Die geplante Steuer-Gegenbuchung ist damit nachgelagert: Sie muss als echter Fiskaltransfer `Koloniekasse -> öffentlicher Arbeitgeber` die Nullsummen-Invariante erfüllen und darf keine zusätzliche Geldmenge erzeugen.

## Steuer-Gegenbuchung (2026-10-08)

Migration `20261008210000_public_funding_fiscal_transfer.sql`: `sync_employer_economy` bucht die Finanzierung öffentlicher Arbeitgeber als Fiskaltransfer. Jeder neuen Gutschrift im `npc_ledger` (Referenz `colony_ledger:<id>`) steht im selben Statement eine gleich hohe Belastung der Koloniekasse gegenüber (`entry_type = 'public_service_transfer'`). Eine Wiederholung bucht keine Seite erneut. Gegen G1 geprüft in `financeSemantics.test.ts`. Die Migration ist gegen keine Datenbank gelaufen.

Offen: `lib/game/tick.ts` bucht `building_payout` als Belastung der Koloniekasse und schreibt den Betrag dem Spielerprofil gut. Diese Ausschüttung hat keine Einnahme als Gegenstück; die Koloniekasse wird dadurch negativ. Nach G1 ist das eine Emission, die als solche ausgewiesen oder aus echten Einnahmen gedeckt werden muss.

## Gebäudeausschüttung abgeschaltet (2026-10-08)

Entscheidung: Ausschüttungen müssen aus echten Erlösen gedeckt sein. Produktion erzeugt Güter, keine Credits.

- `lib/game/tick.ts`: Die automatische Gutschrift (`building_payout`, samt `tax_payout` darauf) läuft nicht mehr. Rückfall nur über `NOXIA_LEGACY_BUILDING_PAYOUT=true`.
- Folge für Spieler: Gebäude bringen bis zur Anbindung echter Einnahmen keine Credits mehr.
- Folge für den Haushalt: `tax_payout` entfällt als Steuerquelle. Öffentliche Arbeitgeber erhalten erst wieder Einnahmen, wenn Steuern aus echten Transfers fließen (`tax_transaction`, `tax_landing`, `tax_property`, `tariff`).

Reihenfolge danach: Miete (Mietzahler an Eigentümer), Warenverkauf (Käufer an Verkäufer), öffentliche Leistung (Budget an Betreiber); Steuer jeweils aus dem Transfer abgezweigt. Förderung nur als ausgewiesener Zuschuss aus einem finanzierten Haushalt.

Noch nicht geprüft: Rückbau und Verkauf von Gebäuden (`app/api/game/build/route.ts`) schreiben Spielern ebenfalls Credits ohne Gegenkonto gut.


## Miettransfer als erster echter Einnahmepfad

Die G1-Regel für besteuerte Mietzahlungen ist jetzt als reine Funktion `taxedTransfer` modelliert: Bruttomiete wird beim Mieter abgebucht, Nettomiete beim Vermieter gutgeschrieben und die Steuer an die öffentliche Kasse geleitet. Die Buchung bleibt nullsummig.

Wichtig für den Live-Bestand: Bestehende private Wohnzuweisungen sind historische `backfill`-Zuweisungen ohne vereinbarte Miete. Sie werden nicht rückwirkend belastet. Echte Mieterlöse entstehen daher erst bei neuen Marktverträgen oder einem später expliziten Vertragsübergang.

Die Einnahme eines spielereigenen Mietobjekts landet zunächst beim zugeordneten `player_corp`-Akteur. Eine Übertragung auf `profiles.credits` wäre ein separater Eigentümer-/Dividenden-Transfer und darf nicht stillschweigend erfolgen.

Aktuell sind alle konfigurierten lokalen Steuersätze 0. Ein künftiger Mietsteuersatz muss daher ausdrücklich beschlossen werden; er wird nicht aus `tax_property` oder `tax_transaction` erraten.
