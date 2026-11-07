# NOXIA-NPC-PHYS-0001 — Situative physiologische Modulation

Status: erster isolierter, reiner Modellbaustein; nicht in Runtime integriert
Datum: 2026-10-29

## Fachmodell
`personAffect.ts` ist bereits die maßgebliche Affektschicht, `population/decision.ts` die Handlungswahl. Die neue Datei `personPhysiology.ts` modelliert **keine** echten Hormonkonzentrationen und beansprucht keine medizinische Validität. Sie berechnet lediglich begrenzte, reproduzierbare Handlungstendenzen aus situativem Stress, Müdigkeit, sozialem Sicherheitsgefühl und Neuheit sowie individuell unterschiedlichen Sensitivitäten.

Ein Hormonsystem als echte endokrine Simulation braucht später eigene Evidenz, Zeitskalen, Rückkopplungen, Messannahmen und Falsifikation; einzelne Hormone dürfen nicht als eindeutige Ursache komplexer Verhaltensweisen wie Liebe, Aggression oder Vertrauen etikettiert werden.

## Figurenwissen und Evidenz
- Literatur: Figurenkonzeption, innere Widersprüche, langfristige Ziele und Erzählperspektiven als **Designreferenz**, nicht als empirischer Verhaltensbeweis.
- Psychologie/Verhaltenswissenschaft: überprüfbare Hypothesen zu Persönlichkeit, Situation, Bewertung, Motivation, Lernen und Beziehung; Grenzen der Übertragbarkeit dokumentieren.
- NPC-Biografie, Werte, Bedürfnisse, Beziehungen und Erinnerungen bleiben personenbezogen, persistent und kausal erklärbar.
- Erlebter Körperzustand wirkt als kleiner Modifikator zulässiger Handlungen und wird nicht aus frei generiertem Dialog zurückgeschrieben.

## Nächste Integrationsschritte
1. Bestehende Bedarfs-/Gesundheits-/Schlaf-/Sozialdaten auf kanonische Eingabequellen für die vier Modulatoren prüfen.
2. Modifikatoren **einmalig** in die zentrale Handlungswahl mit explizitem Decision Trace einfügen, ohne Affekt doppelt zu zählen. Bei fehlenden Daten 0-Bias.
3. Einbindung in persistente Zustandsübergänge nur nach Tests; keine parallelen Hormontabellen.
4. Gleiche Situation, unterschiedliche Figurenprofile testen; gleiche Figur unter verschiedenen Bedingungen; Gruppenkonflikt, Nähe, Schutz und historische Chronimap-Szenen.
5. Menschliche Rückmeldungen als freigegebene Auswertungssignale nutzen, nicht ungeprüft für Persönlichkeitsänderungen oder automatische Forschungsaussagen.
6. Sensitivitäten an Beobachtungen validieren und Grenzen samt Modellversion publizieren. Historische Rekonstruktionen strikt von historischen Belegen unterscheiden.

## Invarianten
- Keine ungemessenen Hormonwerte als wissenschaftliche Tatsachen ausgeben.
- Keine automatische Veränderung von Persönlichkeit durch einen einzelnen Spielerkontakt.
- Kein direkter Schreibzugriff auf Weltzustand, kein LLM als physiologische Autorität.
- Alle Resultate deterministisch und begrenzt (±0,35), Entscheidungssperren bleiben wirksam.
