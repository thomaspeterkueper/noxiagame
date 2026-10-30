# ChronoTravel × Romanwerk – Kontinuitätsprüfung v0.1

Stand 30.10.2026. Werkstattakte, **keine abschließende Bewertung eines vollständigen Romans**.

## Verifizierte Textbasis
- Google Drive: `Die Miriam Chroniken - Band 1 - Kapitel 1 - Template.docx` (Dokument-ID `1i6IuedvPGFoK3iL-U2Q3EerHjBGZ20IV`), eine Master-/Template-Struktur, kein nachweislich endgültiger Romantext.
- Enthält Kapitel 2 **Die Harmonie von Istanbul**, Hagia Sophia, 168 Hz, Dr. Özkan, Malta→Istanbul-Frequenzspur, Symbol 06 und Kopplung an weitere Weltorte.
- Dieselbe Struktur plant Kapitel 5 **Die Schwelle von Shanghai** mit einer „Begegnung mit Yin Hua / Liu Yin“.
- Yin-Hua-Projektfassung und vollständige Myriam/Miriam-Endfassung sind gesondert zu identifizieren und gegenzuprüfen. Namensschreibweisen zunächst nicht harmonisieren.

## Prüffragen und Risiken

| ID | Frage | Status | Konsequenz |
| --- | --- | --- | --- |
| LIT-IST-001 | Wann (Jahr, Monat, Tag) spielt Miriams Istanbul-Besuch? | offen | Epoche und Bauzustand müssen zur Szene passen |
| LIT-IST-002 | Wo genau innerhalb der Hagia Sophia spielen Messungen, Begegnungen und Flucht? | offen | Erreichbarkeit, Blickachsen, Öffnungszeiten und Zugang |
| LIT-IST-003 | Beschreibt „168 Hz“ eine erzählte Anomalie, einen gemessenen Ton oder eine akustische Eigenfrequenz? | offen | Physikalische Aussage von Fiktion trennen |
| LIT-IST-004 | Ist Dr. Özkan in beiden Erzählsträngen dieselbe Person und stimmt seine Biografie? | offen | Figuren-/Zeitlinienkonsistenz |
| LIT-IST-005 | Die Masterstruktur nennt eine Begegnung von Miriam und Yin Hua in Shanghai: passen Alter und Lebensdaten? | **kritischer Prüfpunkt, kein nachgewiesener Fehler** | Ggf. Rückblende, Namensgleichheit, Archivaufnahme oder alternative Begegnung klären |
| LIT-IST-006 | Welche Wege verbindet die Erzählung zwischen Hagia Sophia, Galata und ggf. Delphi? | offen | Realistische Reisezeiten, Verkehr, Zugang und Tagesablauf prüfen |
| LIT-IST-007 | Erklärt der Text, wann das fiktionale Wissen über Frequenzen verfügbar wird? | offen | Keine Informationen aus späteren Kapiteln vorzeitig bekannt |

## Reproduzierbarer Spieltest

1. Szene, Zeitkoordinate und literarische Quelle laden.
2. Wegstrecken, zeitliche Abfolge und Zugang als überprüfbare Anforderungen modellieren.
3. Faktenlage nach `documented/inferred/speculative` markieren; Romanbehauptungen separat mit `fictional`.
4. Jede Inkonsistenz mit **exakter Textstelle** und möglicher Minimalrevision dokumentieren.
5. Erst nach Autorentscheidung Änderungen am Roman vornehmen. Keine automatische Umschreibung.

## Architektur

Ein `literaryJourney` darf eine ChronoTravel-Szene referenzieren, erzeugt aber keine kanonischen historischen Ereignisse, keine echte NPC-Population und keine persistierte Story-Simulation. Fortschritt und Testbefunde werden getrennt von historischen Quellen gehalten. Die Prüfung benötigt Textbelege, nicht nur die Interpretation eines Besuchers.
