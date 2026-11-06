# NOXIA-SAFETY-0001 · Schutzfilter gegen Absprachen realer Straftaten

**Stand:** 2026-11-05
**Entscheidung (Thomas):** NOXIA darf nicht für Absprachen krimineller Dinge in der realen Welt genutzt werden. Gleichzeitig sollen Gespräche möglichst unzensiert bleiben.
**Ergänzt:** [NOXIA-PRIVACY-0004](NOXIA-PRIVACY-0004-auswertung-ohne-mitlesen.md) – „Kein Mensch liest mit“ gilt mit genau einer Ausnahme: dem Verdacht des Schutzfilters.

## Grundsatz: Spiel bleibt Spiel

Schmuggel auf dem Mars, Intrigen im Rat, ein Mord im Roman – alles Spiel, kein Treffer. Der Filter (`lib/game/safety/realWorldRisk.ts`) schlägt erst an, wenn Merkmale **kombiniert** auf die reale Welt zeigen:

| Verdacht | Merkmale |
|---|---|
| Missbrauchsdarstellungen | allein ausreichend |
| Reale Ware | Drogen, Waffen, gefälschte Dokumente **und** Geldweg, Kontaktdaten oder „in echt“ |
| Gewalt | Gewalt **und** „in echt“, Schule oder konkretes Treffen |
| Minderjährige | Hinweis auf Alter/Schule **und** Geheimhaltung, Kanalwechsel oder sexueller Bezug |
| Geheimhaltung | Geheimhaltung **und** sexueller Bezug, oder Geheimhaltung **und** Kontakt **und** „in echt“ |

Einzelne Merkmale sind nur `watch`: Sie werden gezählt (Kennzeichen `risk:*`), nie lesbar.

## Ablauf

- **Raum-Chat:** Bewertet wird das Fenster der letzten 30 Minuten (beim Flüstern beide Seiten). Die Nachricht wird **trotzdem zugestellt** – eine Blockade würde verraten, wonach gefiltert wird. Kontaktdaten werden wie bisher in der gezeigten Fassung entfernt.
- **NPC-Gespräche:** Gegenüber ist eine Figur, keine Absprache möglich. Kennzeichen werden gezählt; gesichert wird nur bei Missbrauchsdarstellungen. Die Figuren helfen nicht bei realen Straftaten und vermitteln keine Treffen, Nachrichten oder Kontakte zwischen Spielern (Prompt-Regel). Verbrechen in der Spielwelt behandeln sie ohne Moralisieren.
- **Bei Verdacht:** `secureSuspicion` legt einen Bericht mit `origin = 'filter'` in `conversation_reports` an (Ausschnitt im Original, Merkmale, Grund). Höchstens ein Bericht je Person und Ort in 30 Minuten. Die Kopie ist von der 14-Tage-Löschung ausgenommen und wird nach 90 Tagen gelöscht. Abrufe im Adminbereich landen in `admin_conversation_read_audit`.
- **Hinweis an Spieler:** `/testbetrieb` („Spiel ist Spiel – reale Straftaten nicht“), Zeile unter jedem Gespräch, Dashboard.

## Offen

- Regeln sind Schlüsselwörter – grob, absichtlich ohne KI-Aufruf. Nach den ersten Wochen anhand der Merkmalszählung nachschärfen.
- Ablauf festlegen, was bei einem bestätigten Verdacht passiert (Sperre, Meldung an Behörden). Rechtliche Prüfung, besonders wegen Schulen und Minderjährigen.
