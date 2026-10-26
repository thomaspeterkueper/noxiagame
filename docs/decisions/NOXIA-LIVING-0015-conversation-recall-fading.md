# NOXIA-LIVING-0015 – Gesprächsgedächtnis: Verblassen und Aufwärmen

Stand: 26.10.2026 · Status: umgesetzt (`lib/game/cognition/conversationRecall.ts`, `app/api/game/npc-conversation/route.ts`)

## Entscheidung (Thomas, 26.10.2026)

Alle Figuren merken sich Gespräche mit einem Spieler, auch über längere Zeit. Die Erinnerung verwischt aber, wenn man sich nicht wiedertrifft – und wird wieder scharf, wenn ein Thema neu aufgewärmt wird.

## Wie es gebaut ist

Grundlage bleibt `npc_player_conversation_memory` (je Figur und Spieler: letzte Wortwechsel mit Zeitstempel, Wiedersehens-Wert `recent_encounter_score`, Zahl der Begegnungen). Neu ist, wie daraus Erinnerung wird:

| Alter des Wortwechsels | Stufe | Was die Figur im Gespräch davon hat |
|---|---|---|
| bis 3 Tage | frisch | wörtlich, mit Ort und „vorhin/gestern“ |
| bis 21 Tage | verblasst | nur der Sinn („ihr habt über … gesprochen“), ausdrücklich als unsichere Erinnerung |
| bis 90 Tage | schwach | eine Zeile: „ihr habt euch schon einmal unterhalten, irgendwas mit …“ (Themenwörter) |
| darüber | vergessen | fällt beim nächsten Schreiben aus dem Gedächtnis |

- **Wiedersehen hält:** Die Schwellen werden mit dem Wiedersehens-Wert gedehnt (bis zum Dreifachen). Wer eine Figur oft trifft, bleibt ihr länger wörtlich in Erinnerung.
- **Aufwärmen:** Teilt die aktuelle Nachricht des Spielers ein Inhaltswort (ab fünf Buchstaben) mit einem alten Wortwechsel, gilt dieser wieder als frisch: Er wird wörtlich eingespielt („du erinnerst dich wieder genau“) und bekommt beim Speichern einen neuen Zeitstempel. Das gilt auch mitten im Gespräch, nicht nur beim Begrüßen.
- **Personal an Wahrzeichen** (Bibliothek, später Kirche u. a.) bekommt beim ersten Gespräch eine feste Personenzeile in `people` (`person_key = landmark-staff:<Ort>`) und nimmt damit am selben Gedächtnis teil.

## Grenzen

- Erinnert wird nur Gesagtes, keine Beobachtung (dafür: Wissensspuren, `personEpistemicPersistence`). Die Figur weiß also, was der Spieler erzählt hat, nicht, was er getan hat.
- Das Verblassen ist regelbasiert über das Alter; eine Gewichtung nach Bedeutung des Gesagten (Salienz) fehlt noch – ein beiläufiges „hallo“ hält so lange wie ein Versprechen.
- Aufwärmen trifft über Wortgleichheit, nicht über Sinn: „Krimi“ wärmt „Krimis“ nicht auf.
