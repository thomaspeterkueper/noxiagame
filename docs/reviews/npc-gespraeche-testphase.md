# NPC-Gespräche in der Testphase – Protokoll und Auswertung

Stand: 27.10.2026. Wunsch Thomas (27.10.2026): Gespräche der Spieler mit Figuren speichern und auswerten; wer immer wieder Ähnliches fragt, bekommt einen Abbruchsatz.

## Was gespeichert wird

Tabelle `npc_conversation_log` (Migration `20261027200000_npc_conversation_log.sql`). Sie ist append-only und hat eine Zeile je Wortmeldung:

- Spieler, Figur (`npc_person_id`, sonst `npc_key`), Name und Rolle der Figur, Ort;
- Eingabe des Spielers (roh und normalisiert), Antwort der Figur;
- Ausgang:
  - `reply`: normale Antwort;
  - `repeat_hint`: Die Figur wurde angewiesen, knapp zu sein;
  - `breakoff`: Abbruch;
  - `dismissed`: Abweisung in der Abkühlzeit;
  - `error`: Fehler beim Sprachmodell, Zeitüberschreitung oder leere Antwort;
- Anzahl ähnlicher früherer Fragen, ausgelöste Aktion (Mitgehen, Ort besuchen, Credits), Antwortzeit des Modells.

Getrennt davon bleibt das Gesprächsgedächtnis der Figur (`npc_player_conversation_memory`). Es vergisst bewusst; das Protokoll vergisst nicht.

Nur der Server liest und schreibt das Protokoll: RLS ist an, es gibt keine Policies. Löscht ein Spieler sein Konto, werden seine Zeilen mitgelöscht.

**Vor einem öffentlichen Start [OFFEN]:** Hinweis an die Spieler, dass Gespräche gespeichert werden, und eine Aufbewahrungsfrist (Vorschlag: 90 Tage). Während der Testphase gilt beides noch nicht.

## Wiederholungen und Abbruch

Umgesetzt in `lib/game/cognition/conversationRepeat.ts` (Test: `npm run test:conversation-repeat`). Die Route `app/api/game/npc-conversation/route.ts` (1.2.0) nutzt es.

- **Was als ähnlich gilt:**
  - fast gleicher Wortlaut (Trigramme);
  - oder dasselbe Thema in anderen Worten (gemeinsame Wortstämme: „Ich möchte Tanz sehen“ ~ „Tanzt du für mich?“).
- **Was nicht zählt:** Bestellen, Grüßen und Danken. Wer dreimal Kaffee bestellt, fragt nicht im Kreis.
- **Zeitfenster:** Gezählt werden die letzten 30 Minuten mit derselben Figur, auch über ein geschlossenes und neu geöffnetes Gespräch hinweg.
- **Stufen:**
  - **2 ähnliche Fragen zuvor:** Die Figur wird knapp, sagt, dass sie das schon beantwortet hat, lässt leichte Ungeduld spüren und fragt nach etwas anderem.
  - **3 oder mehr:** Abbruch ohne Sprachmodell. Der erste Abbruch ist immer: „Ich habe keine Zeit, sie hier mit dir zu vertrödeln.“ Spätere Abbrüche wählen aus wenigen Varianten.
  - **Danach 10 Minuten Abkühlzeit:** Die Figur weist kurz ab („Später vielleicht. Jetzt nicht.“), auch wenn man sie neu anspricht.
- Die Antwort trägt `conversationEnded: true`. Die Gesprächsfenster werten das noch nicht aus. Die Abweisung kommt trotzdem, weil der Server sie durchsetzt.

## Auswerten

Drei Sichten (nur für den Server und den SQL-Editor):

```sql
-- Tagesübersicht: Umfang, Abbrüche, Fehler, Antwortlänge, Modellzeit
select * from npc_conversation_daily;

-- Häufigste Fragen (normalisiert, ohne Eröffnungen)
select * from npc_conversation_top_questions limit 30;

-- Gespräche, die sich im Kreis gedreht haben
select * from npc_conversation_loops;

-- Ein einzelnes Gespräch nachlesen
select created_at, outcome, player_text, npc_reply
from npc_conversation_log
where npc_name = 'Mira Brandt'
order by created_at;
```

## Erste Auswertung (27.10.2026)

Grundlage: 69 Wortwechsel von 4 Spielern mit 10 Figuren. Sie wurden einmalig aus dem Gesprächsgedächtnis der Figuren übernommen. Das ist nur, was die Figuren noch behalten hatten, nicht alles, was gesagt wurde.

**Was trägt:**

- Die Figuren bleiben in der Rolle und weisen Unpassendes ab.
- Bestellen, Begleiten („gehst du vor?“) und Vorstellen laufen flüssig.
- Die Einführung in die Welt (Akademie, Verwaltung, selbst bauen) kommt in passendem Ton.

**Was auffällt:**

1. **Endlosschleifen.** Zweimal hat ein Spieler dasselbe unpassende Anliegen vier- bis sechsmal neu formuliert. Die Figur hat jedes Mal geduldig neu abgelehnt, statt das Gespräch zu beenden. Genau dafür ist der Abbruch da. Gegen die beiden Verläufe getestet: Die Figur wird bei der 3. bzw. 4. Frage knapp und bricht beim nächsten gleichen Anliegen ab.
2. **Erdkarte mit Mars-Vokabular.** Ein Pfarrer im Sauerland ist „auf dem Weg zum Habitat“. Für die Erde sollte der Ortskontext keine Kolonie-Begriffe nahelegen.
3. **Ortswissen fehlt oder widerspricht.** Eine Figur in Sundern sagt, es gebe hier keine Straßen und kaum Gebäude. Eine andere fragt im selben Verlauf einmal nach dem Sauerland und einmal nach Herceg Novi. Vermutlich fehlen der Figur Ortsfakten oder der Ortsname kommt vom Wohnort der Figur. → Request an Gastronomie bzw. Erdkarte.
4. **Erfundene Bestellung.** „Wasser und die Vorspeise“ – eine Vorspeise hatte der Spieler nicht bestellt.
5. **Wegbeschreibung trotz Regel.** „Der Einstieg ist gleich vorne links“ verletzt die Regel gegen unbelegte Richtungsangaben.
6. **Fremdsprachen.** Auf Englisch oder Spanisch angesprochen, antworten die Figuren weiter auf Deutsch. Das passt zu NOXIA-LIVING-0014 (Übersetzung um 2100 nahezu perfekt), sollte aber bewusst so bleiben.

Die Punkte 2–5 liegen beim Gesprächsaufbau (Gastronomie) und beim Ortskontext der Erde (Erdkarte). Sie sind in `docs/workstreams/hospitality.md` als G-6 eingetragen.
