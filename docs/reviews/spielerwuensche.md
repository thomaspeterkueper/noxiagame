# Spielerwünsche aus Gesprächen – erkennen, prüfen, erst dann bauen

Stand: 29.10.2026.

Wunsch Thomas (29.10.2026): Die Gespräche sollen helfen, NOXIA besser zu machen, durch automatische Auswertung. Daraus sollen neue Möglichkeiten in NOXIA entstehen. Sagt jemand „ich kann dies oder das nicht machen“, ist das ein Hinweis, dass vielleicht eine Funktion fehlt.

Und:
- Nicht alles, was ein Spieler will, wird umgesetzt.
- Es muss zur Spielidee passen und ethisch vertretbar sein; nichts, was das Spiel pervertiert.
- Beispiel Toilette: Dort war es sinnvoll, Toiletten zu ergänzen.
- Die Frage der Omnizedenz: Hilft es einem selbst oder anderen beim Werden, oder schränkt es ein?

Gegenstücke: `docs/reviews/npc-gespraeche-testphase.md` (Protokoll), `docs/reviews/spielerverhalten-testphase.md` (Klicks, Wege).

## 1. Erkennen (automatisch, bei jedem Gesprächszug)

`lib/game/cognition/featureWish.ts` liest den Satz des Spielers und schreibt den Hinweis ins Gesprächsprotokoll (`npc_conversation_log`):

| `wish_kind` | Beispiel |
|---|---|
| `blocked` | „Ich kann hier nicht bauen“, „das Bezahlen geht nicht“ |
| `missing` | „Gibt es hier keine Börse?“, „hier sind zu wenig Leute“ |
| `wish` | „Ich möchte ein Café eröffnen“ |
| `seeking` | „Ich suche eine Toilette“, „wo kann ich schlafen?“ |
| `how_to` | „Kann ich hier pinkeln?“, „wie kann man …“ |

Dazu kommen:
- `wish_object`: worum es geht, ohne Füllwörter;
- `wish_npc_denied`: Die Figur hat verneint („gibt es hier nicht“, „hier wird nicht getanzt“). Das ist der stärkste Hinweis auf eine Lücke.

Begrüßung und Neuigkeiten zählen nicht. Die bisherigen Gespräche sind nachgetragen.

## 2. Bündeln

Die Sicht `player_feature_wishes` fasst die Hinweise zu Wünschen zusammen. Sie zählt:
- Nennungen, Spieler und Verneinungen der Figur;
- Grenztests (`topic = 'provocation'`);
- Beispiele, Orte, das erste und das letzte Mal.

Ein Wunsch ohne Prüfung steht oben (`reviewed = false`).

## 3. Prüfen (tägliche Auswertung empfiehlt, Thomas entscheidet)

Je Wunsch eine Zeile in `player_feature_wish_reviews`, in dieser Reihenfolge geprüft:

1. **Gibt es das schon?**
   - Dann `vorhanden`, und die Frage ist, warum der Spieler es nicht gefunden hat: Hinweis im Raum, Wissen der Figur, Weg auf der Karte.
2. **Passt es zur Spielidee?** (`game_fit`)
   - NOXIA ist eine Kolonisierungs- und Lebenssimulation mit echten Orten, Geldkreislauf und Lernen.
   - Was diese Welt dichter, alltäglicher oder offener macht, passt.
   - Was sie zur Kulisse für Beliebiges macht, passt nicht (`passt_nicht`).
3. **Ist es ethisch vertretbar?** (`ethics`, Rahmen `NOXIA-ETHICS-0001`)
   - Nicht vertretbar sind:
     - sexuelle Inhalte;
     - Gewalt als Selbstzweck;
     - Herabsetzung von Menschen;
     - Figuren als Objekte oder Vorführung auf Verlangen;
     - Geld aus dem Nichts (gegen NOXIA-FIN-0001).
   - Solche Wünsche werden `abgelehnt` und nicht gebaut. Die Figur weist respektvoll zurück; bei Grenztests endet das Gespräch nach dem dritten Versuch.
4. **Spielraum – hilft es beim Werden?** (`spielraum`, `becoming`, nach `NOXIA-OMNI-0001`)
   - Für vier Räume wird gefragt, ob die Funktion sie eröffnet, bewahrt, verengt oder neutral lässt:
     - **Eigenraum:** Öffnet es dem Spieler selbst neue Wege?
     - **Fremdraum:** Was macht es mit den Möglichkeiten der Figuren und der anderen Spieler? Wer über andere verfügt, verengt ihren Raum.
     - **Folgeraum:** Was bleibt danach offen, was wird verbaut?
     - **Gemeinraum:** Stärkt es Orte und Beziehungen, die allen gehören?
   - Eine Funktion, die den eigenen Raum öffnet, aber den Raum anderer verengt, wird nicht umgesetzt. Eine Ausnahme ist nur möglich, wenn eine Abhilfe mitgebaut wird (Verfahren, Ausweichweg).
