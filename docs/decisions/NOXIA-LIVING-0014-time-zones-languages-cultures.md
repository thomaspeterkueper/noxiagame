# NOXIA-LIVING-0014 – Zeitzonen, Sprachen und Kulturen

Status: accepted (Richtung), Ausgestaltung proposed
Date: 2026-10-13
Bezug: `NOXIA-LIVING-appearance-clothing-heritage-animals.md` (Herkunft als biografische Angabe), NOXIA-LIVING-0012 (zwei Uhren), Request R-4 / G-2 (Startcafé nach Ortszeit), NOXIA-LIVING-0001

## Entscheidung (Thomas, 13.10.2026)

Zeitzonen sind wichtig, genauso Sprach- und Kulturvielfalt. Die Welt ist nicht deutschsprachig mit Kulisse: In China spricht man häufiger Mandarin als Deutsch, in Sundern Deutsch, und so weiter.

## Bestand

- Herkunft (`cultural_heritage`) ist als biografische Angabe reserviert. Grundsatz: Sie darf Sprache, Familiengeschichte, Küche, Religion und Namen beeinflussen, wird aber **nie** aus Aussehen, Hautfarbe oder Namen abgeleitet.
- Sprachen gibt es im Modell nicht. Figuren sprechen im Gespräch die Sprache der Oberfläche.
- Zeitzonen gibt es nicht. Lokale öffnen nach Koloniezeit (ein Tick ist eine Stunde).

## Ausgestaltung (Vorschlag)

### 1. Zeitzonen

- **Spieler:** `profiles.time_zone` (IANA-Name, z. B. `Europe/Berlin`), beim Anmelden aus dem Browser übernommen. Erste Anwendung: Startcafé 23–6 Uhr geschlossen nach Ortszeit des Spielers (G-2).
- **Orte auf der Erde:** jede Erd-Location bekommt ihre Zeitzone (`locations.time_zone`). Ein Ort in Sundern hat `Europe/Berlin`, einer in Shanghai `Asia/Shanghai`. Bewohner dort leben nach Ortszeit: Wer in Shanghai um 8 Uhr frühstückt, tut das 6 bzw. 7 Stunden vor Sundern.
- **Kolonien und Stationen:** eigene Koloniezeit. Offen (Kanonfrage): Läuft der Mars nach Sol (24 h 39 min) wie heute schon in der Marsforschung üblich, oder nach Erdstunden?
- Grundsatz bleibt: Bewohner leben nach Weltzeit ihres Ortes, Spielerbedürfnisse nach aktiver Spielzeit (LIVING-0012), Spielertüren wie das Startcafé nach der Ortszeit des Spielers.

### 2. Sprachen

- **Personen:** `person_languages(person_id, language_code, proficiency, is_native)`, Sprachcode nach BCP 47 (`de`, `zh` bzw. `cmn`, `yue`, `en`, `ar` …), Kenntnis 0–1. Eine Person kann mehrere Sprachen sprechen, unterschiedlich gut.
- **Herkunft vor Ort:** Die Muttersprache folgt aus Biografie und Herkunft, nicht aus dem Aufenthaltsort. Wer in Sundern lebt, aber in Wuhan aufgewachsen ist, spricht Mandarin als Muttersprache und Deutsch je nach Lebensjahren dort.
- **Orte:** `location_languages(location_id, language_code, share)` – Verteilung der Sprachen am Ort als Ausgangswert für neu entstehende Bewohner. Auf der Erde aus realen Daten (Sundern: Deutsch, dazu Türkisch, Polnisch, Englisch …; Shanghai: Mandarin, Shanghainesisch, Englisch …). Neue Bewohner werden aus dieser Verteilung gewürfelt, deterministisch wie bisher.
- **Kolonien:** Mischung nach Herkunft der Siedler. Offen (Kanonfrage): Gibt es eine Verkehrssprache auf Mars und Mond, und welche?
- **Spieler:** Sprache(n) des Spielers – zunächst die Sprache der Oberfläche, später ggf. erlernbar (Anschluss an die Akademie und SSF).

### 3. Gespräche

- Eine Figur spricht in ihrer Sprache, nicht automatisch in der des Spielers. Teilen beide eine Sprache, sprechen sie die, die beide am besten können.
- Gibt es keine gemeinsame Sprache: Offen (Kanonfrage) – um 2100 ist Echtzeit-Übersetzung wahrscheinlich Alltag. Vorschlag: Übersetzung gibt es, aber man merkt sie – Zeitverzug, Höflichkeitsformen und Witze gehen verloren, Vertrauen wächst langsamer (Anschluss an NOXIA-LIVING-0008). Wer die Sprache wirklich spricht, hat einen Vorteil, ohne dass ohne sie nichts geht.
- Die Gesprächs-KI erhält Sprache und Kenntnisstand der Figur als Fakten; sie erfindet keine Sprachkenntnisse.
- Die Oberfläche zeigt die Rede in der Sprache der Figur oder übersetzt mit Kennzeichnung – zu entscheiden mit der Gastronomie, die die Gesprächsoberfläche führt.

### 4. Kultur

- Herkunft und Ort prägen Küche (Karte im Lokal: in Shanghai andere Posten als in Sundern), Feiertage, Höflichkeitsformen, Namen und Tagesrhythmus (Essenszeiten, Mittagsruhe).
- Grundsatz gegen Klischees: Kultur ist Biografie und Gewohnheit einzelner Personen, kein Merkmal einer Gruppe. Zwei Personen gleicher Herkunft können sich darin völlig unterscheiden.
- Schwärme der Kantinenroboter (LIVING-0013) sprechen die Sprachen ihres Ortes; ein Automat zeigt die Karte mehrsprachig.

## Reihenfolge

1. `profiles.time_zone` und Startcafé nach Ortszeit (G-2).
2. `locations.time_zone` für Erdorte; Tagesrhythmus der Bewohner nach Ortszeit.
3. `person_languages` und `location_languages`, Sprachen für bestehende Bewohner aus Herkunft bzw. Ort einmalig setzen.
4. Gespräche mit Sprache der Figur und Übersetzung.
5. Kultur: Karten und Tagesrhythmus je Ort.

## Offene Fragen (Kanon)

1. Koloniezeit auf dem Mars: Sol oder Erdstunden?
2. Verkehrssprache in Kolonien und auf Stationen – gibt es eine, und welche?
3. Übersetzung um 2100: selbstverständlich und spürbar unvollkommen (Vorschlag), perfekt, oder knapp und teuer?
