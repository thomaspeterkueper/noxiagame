# NOXIA-ROBOTICS-0001 — PhoneBot und Smartphone-basierte MiniNode-Robotik
Version 1.0 · 2026-10-12 · Status: Forschungsreferenz / Implementierung vorgeschlagen

## Zweck und Einordnung
Technische Evidenz für einen kostengünstigen realen MiniNode-Robotik-Prototyp sowie einen physikalisch plausiblen Technologiepfad im Spiel **noχ¹ᐃ**. Dieses Dokument ist **keine Gameplay-Implementierung** und ändert weder Kosten noch Balancing oder Persistenz. Kanonische OTA-/KG-Objekte werden nicht behauptet oder neu signiert.

## Primärbefund und Grenzen
Hou, R.; Wang, Q.; Koh, D.; Hong, D. W. (2026): *PhoneBot: A Low-Cost Open Humanoid Robot Platform Reusing Smartphones*, arXiv:2610.08737 (eingereicht 06.10.2026), https://arxiv.org/abs/2610.08737
Projekt: https://phonebot.dev/
Sekundärbericht (09.10.2026): https://www.forschung-und-wissen.de/nachrichten/technik/altes-smartphone-steuert-einen-roboter-auf-zwei-beinen-133714153
Vorläufer: *OpenBot: Turning Smartphones into Robots*, arXiv:2008.10631, https://arxiv.org/abs/2008.10631

- Offene Forschungsplattform: Smartphone als IMU, Kamera, Netzwerk, Rechen- und Interaktionseinheit; 13 kostengünstige Aktuatoren am Unterkörper.
- Im berichteten Prototyp ca. 48 cm Höhe, 1,8 kg Gewicht inklusive Smartphone, etwa 400 USD zusätzliche Hardware (Autorenschätzung, ohne Smartphone, keine Produktpreisgarantie).
- Gehen, bildbasierte Personenfolge und Interaktion vorgeführt; dokumentierte Laufbedingungen begrenzt, u. a. ebener Untergrund. Kein Nachweis alltagstauglicher Robustheit.
- Bewegungsbefehle gehen über WLAN an zusätzliche Motorsteuerung. Telefon ersetzt nicht Echtzeitsicherheit und nicht alle Controller.
- Ein Smartphone aus 2017 bewältigte Basisaufgaben, aber bestimmte Kartierungsfunktionen fehlten wegen Software-/Dienstekompatibilität. **Rechenleistung und Softwareverfügbarkeit getrennt prüfen.**
- Stand 12.10.2026: arXiv-Preprint; keine unabhängige Begutachtung aus der Primärveröffentlichung ableitbar.

## MiniNodes: vorgeschlagene Schnittstellenarchitektur
```text
Alt-Smartphone (Kamera, IMU, optional On-device ML)
              | WLAN / versioniertes Nachrichtenprotokoll
              v
MiniNode-Koordinator (Ziele, Wahrnehmung, Kartierung, Zeitstempel)
              | begrenzte Sollwerte + Heartbeats
              v
Lokaler sicherheitskritischer Controller (Watchdog, Zustandsautomat)
              |              ^
              v              | Encoder / Strom / Kontakt
            Aktuatoren --- Sensorrückführung
              ^
              |
Optionales Schwarmnetz (Aufgaben, Karten, Kooperation; niemals unmittelbar balancekritisch)
```
Grundregel: **Balance, Grenzwerte und sichere Abschaltung lokal**. Mobilfunk/WLAN und LLM-Ausgaben dürfen niemals im harten Motorregelkreis Voraussetzung sein. Bei Kommunikationsausfall sicherer Zustand gemäß Risikoanalyse (nicht pauschal „Motoren aus“, falls dadurch Sturz ausgelöst wird). Trennung von Wahrnehmungs-, Planungs- und Servo-Zeitskalen; lokal monoton timestampen. Sensorherkunft, Firmwarestand, Kalibrierung und Testumgebung protokollieren (Integrity of Observation).

## Reales MVP (geplante Arbeit, nicht gebaut)
P0 — Replikationscheck: öffentliches CAD, Code, Lizenz, Stückliste, Mobiltelefon-Kompatibilität und Sicherheitsdokumentation prüfen; Kostenstand mit Marktpreisen dokumentieren.
P1 — Tischversuch ohne Beine: Android-Kamera/IMU mit Zeitstempeln über definierte API an einen Mikrocontroller; Ende-zu-Ende-Latenz, Jitter, Paketverluste, Wärmelast messen.
P2 — Gesicherter einbeiniger bzw. hängender Prüfstand: Motorgrenzen, Strombegrenzung, Watchdog, Not-Aus, Spannungsverlust, Wiederanlauf testen.
P3 — Fallback-/Bewegungstest auf ebenem Boden mit Absturzsicherung; erst nach Freigabe von P2.
P4 — Zwei Knoten teilen eine Karte / Aufgabe; keine netzabhängige dynamische Stabilisierung.
Nichtfunktionale Kriterien: reproduzierbare Logs, deterministische lokale Sicherheitsreaktion, dokumentierte Ausfallmodi, Messungen für CPU-/Akkualterung, thermische Drosselung und Update-Abhängigkeiten.

## noχ¹ᐃ: vorgeschlagener Simulationspfad
Robotischer Körper als persistierte Entität (nicht bloß NPC-Sprite): Masse, Geometrie, Aktuatoren, Batterieträger, Wirkungsgrade, Sensorreichweite/-fehler, Latenzen, Verschleiß, Wartung, Software-/Firmwarefähigkeit und Kommunikationszustand. Weltzustand bleibt Single Source of Truth; Karten/Walkable-Sicht projizieren diesen. Lokale Kontrollschleife hochfrequent approximieren, strategische Simulation niedriger frequent, ohne fiktive rückwirkende Energieerzeugung. Robotik-Capability kontextabhängig im gemeinsamen Dashboard; Erde/Sauerland als mögliche Produktionsgeschichte, später Mars/Orbitalanlagen nur bei plausibler Versorgung und Technikentwicklung.

**Keine vorschnellen Übernahmen:** 400 USD ist keine allgemeine Spielkostenbasis; Smartphones sind keine universell zuverlässigen Echtzeitcontroller; „Open Source“ erfordert gesonderte Lizenzprüfung; Recycling-Nutzen erfordert Lebenszyklusvergleich. Die Verwendung als neue NOXIA-Mechanik braucht eigene ADR, Datenmodell, Tests und fachliche Freigabe.

## Prüfkriterien / Verknüpfungen
- Evidenzklasse: primär Preprint, Demonstrationen, sekundärer Technikartikel.
- Wiederprüfung: spätestens 12.10.2027, früher bei Peer Review, neuen Messreihen, geänderter Lizenz, Hardware-Revision oder unabhängiger Replikation.
- Querverweise: MiniNodes (real); Robotik Sauerland; noχ¹ᐃ physische Agenten, NPC-Sensorik/Körper, Energiesystem, Fahrzeug-Capabilities; Timescale Engineering und Integrity of Observation.
- Nächster Entscheid: Build-or-buy-Testaufbau und Ressourcenrahmen bestätigen, bevor Schaltpläne/Code oder Spielwerte verbindlich werden.
