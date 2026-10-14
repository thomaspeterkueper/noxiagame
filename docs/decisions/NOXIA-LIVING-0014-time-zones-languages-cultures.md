# NOXIA-LIVING-0014 – Zeitzonen, Sprachen und Kulturen

Status: accepted (Richtung und Kanon), Umsetzung proposed
Date: 2026-10-13
Bezug: `NOXIA-LIVING-appearance-clothing-heritage-animals.md` (Herkunft als biografische Angabe), NOXIA-LIVING-0012 (zwei Uhren), Request R-4 / G-2 (Startcafé nach Ortszeit), NOXIA-LIVING-0001

## Entscheidung (Thomas, 13.10.2026)

Zeitzonen sind wichtig, genauso Sprach- und Kulturvielfalt. Die Welt ist nicht deutschsprachig mit Kulisse: In China spricht man häufiger Mandarin als Deutsch, in Sundern Deutsch, und so weiter.

Kanon (Thomas, 14.10.2026):

- **Um 2100 ist Übersetzung nahezu perfekt.**
- **Auf dem Mars gilt Sol-Zeit.**
- **Auf dem Mars entsteht eine eigenständigere Sprache** – ein Mischmasch aus der Sprachvielfalt der Siedler, je nach Umgebung und Bevölkerung. Vorbild sind die Galut-Schichten von Mishkenaz aus dem Zyklus *Das Gefälle*: Wie dort aus den Schichten der Diaspora eine eigene Sprache wächst, wächst auf dem Mars aus vielen Herkunftssprachen eine Kolonialsprache.

## Bestand

- Herkunft (`cultural_heritage`) ist als biografische Angabe reserviert. Grundsatz: Sie darf Sprache, Familiengeschichte, Küche, Religion und Namen beeinflussen, wird aber **nie** aus Aussehen, Hautfarbe oder Namen abgeleitet.
- Sprachen gibt es im Modell nicht. Figuren sprechen im Gespräch die Sprache der Oberfläche.
- Zeitzonen gibt es nicht. Lokale öffnen nach Koloniezeit (ein Tick ist eine Stunde).

## Ausgestaltung (Vorschlag)

### 1. Zeitzonen

- **Spieler:** `profiles.time_zone` (IANA-Name, z. B. `Europe/Berlin`), beim Anmelden aus dem Browser übernommen. Erste Anwendung: Startcafé 23–6 Uhr geschlossen nach Ortszeit des Spielers (G-2).
- **Orte auf der Erde:** jede Erd-Location bekommt ihre Zeitzone (`locations.time_zone`). Ein Ort in Sundern hat `Europe/Berlin`, einer in Shanghai `Asia/Shanghai`. Bewohner dort leben nach Ortszeit: Wer in Shanghai um 8 Uhr frühstückt, tut das 6 bzw. 7 Stunden vor Sundern.
- **Mars: Sol-Zeit (Kanon).** Ein Sol dauert 24 h 39 min 35 s. Der Tag der Bewohner richtet sich nach dem Licht – Schichtpläne, Gewächshäuser, Solarstrom und Schlaf folgen der Sonne, nicht einer Erduhr. So arbeiten schon heute die Teams der Mars-Rover, die „auf Marszeit“ leben.
  - Folge im Spiel: Gegenüber der Erde verschiebt sich der Marstag jeden Tag um knapp 40 Minuten. Wer auf dem Mars frühstückt, tut das nach gut fünf Wochen wieder zur selben Erdzeit. Verabredungen zwischen Erde und Mars verschieben sich spürbar – ein Stück Wirklichkeit, das man nicht erklären muss.
  - Technisch: Der Takt bleibt eine Erdstunde je Tick (ein Cron für alle). Die Tageszeit auf dem Mars wird aus dem Tick abgeleitet, nicht gezählt: `marsStunde = ((tick × 3600 s) / 88 775 s × 24) mod 24`, mit Bezug auf einen festen Nullpunkt (z. B. Mars Sol Date). `circadian.ts` rechnet heute mit `DAY_TICKS = 24` für alle Orte und bekommt dafür eine Ortsuhr.
  - Phobos und Deimos folgen dem Mars (Sol). Mond und Stationen: offen – Vorschlag Erdzeit UTC, weil der Mondtag 29,5 Erdtage dauert und keinen Alltag trägt.
- Grundsatz bleibt: Bewohner leben nach Weltzeit ihres Ortes, Spielerbedürfnisse nach aktiver Spielzeit (LIVING-0012), Spielertüren wie das Startcafé nach der Ortszeit des Spielers.

### 2. Sprachen

