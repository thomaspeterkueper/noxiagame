# Chronomap-Methode: einen Roman begehbar machen und dabei prüfen

Stand 06.11.2026. Abgeleitet aus der Arbeit an der Chronomap Dvaraka (`chronomap-dvaraka.md`, 02.–06.11.2026). Gilt für jeden Roman, der als Chronomap nachgespielt werden soll, z. B. „Die Kette vom Hexenteich“ und „Bayt al Mira“.

Die Methode hat zwei Ergebnisse:

1. eine **Chronomap**: ein begehbarer Ort zu einer Zeit, mit einer Gegenwartsschicht, in die der Spieler zurückkehrt;
2. eine **Prüfung des Romans**: Wer einen Ort auf eine Karte legt und eine Uhr daneben, findet Widersprüche, die beim Lesen nicht auffallen. Bei Dvaraka waren das vier (letztes Dach, 13. Same, Indras Titel, Stufen des Turms in der Werkstatt).

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Chronomap** | Der Ort zur Zeit des Romans, begehbar wie eine Virtual-Reality-Reise. |
| **Gegenwartsschicht** | Derselbe Ort in der Spielgegenwart (2086): Grabung, Ruine, Stadt von heute, Museum. Dorthin kehrt der Spieler zurück. |
| **Anker** | Was in der Gegenwart physisch sichtbar ist (Fund, Mauer, Gebäude). Anker binden die Karte. |
| **Etikett** | [R] in der Gegenwart belegt · [S] aus Ankern erschlossen · [F] frei, nur aus dem Buch. |
| **Kanon** | Die maßgebliche Fassung des Romans plus die Kanon-Entscheidungen des Autors. |
| **Eingriff** | Etwas, das der Spieler in der Chronomap tut und das die Handlung nicht bricht. |
| **Spur** | Wie die Gegenwart einen Eingriff zeigt – nie als neuer Fund, immer als Deutung, Lied, Brauch oder Reim. |

## Ablauf

### Schritt 0 – Quelle festlegen und ganz lesen

- Die **maßgebliche Fassung** bestimmen. Ältere Fassungen nur als Hintergrund, nie als Quelle für Orte oder Namen.
- Die Fassung **vollständig** lesen, bis zum letzten Epilog. Nicht mit einem Teil anfangen.
- Die Authoring-Quelle liegt in `buecherwelten` unter `works/<slug>/manuscript/`. Liegt das Manuskript noch anderswo (Claude-Projekt, Drive, ChatGPT-Verlauf), wird es zuerst dorthin übernommen; alle anderen Orte führen Kopien.

*Dvaraka-Lehre:* Der erste Entwurf beruhte auf 741 von 898 Zeilen und mischte Figuren aus der v2.0 (Krishnan, Arjun, Tonscherben-Lager) in die Neue Fassung. Fast jeder Fehler im ersten Entwurf kam daher.

### Schritt 1 – Inventar

Aus dem Text eine Liste ziehen, jede Zeile mit Kapitelstelle:

- **Orte** (auch beiläufige: „die Gasse hinter dem Wasserturm“, „der Platz hinter der Bäckergasse“)
- **Figuren** mit Aufenthaltsorten und Uhrzeiten
- **Gegenstände**, die überdauern könnten (Steine, Metall, Behälter, Schriften)
- **Zeitangaben** („fünfte Stunde vor Sonnenaufgang“, „zwei Stunden, vielleicht weniger“)
- **Räumliche Aussagen** (Sicht, Hörweite, Wege, Radien, Himmelsrichtungen)

Nichts erfinden, was der Text schon festlegt. Wo der Text schweigt, ist Freiheit – sie wird später mit [F] markiert.

### Schritt 2 – Widersprüche finden und entscheiden lassen

- Widersprüche mit **beiden Belegstellen** auflisten (z. B. 1.3 „das letzte Dach der Stadt“ gegen 1.4.2 „der innere Bezirk stand noch“).
- Zu jedem Widerspruch zwei bis vier **Lösungen** anbieten, eine empfehlen.
- **Der Autor entscheidet.** Nichts stillschweigend glätten.
- Entscheidungen festhalten in `buecherwelten/works/<slug>/editorial/kanon-entscheidungen-<datum>.md` und **im Manuskript umsetzen**.
- Danach alle Kopien angleichen und prüfen, dass sie gleich sind (Bytegröße oder Prüfsumme).

### Schritt 3 – Gegenwartsschicht und Anker

