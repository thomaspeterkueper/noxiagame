# NOXIA-CORE — Kontextabhängige Fähigkeiten v0.1

Status: isolierter Prototyp, keine Produktionsintegration.

Objekte besitzen messbare Ressourcen und Beziehungen. Handlungsoptionen
(Affordances) entstehen aus **Objektzustand + Kontext + Infrastruktur**;
nicht allein aus einem starren Typ- oder Gebäude-Label.

Beispiel Elektro-Lkw: Transport, Speicherung und bedingte Netzversorgung.
Beispiel MiniNode: Sensorik und Rechenleistung.

Der Resolver in `lib/game/capabilities/affordances.ts` ist rein,
deterministisch, ohne Seiteneffekte und konservativ bei fehlenden Daten.
Er führt weder Handlungen noch Buchungen aus. Rechte, Besitz, Verträge,
Energieerhaltung, Tick-Scheduling, Preise, NPC-Entscheidungen und Persistenz
bleiben in den bestehenden zuständigen Domänen.

Nächste Stufe: bestehende Domänenadapter identifizieren, read-only
Capabilities für ausgewählte Objekte anbieten, atomare Ausführung
separat über bestehende Core-Transaktionen autorisieren und testen.
Keine automatische Übernahme neuer naturwissenschaftlicher Parameter
ohne EZI- und Provenienzprüfung.

Forschungskontext: Timpf & Klügl, GIScience 2023,
doi:10.4230/LIPIcs.GIScience.2023.72;
Chen et al., ACL 2026, doi:10.18653/v1/2026.acl-long.1109.
