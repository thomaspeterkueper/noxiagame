# NOXIA Request – Traummodell zusammenführen, Motivverknüpfung und Persistenz

Datum: 2026-10-16
Status: proposed – Reihenfolge und Scope, keine Laufzeitänderung
Priorität: hoch (blockiert weitere Traum-Stufen)
Herkunft: Review der Branches `feat/npc-dream-knowledge-prototype-20261016` und `docs/agent-infra-0001` vom 2026-10-16
Bezug: `NOXIA-REQ-20261016-dream-memory-external-knowledge.md`, PR #483–#486, `NOXIA-AGENT-INFRA-0001`

## Ausgangslage

Es gibt derzeit **zwei parallele Traummodelle**:

1. `lib/game/cognition/dreamRecombination.ts` (PR #484, Branch `claude/creative-from-452`) – `DreamAssociation` mit Erinnerungen, Spuren, Sinnesmustern, `provenance: 'dream_recombination'`, `canonical: false`.
2. `lib/game/knowledge/dreamKnowledge.ts` (Branch `feat/npc-dream-knowledge-prototype-20261016`) – `DreamEpisode` mit externen Quellen, Distress-Bewertung und fünf nachgelagerten Stufen (Inquiry → Decision → Intent → Admission → Population-Bridge).

Beide sind rein, deterministisch und nicht persistent. Ohne Zusammenführung entstehen zwei Provenienzketten für dasselbe Phänomen.

## Ziel

Ein einziges Traummodell, in dem eigene Erfahrung und begrenzte externe Impulse **inhaltlich** verknüpft werden, das die Nacht überdauert und das spätere Verhalten selektiv beeinflusst – unter Beibehaltung aller Invarianten des Ursprungs-Requests (Traum ≠ Fakt, keine Live-Abrufe pro NPC, Lore-Zeitgrenzen).

## Reihenfolge

### Schritt 0 – Integrationsbasis
- #486 (Import-Fix) unabhängig prüfen und integrieren.
- #483 → #484 → #485 in Abhängigkeitsreihenfolge integrieren, nach jedem Schritt Basis-Branch aktualisieren und Tests erneut laufen lassen.
- Erst danach den Traum-Prototyp auf das neue `main` rebasen.

### Schritt 1 – Ein Modell
- `DreamAssociation` (cognition) ist das Basismodell; `DreamEpisode` wird darauf aufgebaut oder darin aufgelöst, nicht parallel geführt.
- Externe Quellen werden als zusätzliche Eingangsart neben Erinnerungen, Spuren und Mustern ergänzt (`sourceIds`), mit eigener Provenienzkennung.
- Distress-Bewertung und die nachgelagerten Stufen (Inquiry … Bridge) bleiben erhalten, konsumieren aber das vereinheitlichte Modell.
- Ablage: Modell und Synthese in `lib/game/cognition/`, Wissens-/Prüfstufen in `lib/game/knowledge/`.

### Schritt 2 – Motivverknüpfung statt Zufallsauswahl
- Bisher werden Quellen per Hash zufällig gezogen, unabhängig von den Erinnerungen. Stattdessen: Quellen nach Motivüberlappung mit den ausgewählten Erinnerungen bzw. Mustern ranken; der Hash dient nur als deterministischer Gleichstandsbrecher.
- Ein kleiner, begründeter Zufallsanteil (Fremdimpuls ohne Bezug) ist erlaubt, muss aber als solcher markiert sein.
- Test: Eine thematisch passende Quelle muss bei gleichem Seed einer unpassenden vorgezogen werden.

### Schritt 3 – Keine Textreplikation
- Motive enthalten keinen wörtlichen Quelltext mehr (bisher bis zu 180 Zeichen). Gespeichert werden nur Schlagworte/Motivschlüssel plus `sourceId`; der Volltext bleibt ausschließlich in der `SourceObservation`.
- Test: Kein Motiv darf eine Teilzeichenkette ab 8 Wörtern aus einem Quelltext enthalten.

### Schritt 4 – Lore-Zeitgrenze schärfen
- `availableFromYear <= worldYear` reicht nicht: In einer Welt von 2150 passiert jede Quelle von 2026. Quellen brauchen eine Zuordnung zur datierten Weltwissens-Projektion (In-World-Verfügbarkeit, Ort, Zugangsrecht, Technologiestand) oder die ausdrückliche Markierung `noncanonical-inspiration`.
- Test: Eine reale Quelle ohne Projektion darf nicht als in-world verfügbares Wissen in einen Traum eingehen.

### Schritt 5 – Persistenz und Nachwirkung
- Anbindung an den bestehenden Schlaf- und Erinnerungspfad (`personEpistemicSleep`, `personEpistemicPersistence`, `npcRelationalMemory`) statt weiterer Stufen.
- Traum-Episoden werden mit Aufbewahrungsregel gespeichert; nur ein kleiner Teil wird erinnert (Traumerinnerung als NPC-Eigenschaft).
- Abnahme: Ein erinnerter Traum verändert in einem späteren Tick nachweisbar und begrenzt eine Interessens- oder Handlungsgewichtung; ein nicht erinnerter nicht.
- Migration, falls nötig, als getrenntes, geprüftes Artefakt gemäß `NOXIA-AGENT-INFRA-0001`; Feature-Flag bleibt standardmäßig aus.

## Nebenbefund CI

- Der Workflow `npc-dream-checks.yml` nutzt pnpm und Node 22, `noxia-core-causality.yml` npm und Node 24, Vercel Node 24. Vereinheitlichen.
- Statt jede Datei einzeln als Pfad und Testlauf zu listen: Script `test:dreams` in `package.json` und Pfadmuster `lib/game/**/dream*`, `lib/game/cognition/npcDream*`.
- ~~Hinweis: `docs/agent-infra-0001` hat keine gemeinsame Basis mit `main` …~~ Korrigiert 2026-10-17: Die Aussage beruhte auf einer flachen Kopie ohne Merge-Base. Die Merge-Base ist `583f76f2`, der Branch fügt nur Dateien hinzu. Seine Inhalte wurden mit dem Phase-0-Abschluss nach `main` übernommen.

## Nicht-Ziele

- Keine weitere Stufe nach der Population-Bridge, bevor Schritt 5 abgenommen ist.
- Keine Live-Webabrufe, kein wiederkehrender Hintergrundjob.
- Kein direkter Weg vom Traum zu verifiziertem Weltwissen.

## Abnahmekriterien

- Genau ein Traummodell im Code; das zweite ist entfernt oder darin aufgegangen.
- Quellenauswahl hängt nachweisbar vom Inhalt der Erinnerungen ab.
- Kein wörtlicher Quelltext in Motiven.
- Lore-Zeitprüfung schlägt bei realen Quellen ohne Projektion an.
- Erinnerte Träume wirken nach Persistenz selektiv auf späteres Verhalten.
- Alle Traum-Tests laufen über ein gemeinsames Script in derselben Node-/Paketmanager-Umgebung wie die übrigen Checks.