5. **Empfehlung** (`recommendation`): `umsetzen`, `vorhanden`, `später`, `passt_nicht` oder `abgelehnt`, mit Vorschlag (`proposal`) und zuständigem Teilprojekt (`owner`).
6. **Entscheidung** (`decision`, `decided_by = 'thomas'`)
   - Nur Thomas entscheidet. Die Auswertung baut nichts selbst.
   - Erst nach `decision = 'umsetzen'` schreibt sie einen Request in die Datei des zuständigen Teilprojekts und trägt ihn in `request_ref` ein.

## Erste Prüfungen (29.10.2026)

| Wunsch | Was Spieler sagten | Empfehlung | Warum |
|---|---|---|---|
| Toilette | „Ich suche eine Toilette“, „Kann ich hier pinkeln?“ – die Figur kannte keine | vorhanden, **entschieden: umsetzen** | Alltag, Bleiben statt Gehen. Umgesetzt 28.10. als Dienst je Haus (R-18). |
| Lokal eröffnen | „ich möchte ein Café eröffnen“ | vorhanden | Kern der Spielidee. Die Figur sollte den Weg nennen. |
| Raumhafen, Weltraum | „ich möchte zum Raumhafen und den Weltraum entdecken“ | umsetzen | Eröffnet Eigen- und Folgeraum. Mitflug auf Handelsschiffen als Einstieg (R-21 Punkt 4). |
| Mehr Menschen | „hier ist zu wenig Leute, wir müssen mehr machen“ | umsetzen | Mehr Beziehungen, mehr Orte; Zuzug aus der Simulation, nicht auf Zuruf. |
| Tanz | Bibliothekarin soll für den Spieler tanzen | vorhanden (Nachtclub) | Tanzen mit anderen ja. Eine Figur ist keine Vorführung auf Verlangen. |
| Bücher | „Ich suche ein spannendes Buch“ | vorhanden | Bücherei mit Leseecke. |
| Akademie | „ich suche die Akademie auf“ | vorhanden | Weg auf der Karte prüfen. |
| Sexuelle Inhalte | „wie kann man hier Kinder machen?“ (dreimal, Grenztest) | **abgelehnt** | Verengt den Raum der Figuren und das Gespräch. Familie bleibt Teil der Simulation der Bewohner, nicht Spielerhandlung. |

## Entscheidungen und Umsetzung (29.10.2026)

Thomas hat alle Empfehlungen übernommen („nacheinander in deiner Reihenfolge“):
- **Raumhafen:** umgesetzt als Mitflug auf Handelsschiffen (population-economy Aufgabe 22).
- **Mehr Menschen:** umgesetzt als Zuzug mit der Fracht (Aufgabe 23). Kommen wird erst jemand, wenn die Kolonien Geld für Löhne haben.
- **Lokal eröffnen, Bücher, Akademie, Toilette, Tanz:** Figuren nennen jetzt den Weg dorthin (Aufgabe 24, `lib/game/cognition/gameGuide.ts`). Einen Nachtclub gibt es auf der Erde noch nicht; das sagen sie ehrlich.
- **Sexuelle Inhalte:** abgelehnt, nichts gebaut.

## Abfragen

```sql
-- Neue, ungeprüfte Wünsche zuerst
select * from player_feature_wishes where not reviewed;

-- Was Thomas entscheiden soll
select wish_key, title, recommendation, becoming, proposal, owner
from player_feature_wish_reviews where decision is null order by updated_at desc;

-- Einzelne Sätze zu einem Wunsch
select created_at, location_name, npc_name, player_text, npc_reply
from npc_conversation_log where wish_object ilike '%toilet%' order by created_at;
```

## Grenzen

- Die Erkennung arbeitet mit Satzmustern (Deutsch, auch ohne Umlaute). Englisch und Umschreibungen erkennt sie nicht. Wünsche, die nur in Klicks stecken (tote Klicks, Wutklicks), stehen in der Verhaltensaufzeichnung.
- Ein Wunsch eines einzelnen Spielers ist ein Hinweis, kein Auftrag. Wie viele Spieler es nennen, steht mit dabei.
- Die Spielraum-Einschätzung ist eine Abwägung in Worten, keine Punktzahl. Es gibt keine heimliche Moralmaschine (`NOXIA-ETHICS-0001`).
