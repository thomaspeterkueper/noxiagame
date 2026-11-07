# NPC-LIVING — Spielerinteraktionen als prüfbare Verbesserungssignale

Stand: 2026-10-29. Entwicklungsstand: kleiner reiner Auswertungskern; keine laufende Feedback-Pipeline.

## Ausgangspunkt
Bereits vorhanden: persönliche/relationalen NPC-Erinnerungen (inkl. Quellenspuren, Konsolidierung, Vergessen), Gesprächsanliegen-Klassifikation, persistierte Bevölkerung und soziale Handlungen. Neue Qualität entsteht nicht durch einen zweiten Gedächtnisspeicher, sondern durch Beobachtung, Evaluation und gezielte Verbesserungen an den bestehenden Mechanismen.

## Erste Implementation
`lib/game/cognition/npcInteractionSignals.ts` aggregiert ausschließlich strukturierte, freiwillig freigegebene Bewertungssignale. Keine Rohgespräche, keine automatische Persönlichkeitsänderung, keine KI-Trainingsbehauptung. Selbe Quellen werden pro NPC/Thema/Kontext nur einmal gezählt; kleine Stichproben sind nicht aussagekräftig. Ein Hinweis `candidate-improvement` ist **keine** positive Wirksamkeitsfeststellung, sondern ein Kandidat für menschliche Evaluation.

## Folgeschritte
1. Ereignisformat an bestehende Gespräche/Interaktionen koppeln, ohne Protokolle standardmäßig zu vervielfältigen. Einwilligung, Löschung, Abwehr gegen gefälschte/gespammte Signale und Begrenzung pro Spieler ergänzen.
2. Qualitätsprüfung mit kontrollierten Szenarien: Orientierung, Hilfe bei Konflikten, Gaststättenbesuche, Gruppen, Familien, Lernen und chronologische Konsistenz.
3. Verhalten über Zeit messen (situationsgerechte Entscheidungen, Konsistenz, Folgen, Missverständnisse); keine Optimierung auf Gesprächslänge oder bloße Nutzerzufriedenheit.
4. Chronimaps strikt trennen: historisch dokumentierte Eigenschaften von spekulativen Rollen; Simulationsergebnisse erzeugen Hypothesen, keine historische Evidenz.
5. Erst nach Review A/B-Test und Versionierung eines Modell-/Regel-Updates, Rollback, faire Auswertung und Prüfung auf Manipulation/Stereotype.
6. NPCs lernen innerhalb der Spielwelt durch die etablierte Erinnerungs-/Handlungssimulation. Änderungen am globalen NPC-Regelsystem sind ein davon getrennter Entwicklungsprozess.

## Grenzen
Persönliche Spielerinformationen werden nicht ungefragt in NPC-Wissen oder Chronimaps übertragen. Historische Ergebnisse nicht durch simulierte Übereinstimmung zu Tatsachen hochstufen.
