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

## Sprachen und Codes (06.11.2026)

Thomas: „Wir dürfen nicht vergessen, dass auch andere Sprachen benutzt werden können, oder auch Codes, die harmlos klingen.“

- **Alle Schriften:** `lib/game/safety/textFold.ts` vereinheitlicht Text, ohne nicht-lateinische Buchstaben zu löschen. Vorher wurde Russisch, Arabisch usw. vollständig verworfen; der Filter war für diese Sprachen blind.
- **Tarnungen** werden aufgelöst: kyrillische oder griechische Buchstaben in lateinischen Wörtern („kоks“), Ziffern statt Buchstaben („k0ks“), getrennte Buchstaben („k.o.k.s“, „k o k s“), ausgeschriebene Kontaktdaten („null eins sieben …“, „max punkt muster at gmail punkt com“) → Merkmal `obfuscated_contact`.
- **Merkmale in acht Sprachen:** Deutsch, Englisch, Türkisch, Russisch, Arabisch, Polnisch, Spanisch, Französisch. Bewusst ausgelassen sind Wörter, die im Spiel harmlos sind (Gras, Crystal, Coke, Nudel, Sextant, „Klasse!“, poln. „droga“, dt. „arme“, russ. „перевод“).
- **Sprachunabhängig – greift auch bei harmlosen Codewörtern:** reale Währung (`real_currency`; im Spiel gibt es nur Credits), Menge mit Einheit (`quantity`), Bezahldienste, Kanalwechsel. Zusammen ergeben sie ein **Handelsmuster** (`trade_shape`): „2 Tickets für 50 €, Freitag am Bahnhof“ fällt auf, egal wie die Ware heißt.
- **Nicht abgedeckte Sprache** (z. B. Niederländisch, Griechisch, Hebräisch) wird als Merkmal `unscreened_language` festgehalten.
- **Stufe 2 – KI-Prüfung** (`lib/game/safety/aiReview.ts`): Codewörter kann keine Liste kennen. Auffällige Fenster (`needsAiReview`: Handelsmuster, getarnte Kontakte, nicht abgedeckte Sprache beim Flüstern, mehrere Merkmale, Hinweise auf Minderjährige oder Geheimhaltung) prüft Claude Haiku im Zusammenhang, im Hintergrund (`after()`), ohne Spielernamen. Höchstens eine Prüfung je Person und Raum in 10 Minuten. Gespeichert wird nur das Ergebnis (`safety_reviews`). Bei „real_world“ ab 60 % Sicherheit wird der Ausschnitt gesichert. Die KI entscheidet nichts über Spieler.
- **Lernen** nur aus Sätzen, die der Filter lesen kann (Deutsch, Englisch) – sonst könnten Figuren als Briefkasten in einer ungeprüften Sprache dienen.

## Verfahren bei Verdacht – Entwurf, zu entscheiden

| Schritt | Vorschlag | Entscheidung |
|---|---|---|
| Wer prüft? | Thomas oder eine benannte Vertretung; nur Admin-Konten | offen |
| Frist | gesicherte Ausschnitte innerhalb von 48 Stunden ansehen | offen |
| Kein Verdacht | als „erledigt“ markieren; keine Folgen, keine Nachricht an den Spieler | offen |
| Grenzfall | Hinweis an den Spieler im Spiel („Bitte keine Absprachen für die reale Welt“), ohne Zitat | offen |
| Klarer Verstoß | Konto sperren; Ausschnitt über die 90 Tage hinaus nur so lange aufbewahren, wie für eine Meldung nötig | offen |
| Minderjährige in Gefahr oder Missbrauchsdarstellungen | sofort sperren, Beweise sichern, nicht selbst ermitteln, Meldung an die Polizei bzw. die Internetwache des Landes; bei Missbrauchsdarstellungen zusätzlich Meldestelle (z. B. jugendschutz.net, eco-Beschwerdestelle) | offen |
| Drohung mit realer Gewalt | sofort Polizei (110 bei akuter Gefahr) | offen |
| Dokumentation | jede Entscheidung mit Datum und Grund am Bericht; Abruf steht im Lese-Audit | offen |

## Offen

- Rechtliche Prüfung: Verfahren, Aufbewahrung über 90 Tage, Meldewege, Pflichten gegenüber Behörden; besonders wegen Schulen und Minderjährigen.
- Nach den ersten Wochen anhand der Zählungen nachschärfen: Wie oft schlagen Regeln an, wie oft sagt die KI „game“?
- Weitere Sprachen nach Bedarf (z. B. Ukrainisch, Kurdisch, Rumänisch); bis dahin übernimmt die KI-Prüfung.
- NPC-Gespräche: bisher nur Kennzeichen und Sicherung bei Missbrauchsdarstellungen; KI-Prüfung dort, falls sich Missbrauch zeigt.
