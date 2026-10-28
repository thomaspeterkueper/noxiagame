# NPC-Gespräche in der Testphase – Protokoll und Auswertung

Stand: 28.10.2026. Wunsch Thomas (27.10.2026): Gespräche der Spieler mit Figuren speichern und auswerten; wer immer wieder Ähnliches fragt, bekommt einen Abbruchsatz. Täglich auswerten – wer spricht, ob es vor allem Figuren untereinander sind, worüber zu realen Themen gesprochen wird und ob Gespräche das Handeln der Figuren beeinflussen.

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
- Anzahl ähnlicher früherer Fragen, ausgelöste Aktion (Mitgehen, Ort besuchen, Credits), Antwortzeit des Modells;
- Anliegen (`topic`, seit 28.10.2026) und die reale Meldung, die der Figur mitgegeben wurde (`headline`, `headline_source`).

Getrennt davon bleibt das Gesprächsgedächtnis der Figur (`npc_player_conversation_memory`). Es vergisst bewusst; das Protokoll vergisst nicht.

Nur der Server liest und schreibt das Protokoll: RLS ist an, es gibt keine Policies. Löscht ein Spieler sein Konto, werden seine Zeilen mitgelöscht.

**Aufbewahrung – entschieden (Thomas, 27.10.2026):** In der Alpha wird nichts gelöscht. Gerade längere Vergleiche zeigen, wie sich das System mit den Gesprächen entwickelt.

**Vor einem öffentlichen Start [OFFEN]:** Hinweis an die Spieler, dass Gespräche gespeichert werden, und eine Regel zur Aufbewahrung.

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
  - **Grenztests (seit 28.10.2026, Route 1.4.0):** Beleidigungen und sexuelle Anliegen (Anliegen `provocation`) zählen unabhängig vom Wortlaut. Beim dritten Grenztest seit dem letzten Abbruch bricht die Figur ab, ohne Sprachmodell, mit einem eigenen Satz („Das reicht. So rede ich nicht weiter mit dir.“). Grund: Am 27.10. wechselte ein Spieler die Worte („technische Frage“), damit griff der Wiederholungszähler nicht. Tanzen oder Nähe zählen nicht als Grenztest. Sie gelten als Beziehungswunsch und laufen über die Wiederholungserkennung.
  - **Danach 10 Minuten Abkühlzeit:** Die Figur weist kurz ab („Später vielleicht. Jetzt nicht.“), auch wenn man sie neu anspricht.
- Die Antwort trägt `conversationEnded: true` und `retryAfterMs` (wie lange die Figur noch abweist). Seit 28.10.2026 (Route 1.5.0) sperren alle Gesprächsfenster dann das Eingabefeld und zeigen „Gespräch beendet“, bis die Zeit abgelaufen ist (`app/components/useConversationEnd.ts`; Straße und Weltkarte, Bibliothek und Betriebe, Mond/Mars, Kolonie; Lokale hatten es schon). Der Server setzt die Abweisung weiterhin selbst durch.

## Auswerten

Sichten (nur für den Server und den SQL-Editor; Migrationen `20261027200000`, `20261028090000`):

```sql
-- Tagesübersicht: Umfang, Abbrüche, Fehler, Antwortlänge, Modellzeit
select * from npc_conversation_daily;

-- Häufigste Fragen (normalisiert, ohne Eröffnungen)
select * from npc_conversation_top_questions limit 30;

-- Gespräche, die sich im Kreis gedreht haben
select * from npc_conversation_loops;

-- Anliegen je Tag
select * from npc_conversation_topics_daily;

-- Gespräche mit realer Meldung
select * from npc_conversation_real_world;

-- Figuren untereinander je Tag und Ort
select * from npc_social_daily;

-- Was die Figur nach dem Gespräch tut
select * from npc_conversation_followups;

-- Tägliche Auswertungen im Verlauf
select day, player_turns, players, summary from npc_conversation_reviews order by day desc;

-- Ein einzelnes Gespräch nachlesen
select created_at, outcome, player_text, npc_reply
from npc_conversation_log
where npc_name = 'Mira Brandt'
order by created_at;
```

### Anliegen

`lib/game/cognition/conversationTopic.ts` (Test: `npm run test:conversation-topic`) ordnet jede Eingabe grob einem Anliegen zu. Die Einordnung läuft über Schlüsselwörter und dient nur zum Zählen, die genaue Lesart leistet die tägliche Durchsicht. Das Verhalten der Figur steuert sie nicht.

| Anliegen | Bedeutung |
|---|---|
| `opening` | Die Figur spricht von sich aus an |
| `greeting` | Grüßen, Danken, Verabschieden |
| `followup` | Kurze Fortsetzung ohne eigenes Thema („gerne“, „nachher“) |
| `order` | Bestellen, Bezahlen |
| `orientation` | Wo, Weg, Einrichtungen, „was kann ich hier“ |
| `work_money` | Arbeit, Geld, bauen, eröffnen, handeln |
| `travel` | Reisen, Raumhafen, Mond, Mars |
| `identity` | Name, wer bist du |
| `personal` | Leben der Figur: Arbeit, Feierabend, Träume, Erinnerung |
| `relationship` | Nähe, gemeinsam etwas tun, Freundschaft |
| `world_news` | Neuigkeiten, Gerüchte, reale Meldungen |
| `provocation` | Beleidigung, sexuelle Anliegen, Grenzen testen |
| `other` | Alles Übrige |

### Tägliche Auswertung

Eine geplante Aufgabe („NOXIA Gesprächsauswertung“) läuft jeden Morgen um 7:34 Uhr Berliner Zeit. Sie wertet den Vortag aus und schreibt eine Zeile in `npc_conversation_reviews`: Umfang, Anliegen, Zusammenfassung und Befunde. So bleibt der Verlauf über Wochen vergleichbar. Hat niemand mit einer Figur gesprochen, hält sie nur die Begegnungen unter Figuren fest.

### Was sich heute messen lässt – und was nicht

- **Figuren untereinander:** Begegnungen, Besuche, Konflikte und Hilfe sind als Ereignisse da (`population_events`), aber ohne Wortlaut. Am 27.10.2026 waren es etwa 48 Begegnungen, die meisten auf dem Mars, alle mit Ausgang „neutral“. Worüber Figuren miteinander sprechen, lässt sich erst auswerten, wenn diese Begegnungen Inhalt bekommen [OFFEN].
- **Reale Themen:** Die Meldung, die einer Figur mitgegeben wird, steht erst ab jetzt im Protokoll. In den übernommenen 69 Wortwechseln fehlt sie.
- **Wirkung auf das Handeln:** Ein Gespräch wirkt heute nur über die Aktionen im Gespräch selbst: Mitgehen (4×), Ort besuchen (1×), Credits. Die nächste eigene Entscheidung der Figur folgt ihren Bedürfnissen und weiß nichts vom Gespräch; nach Gesprächen war es meist `seek_social_contact` oder keine. Wenn Gespräche das Handeln beeinflussen sollen, wäre das ein eigener Schritt [OFFEN]. Zum Beispiel könnte eine Verabredung oder ein Hinweis aus dem Gespräch zu einer Absicht der Figur werden (Anschluss an die Absichten in `lib/game/population/actionIntent.ts`).

Anliegen in den 69 übernommenen Wortwechseln:
- Fortsetzungen 12, Sonstiges 11, Grüße 8;
- je 5 Eröffnung, Beziehung, Persönliches und Name;
- 4 Grenztests, 4 Orientierung;
- je 3 Neuigkeiten und Arbeit/Geld;
- je 2 Bestellung und Reisen.

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
