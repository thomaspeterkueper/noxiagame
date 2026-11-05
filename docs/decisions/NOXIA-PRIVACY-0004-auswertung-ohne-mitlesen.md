# NOXIA-PRIVACY-0004 · Gesprächsauswertung ohne Mitlesen

**Stand:** 2026-11-05
**Entscheidung (Thomas):** Spielergespräche werden ausschließlich automatisch ausgewertet. Im Adminbereich gibt es keine Einsicht in den Wortlaut. Die Auswertung wird den Spielern offen mitgeteilt.
**Löst ab:** [NOXIA-PRIVACY-0003](NOXIA-PRIVACY-0003-test-dialog-diagnostics.md) (Rohtext-Diagnostik ab Stichtag) und die Aufbewahrungsregel „in der Alpha wird nichts gelöscht“ (27.10.2026) für den Wortlaut.
**Request:** [REQ-NOXIA-20261105-gespraeche-ohne-mitlesen](../../internal-tasks/done/REQ-NOXIA-20261105-gespraeche-ohne-mitlesen.md)

## Begründung

Wer weiß, dass mitgelesen wird, spricht nicht mehr authentisch. Für das Experiment sind unbeobachtete Gespräche wertvoller als lesbare. Verschweigen ist keine Alternative: Auch automatische Auswertung ist Verarbeitung personenbezogener Daten und muss offen gesagt werden. Die Zusage „Kein Mensch liest mit“ beruhigt, weil sie technisch durchgesetzt ist.

## Regeln

| Gesprächsart | Behandlung |
|---|---|
| Spieler ↔ Spieler (Raum-Chat) | geschützt |
| Spieler ↔ NPC (auch NPC-Antworten) | geschützt |
| NPC ↔ NPC ohne Spieler | frei auswertbar (kein Personenbezug) |
| Admin-Testkonten (`admin_profiles`) | im Adminbereich lesbar, keine Löschfrist |

- **Keine Rohtext-Ansicht:** `/api/admin/conversation-insights` liefert nur Kennzahlen. Die frühere Route `/api/admin/conversation-audit` ist entfernt. Datenbanksichten ohne Wortlaut und ohne Spieler-ID.
- **Mindestgruppe:** Jede Auswertungszelle braucht mindestens 5 verschiedene Spieler (`MIN_GROUP` in `lib/game/conversationInsights.ts`), sonst „zu wenig Daten“.
- **Löschfrist:** `purge_conversation_raw_text(14)` läuft nachts im Retention-Job (`/api/cron/retention`, 03:00 UTC). NPC-Gesprächen wird der Wortlaut entfernt (`text_purged_at`), Kennzahlen und Kausalspur bleiben. Raum-Nachrichten werden gelöscht.
- **NPC-Gedächtnis:** bleibt Spielmechanik, speichert je Austausch höchstens 200 Zeichen (`MEMORY_EXCHANGE_CHARS`), ist nicht im Adminbereich einsehbar und verschwindet mit dem Konto.
- **Melden:** `ConversationReport` unter jedem NPC-Gespräch, „melden“ neben Raum-Nachrichten. `/api/game/conversation-report` kopiert den Ausschnitt in `conversation_reports` (90 Tage). Nur diese Kopie ist für Admins lesbar; jeder Abruf landet in `admin_conversation_read_audit`.
- **Hinweis:** `/testbetrieb`, Dashboard-Hinweis und Zeile unter jedem Gespräch.

## Ergänzungen

- [NOXIA-SAFETY-0001](NOXIA-SAFETY-0001-schutzfilter-realwelt.md): einzige Ausnahme von „kein Mensch liest mit“ – vom Schutzfilter gesicherte Ausschnitte bei Verdacht auf reale Straftaten.
- [NOXIA-LEARN-0001](NOXIA-LEARN-0001-npcs-lernen-von-spielern.md): Figuren lernen aus Aussagen über die Welt; gestuftes Vergessen statt 14 Tagen.

## Offen

- Rechtliche Prüfung der Formulierungen, besonders bei Schulen und Minderjährigen.
- KI-Dienst in der vollständigen Datenschutzerklärung (KG-Registry `legal/datenschutz.de.md`) nennen.
- Endgültige Fristen und Mindestgruppe nach den ersten Tests bestätigen.
- Bei wenigen Testspielern (unter 5) bleiben die Spielerkennzahlen leer – das ist gewollt.