- Klären, was in der Gegenwart zu sehen ist: Grabung? Ruine? Lebende Stadt? Gar nichts?
- Bei realen Orten: Was gibt es dort wirklich (Ausgrabungen, Bauten)? Die Chronomap muss **dazu passen**, darf aber fiktiv sein.
- **Anker aus dem Buch ableiten.** Romane enthalten oft fertige Funde, die man nur erkennen muss: Bei Dvaraka die schiefe Südmole mit Reparaturphasen, zwei Ankertypen, das versenkte Osmium-Siegel, Dhruvas Kalksteinbehälter.
- Fundliste: Nummer (G1, G2 …), Beschreibung, Etikett, Buchstelle.
- Mindestens **ein Gegenstand, der nie gefunden wird** (Dvaraka: der 13. Same). Er hält das Geheimnis offen.

### Schritt 4 – Lageplan

- Eigene Koordinatenebene in Metern, Ursprung an einem Anker, x nach Osten, y nach Norden.
- Zonen nach dem Schicksal im Roman (Dvaraka: Fischerviertel und Westbezirk gehen am Bruchtag unter, die Felsstadt nicht).
- Tabelle: Ort, Lage, Größe, Zone, Etikett, Figuren und Buchstelle.
- **Raumprüfung:** Jede räumliche Aussage aus Schritt 1 gegen die Karte rechnen. Beispiele aus Dvaraka:
  - Alle Orte mit Ausfällen liegen im 300-m-Radius um die Werkstatt (Priyas Zählung).
  - Svaraṭi ist vom Platz hinter der Bäckergasse „zwei Straßen weiter“ hörbar.
  - Manu sieht durch die Lamellenläden Varunas Haus und Amritas Garten.
  - Aus Kasyapas Werkstatt sieht man die Wasserwand; das Wasser erreicht ihre Schwelle.
  - Varuna kommt auf dem Weg zum Stadtrat an der Bäckergasse vorbei.
- Was nicht passt, ist entweder ein Kartenfehler (Karte ändern) oder ein Romanfehler (zurück zu Schritt 2).

### Schritt 5 – Zeitplan

- Spieldauer festlegen und auf die Romanzeit abbilden (Dvaraka: 60 Minuten = dritte Nacht + Bruchtag + Bruch).
- **Fahrplan je Figur:** zu welcher Stunde an welchem Ort. Das reicht; keine Simulation.
- **Zeitprüfung:** Kann jede Figur ihre Wege in der angegebenen Zeit schaffen? Ist jemand an zwei Orten zugleich?

### Schritt 6 – Rolle des Spielers

Der Spieler braucht einen **Platz im Buch, der die Handlung nicht ändert**: eine Randfigur, die der Roman schon kennt oder zulässt (Dvaraka: ein Pilger in der Herberge, nach dem Vorbild Devens). Er ist weder Hauptfigur noch unsichtbar.

### Schritt 7 – Eingriffe und ihre Grenzen

- **Fest bleibt**, was den Roman trägt (Dvaraka: der Bruch, die Türme, alle Anker).
- **Veränderbar ist**, wer und was gerettet, gewarnt, gefunden wird.
- Eingriffe aus dem Text gewinnen: Wo verzögert sich etwas, wo geht eine Information verloren, wo fehlt eine Hand? (Dvaraka: Priyas Liste liegt bei „Punkt sieben von acht“.)
- Jede Reise beginnt am selben Einstieg; mehrfach spielbar.

### Schritt 8 – Spuren in der Gegenwart

Grundsatz: **Die Anker bleiben fest, die Deutung ist beweglich.**

- Vier Spurarten: **Lieder**, **Bräuche ohne Erklärung**, **Kinderreime und Sprichwörter**, **andere Lesart auf dem Fundzettel**.
- Tabelle: Eingriff → Merker → Spur → Fundort der Spur.
- Regeln: kein Punktestand; keine Spur beweist etwas; ohne Eingriff bleibt es still; ein Grabungsbuch (oder Chronik) im Stil des Romans hält fest, was sich je Reise verändert hat; der nie gefundene Gegenstand erzeugt nie eine Spur.

### Schritt 9 – Spurtexte schreiben

- Spurtexte (Strophen, Reime, Sprichwörter, Fundzettel-Zeilen) gehören zum Werk und liegen in `buecherwelten/works/<slug>/`; das Spiel liest sie nur.
- Sprache und Klang aus der Welt des Romans nehmen. Hat das Werk eine eigene Sprache (Dvaraka: Mishkenaz in der Urform R1), gilt deren Source of Truth (`mishkenaz.org`); erfundene Wörter werden als Vorschlag markiert, bis sie dort bestätigt sind.
- Entwürfe sind Entwürfe: Der Autor korrigiert, bevor etwas ins Spiel geht.

### Schritt 10 – Ablage

