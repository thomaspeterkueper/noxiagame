# NOXIA-WISH-0001 – Wünsche und Gebete, die die Welt erhört

Stand: 29.10.2026. Thomas: „Was passiert, wenn sich Spieler oder NPCs etwas wünschen oder für etwas beten, und es passiert dann wirklich, weil es für das Spiel und unsere Philosophie Sinn macht?“ – „Wenn ich die Entscheidung treffe, ist es eher wie Gott spielen. Alles, was nicht aktuellen Gesetzen oder Moralvorstellungen widerspricht, sollte das Spiel umsetzen, sofern es Sinn macht oder bei größeren Entscheidungen von vielen getragen wird … einen Admin-Bereich, wo ich sehen kann, was sich die Leute wünschen, wie viele, und wo ich Wünsche ablehnen oder anpassen kann.“

## Grundsätze

- **Das Spiel entscheidet**, nicht Thomas. Er sieht alles im Admin-Bereich und kann ablehnen, anpassen oder erfüllen.
- **Kein Glaube wird bestätigt.** Fürbitte in der Kirche, Dua in der Moschee, Gebet in Synagoge oder Tempel, Wunsch an die Resonanzrunde und ein Satz im Gespräch zählen gleich. Erhört wird nach Sinn, nicht nach Ort oder Tradition.
- **Die Welt erklärt nichts.** Wer sich etwas wünscht, bekommt nur „Aufgeschrieben. Es bleibt hier.“ – keine Zusage. Tritt es ein, geschieht es einfach.
- **Echte Anliegen bleiben privat.** Gebete aus dem eigenen Leben (Krankheit, Familie, Kummer) werden nie umgesetzt und im Admin-Bereich nur gezählt, nie im Wortlaut gezeigt. Bei Hinweisen auf eine Notlage nennt das Spiel sofort Hilfe (TelefonSeelsorge 0800 111 0 111 / 0800 111 0 222, Nummer gegen Kummer 116 111, Notruf 112).
- **Abgelehnt** wird, was gegen Recht oder Moral verstößt, anderen schadet, echte Personen betrifft oder nur dem eigenen Vorteil im Spiel dient.

## Ablauf

1. **Wünschen:** im Innenraum von Kirche, Moschee, Synagoge, Tempel, Resonanzplatz und Gemeindesaal (Feld „Fürbitte“, „Bittgebet (Dua)“, „Gebet“, „Wunsch für alle Wesen“, „Anliegen an die Runde“); im Gespräch mit Figuren („ich wünsche mir …“, „hoffentlich …“); Figuren wünschen sich selbst, was an ihrem Ort fehlt (einmal täglich um 18 Uhr, wenn ein Vorrat weniger als drei Tage reicht). Höchstens 10 Wünsche je Spieler und Tag.
2. **Einordnen:** Sprachmodell (DeepSeek, wie die Gespräche) mit Regeln als Rückfall (`lib/game/wishes/classify.server.ts`, `rules.ts`): privat, Notlage, schädlich, echte Person, eigennützig, Art, neutrale Kurzfassung, Bündel, Sinn (0–1). Was Modell oder Regeln als privat, Notlage oder schädlich erkennen, gilt.
3. **Entscheiden** (`decideWish`): klein und sinnvoll (Sinn ≥ 0,5) → sofort; groß (Versorgung, neuer Ort, neue Funktion) → erst, wenn mindestens **3 verschiedene** Menschen (Spieler oder Figuren) es in 14 Tagen wünschen; sonst „sammelt Stimmen“. Innerliches (Dank, Ruhe, Mut) wird angenommen, ohne etwas zu tun.
4. **Erfüllen** (`service.server.ts`):
   - **Zusammenkunft** am Ort des Wunsches: Sondertermin mit der Gastgeberin oder dem Gastgeber, nächster freier Termin um 11, 15, 17 oder 19 Uhr (deutsche Zeit; nicht über Wochenplan, Probe-Gottesdiensten oder anderen Sonderterminen), mindestens zwei Stunden voraus. Steht schon eine an, zählt der Wunsch dazu. Die Gemeinde kommt wie zu jedem Termin.
   - **Lieferung** an einen Ort, nur bei echtem Mangel (Vorrat reicht keine Woche): eine Woche Verbrauch, 50–500 Einheiten; Ereignis `supply_arrived`.
   - **Neuer Ort, neue Funktion, für eine Figur:** wenn sinnvoll und getragen → „in Arbeit“ für die Entwicklung (die tägliche Auswertung kann daraus Aufgaben machen).
5. **Admin-Bereich** `/admin/wuensche` – vorläufig hinter Benutzer und Passwort (HTTP Basic, Benutzer „Superadmin“, nur der SHA-256-Wert steht im Code `proxy.ts`, Wechsel über `ADMIN_BASIC_AUTH_SHA256`); die Daten zusätzlich nur für Konten in `admin_profiles` (Aristeas, Thomas, McKnight): Zahlen je Stand, Bündel mit Zahl der Menschen, einzelne Wünsche mit Wortlaut (außer privat), Begründung und Erfüllung; Aktionen: ablehnen (mit Grund), anpassen (Kurzfassung, Art, Bündel, Notiz) und neu entscheiden, erfüllen.

## Technik

- Tabelle `wishes`, `admin_profiles` (Migration `20261029050000_wishes.sql`, nur Server).
- `POST /api/game/wishes`, `GET/POST /api/admin/wishes`, Seite `app/admin/wuensche/page.tsx`.
- Im Tick: `runWishTick` (liegengebliebene Wünsche einordnen, Wünsche der Figuren).
- Gespräche: `npc-conversation` legt erkannte Wünsche nach der Antwort an (`after`).
- Tests: `lib/game/wishes/rules.test.ts`.

## Offen

- Wunschbrunnen an realen Brunnen (OSM `amenity=fountain`) – die Karte kennt Brunnen noch nicht als Ort.
- Weitere Erfüllungen, die das Spiel selbst kann (z. B. Figuren besuchen einsame Figuren, NPC-Bau aus getragenen Ortswünschen).
- Beobachten: Kommen Spieler nach einer Erfüllung öfter an Gebets- und Begegnungsorte? (player_activity_log, wishes)
