# KG-Request: SSF-Modul-Lücken aus OTA-TEC-Validierungsdossiers

**Quelle:** OTA-TEC-0034 (Wasserextraktor), OTA-TEC-0038 (Erkundungsrover)
**Zweck:** Nach SSF-CORE.md §2.4 ("Narrative illustrieren, definieren nicht") beschreiben OTA-Dossiers Objekte; SSF-Module liefern die dahinterliegende Physik/Wissen. Jedes `TAUGHT_BY` in einem Dossier ist ein Anspruch auf ein SSF-Modul. Diese Liste konsolidiert alle offenen Ansprüche als KG-Requests.

---

## Aus OTA-TEC-0034 (Wasserextraktor)

| Referenzierter Modulname im Dossier | KG-Status | Anmerkung |
|---|---|---|
| "Wasserphasen im Vakuum" | `PHY-WASSER-PHASEN-0001` existiert, Vakuum-Kontext fehlt | Bestehendes Modul um Vakuum-Sublimationsfall erweitern, kein Neuanlage nötig |
| "Sublimation vs. Verdampfung" | `PHY-WASSER-SUBLIM-0001` existiert teilweise | Prüfen, ob bestehender Inhalt für Dossier-Zweck ausreicht oder Ergänzung nötig ist |
| "Marsregolith-Zusammensetzung" | fehlt komplett im KG | **Neuanlage erforderlich** |

## Aus OTA-TEC-0038 (Erkundungsrover)

| Referenzierter Modulname im Dossier | KG-Status | Anmerkung |
|---|---|---|
| "Mondstaub und Materialverschleiß" | fehlt komplett | **Neuanlage erforderlich** |
| "Life-Support-Grundlagen im Kleinformat" | fehlt komplett | **Neuanlage erforderlich** |
| "Navigation ohne GPS auf dem Mond" | fehlt komplett | **Neuanlage erforderlich** |
| "Notfallprotokolle bei Life-Support-Ausfall" | wird erst durch Nutzung relevant, noch nicht dringend | Für spätere Priorisierung vormerken |
| "Regolith-Kartierung und Ressourcenerkennung" | überschneidet sich mit `AST-MARS-REGOLITH-0001`, Mondspezifik fehlt | Prüfen, ob eigenständiges Mond-Modul nötig ist oder bestehendes Modul erweiterbar ist |

---

## Priorisierungsvorschlag

**Sofort (blockiert beide Dossiers als kanonisch nutzbar):**
1. `PHY-WASSER-PHASEN-0001` — Vakuum-Kontext ergänzen
2. Neuanlage: Marsregolith-Zusammensetzung
3. Neuanlage: Mondstaub und Materialverschleiß

**Zeitnah (für Kanonisierung der Dossiers empfohlen):**
4. `PHY-WASSER-SUBLIM-0001` — Prüfung/Ergänzung
5. Neuanlage: Life-Support-Grundlagen im Kleinformat
6. Neuanlage: Navigation ohne GPS auf dem Mond

**Später (wird erst bei Nutzung/Ausbau relevant):**
7. Neuanlage oder Erweiterung: Notfallprotokolle bei Life-Support-Ausfall
8. Prüfung: Regolith-Kartierung und Ressourcenerkennung (Mond-Spezifik vs. bestehendes `AST-MARS-REGOLITH-0001`)

---

## Struktureller Hinweis für künftige Dossiers

Dieser Report zeigt den produktiven Nebeneffekt des OTA-TEC-Schemas: Punkt 9 (Lernabhängigkeiten) jedes Dossiers erzeugt automatisch eine Liste von SSF-Anforderungen. Sobald mehrere Dossiers erstellt werden, sollte diese Liste fortlaufend als zentrales KG-Request-Dokument gepflegt werden (statt pro Dossier isoliert), damit Überschneidungen wie bei "Regolith-Kartierung" (Mars/Mond) frühzeitig sichtbar werden und nicht zu doppelten, leicht widersprüchlichen Modulen führen.