| Was | Wo |
| --- | --- |
| Manuskript (Authoring-Quelle) | `buecherwelten/works/<slug>/manuscript/` |
| Kanon-Entscheidungen | `buecherwelten/works/<slug>/editorial/` |
| Spurtexte | `buecherwelten/works/<slug>/` (z. B. `derived/chronomap-spuren.md`) |
| Chronomap-Konzept | `noxiagame/docs/workstreams/chronomap-<slug>.md` |
| Kopien | Claude-Projekt, Google Drive „Bücher“ – nach jeder Änderung angleichen |

## Prüfliste

Vor jedem Entwurf, der an den Autor geht:

- [ ] Maßgebliche Fassung benannt und **vollständig** gelesen
- [ ] Keine Figur, kein Ort, kein Name aus einer älteren Fassung
- [ ] Jeder Ort im Lageplan hat eine Buchstelle oder das Etikett [F]
- [ ] Keine erfundene Angabe widerspricht dem Text (Richtung, Nachbarschaft, Zeit)
- [ ] Alle räumlichen Aussagen gegen die Karte gerechnet
- [ ] Alle Figuren-Fahrpläne zeitlich möglich
- [ ] Widersprüche des Romans aufgelistet, nicht geglättet
- [ ] Jeder Anker [R] hat eine Buchstelle; mindestens ein Gegenstand bleibt unauffindbar
- [ ] Kein Eingriff kann einen Anker ändern
- [ ] Jede Spur ist unsicher formuliert
- [ ] Kanon-Entscheidungen im Manuskript umgesetzt; alle Kopien gleich
- [ ] Offene Fragen am Ende des Dokuments, nummeriert

## Fehler aus Dvaraka, die nicht wieder passieren sollen

| Fehler im ersten Entwurf | Ursache | Regel |
| --- | --- | --- |
| Nur 741 von 898 Zeilen gelesen | Teil statt Ganzes | Schritt 0: ganz lesen |
| Krishnan, Arjun, Tonscherben-Lager | Altfassung v2.0 gemischt | Schritt 0: eine Fassung |
| „Jaladharas tausend Brunnen“, „144 Minuten“ | nicht im Text | Schritt 1: nur Belegtes |
| Kasyapas Werkstatt im Osten | Text sagt Westbezirk, am Wasser | Schritt 4: Raumprüfung |
| Hügel mit „Sternenritual“ | Text: Ritual in der Werkstatt, „kein Stern“ | Schritt 1: Belegstelle prüfen |
| Varunas Turm „gefallen“ | Text: einer der drei, die standen | Schritt 1: Belegstelle prüfen |

## Anwendung auf die nächsten Romane

### Die Kette vom Hexenteich

- In `buecherwelten` als `BW-WORK-KETTE-HEXENTEICH` erfasst (Status *intake*). Das Manuskript liegt dort **noch nicht**; belegt ist es in einem ChatGPT-Verlauf bis Kapitel 27 („Die Hüter der Schwellen“), nicht als Master übernommen.
- Vor Schritt 0 nötig: maßgebliche Fassung von Thomas, Übernahme nach `works/kette-vom-hexenteich/manuscript/`.
- Fragen an Thomas: Wo und wann spielt es? Gibt es den Hexenteich wirklich? Was ist in der Gegenwart dort zu sehen? Liegt das Werk im NOXIA-Universum (laut `work.yaml`: `universe_canon: noxia-universe`)?

### Bayt al Mira

- In `buecherwelten` **nicht gefunden** (Stand 06.11.2026), auch nicht im Katalog.
- Vor Schritt 0 nötig: Wo liegt der Text? Dann Werk anlegen und Manuskript übernehmen.
- Fragen an Thomas: Ort und Zeit, realer oder fiktiver Ort, Gegenwartsschicht.

## Vorlage für ein neues Chronomap-Dokument

```markdown
# Chronomap <Titel> – Entwurf (<Datum>)
Grundlage: <Fassung>, Authoring-Quelle buecherwelten/works/<slug>/manuscript/<datei>, vollständig gelesen am <Datum>.

## 0. Kanon-Entscheidungen
## 1. Zwei Schichten, ein Ort        (Chronomap / Gegenwartsschicht)
## 2. Anker                          (G1 … Gn, Etikett, Buchstelle; ein unauffindbarer Gegenstand)
## 3. Lageplan                       (Zonen, Tabelle, Raumprüfung)
## 4. Erlebnis                       (Einstieg, Spielerrolle, Zeitplan, Fahrpläne, Eingriffe, Ende)
## 5. Spuren in der Gegenwart        (Eingriff → Merker → Spur → Fundort; Regeln)
## 6. Widersprüche im Roman          (Belegstellen, Lösungen, Empfehlung)
## 7. Offene Punkte für Thomas
```