- **Personen:** `person_languages(person_id, language_code, proficiency, is_native)`, Sprachcode nach BCP 47 (`de`, `zh` bzw. `cmn`, `yue`, `en`, `ar` …), Kenntnis 0–1. Eine Person kann mehrere Sprachen sprechen, unterschiedlich gut.
- **Herkunft vor Ort:** Die Muttersprache folgt aus Biografie und Herkunft, nicht aus dem Aufenthaltsort. Wer in Sundern lebt, aber in Wuhan aufgewachsen ist, spricht Mandarin als Muttersprache und Deutsch je nach Lebensjahren dort.
- **Orte:** `location_languages(location_id, language_code, share)` – Verteilung der Sprachen am Ort als Ausgangswert für neu entstehende Bewohner. Auf der Erde aus realen Daten (Sundern: Deutsch, dazu Türkisch, Polnisch, Englisch …; Shanghai: Mandarin, Shanghainesisch, Englisch …). Neue Bewohner werden aus dieser Verteilung gewürfelt, deterministisch wie bisher.
- **Kolonien – eigene Kolonialsprache (Kanon):** Auf dem Mars wächst aus den Herkunftssprachen der Siedler eine eigenständigere Sprache, je nach Ort und Bevölkerung verschieden – Tharsis klingt anders als eine Station mit anderer Herkunftsmischung. Vorbild: die Galut-Schichten von Mishkenaz.
  - Im Modell: eigener Sprachcode je Kolonialsprache (privater BCP-47-Bereich, z. B. `x-mars-tharsis`), mit einer Liste ihrer Spendersprachen und Anteile, abgeleitet aus der tatsächlichen Herkunft der Bewohner am Ort.
  - In Mars Geborene sprechen sie als Muttersprache, Zugezogene lernen sie mit den Jahren dazu (Kenntnis wächst mit der Zeit am Ort).
  - Eigene Wörter für Dinge, die es nur dort gibt (Staubsturm, Druckschleuse, Sol, Regolith, Notration), entstehen zuerst. Name der Sprache: Kanonfrage.
- **Spieler:** Sprache(n) des Spielers – zunächst die Sprache der Oberfläche, später ggf. erlernbar (Anschluss an die Akademie und SSF).

### 3. Gespräche

- Eine Figur spricht in ihrer Sprache, nicht automatisch in der des Spielers. Teilen beide eine Sprache, sprechen sie die, die beide am besten können.
- **Übersetzung ist nahezu perfekt (Kanon).** Sprache ist deshalb kein Hindernis, sondern **Zugehörigkeit**: Man versteht jeden, aber man hört, wer wie spricht. Wer jemanden in seiner eigenen Sprache anspricht – oder in der Kolonialsprache des Ortes –, zeigt, dass er dazugehört oder sich Mühe gibt. Das wirkt auf Vertrauen und Zuneigung (Anschluss an NOXIA-LIVING-0008), nicht auf das Verstehen.
- Was sich nicht übersetzen lässt, sind die eigenen Wörter der Kolonialsprache: Die Übersetzung gibt sie wieder, aber Fremde erkennt man daran, dass sie sie nicht selbst benutzen.
- Die Gesprächs-KI erhält Sprache und Kenntnisstand der Figur als Fakten; sie erfindet keine Sprachkenntnisse.
- Die Oberfläche zeigt die Rede übersetzt in der Sprache des Spielers, mit Kennzeichnung der Originalsprache (z. B. „auf Mandarin“); einzelne Wörter der Kolonialsprache bleiben stehen. Feinheiten mit der Gastronomie, die die Gesprächsoberfläche führt.

### 4. Kultur

- Herkunft und Ort prägen Küche (Karte im Lokal: in Shanghai andere Posten als in Sundern), Feiertage, Höflichkeitsformen, Namen und Tagesrhythmus (Essenszeiten, Mittagsruhe).
- Grundsatz gegen Klischees: Kultur ist Biografie und Gewohnheit einzelner Personen, kein Merkmal einer Gruppe. Zwei Personen gleicher Herkunft können sich darin völlig unterscheiden.
- Schwärme der Kantinenroboter (LIVING-0013) sprechen die Sprachen ihres Ortes; ein Automat zeigt die Karte mehrsprachig.

## Reihenfolge

1. `profiles.time_zone` und Startcafé nach Ortszeit (G-2).
2. Ortsuhren: `locations.time_zone` für Erdorte, Sol-Zeit für Mars, Phobos und Deimos; Tagesrhythmus der Bewohner nach Ortsuhr (`circadian.ts`).
3. `person_languages` und `location_languages`, Sprachen für bestehende Bewohner aus Herkunft bzw. Ort einmalig setzen.
4. Gespräche mit Sprache der Figur und Übersetzung.
5. Kultur: Karten und Tagesrhythmus je Ort.

## Offene Fragen (Kanon)

Entschieden am 14.10.2026: Übersetzung nahezu perfekt; Mars nach Sol; eigene Kolonialsprache aus der Sprachvielfalt der Siedler.

1. Name der Marssprache bzw. der Kolonialsprachen – gibt es ihn schon im Buchkanon?
2. Mond und Stationen: Erdzeit UTC (Vorschlag) oder eine eigene Stationszeit?
3. Kolonialsprache auch auf dem Mond und den Stationen, oder nur auf dem Mars, wo Menschen über Generationen leben?
