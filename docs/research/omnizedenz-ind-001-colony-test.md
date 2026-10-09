# OMNI-IND-001 — Kolonie als Vermögensträger? (Prüfprotokoll)

Status: proposed / nicht durchgeführt · 2026-10-08
Philosophische Leitfrage: omnizedenz.org `docs/forschung/03-individuation.md`
Methodik: omnizedenz.org `docs/forschung/04-closure-und-inferenz.md`

## Bestehender Stand (vor Neuplanung geprüft)
Die Kolonie-Forschungsruntime existiert (`lib/research/colony/`). Die dokumentierten Ablationen umfassen Reibung und Umzug; Spielraum wird mit `NOXIA-OMNI-0001` bereits gemessen. `NOXIA-LIVING-0010` führt Wohnungs-, Stellen- und Zugangsregeln zunächst als reine Regeln ein. Dieses Protokoll behauptet weder einen neuen ausgeführten Test noch eine bestehende Integration der Marktregeln in den Forschungslauf.

## Zu unterscheidende Hypothesen
H0: Alle gemessenen Koloniemuster sind durch individuelle Zustände, Interaktionen und Regeln erklärbar; eine zusätzliche ontologische Kolonie-Entität ist nicht erforderlich.
H1 (schwach): Eine bestimmte Organisation erzeugt robust zurechenbare Systemfähigkeiten, die isolierte Individuen nicht manifestieren.
H2 (stark, getrennt): Diese Fähigkeiten sind gegenüber vollständiger Komponenten-, Relations- und Regelbeschreibung ontologisch irreduzibel. H1 impliziert H2 nicht.

## Kontraste
A: dokumentierter Baseline-Lauf, identische Seeds/Anfangsbedingungen.
B: Ablation von Begegnungs-/Beziehungsrückkopplungen, soweit technisch isolierbar.
C: Ablation von Umzug/Ortswechsel (bereits vorhandene Option).
D: kontrollierte Reorganisation von Wohn-/Arbeitszuweisungen bei möglichst gleichen Personenzuständen.
E: späterer Zugangskontroll-Kontrast mit Wohnungs-/Stellenmarkt; erst nach Integration in die Forschungslauf-Runtime.

## Messung
Vorab operationalisieren: Netzwerk-Reparatur nach Ausfall, kollektive Versorgungsstabilisierung, Fähigkeit zur Aufnahme neuer Mitglieder, Erhaltung funktionaler Rollen trotz Personenaustausch. Daneben individuelle Spielraumverteilungen, nicht nur Mittelwerte, und die bereits vorhandenen Kolonie-Metriken erfassen.

Die bestehenden Spielraumgewichte (0,40/0,35/0,25) sind Setzungen. Robustheit gegen alternative Gewichte, Schwellen und Zeitfenster prüfen. Ein Durchschnitt individueller Spielräume ist kein automatisch emergenter Gemeinraum.

## Entscheidungsregeln
Ein Organisations-Effekt ist zunächst ein **Modellbefund**. Er wird nicht durch Größe, Komplexität, Langzeitdynamik oder Überraschung zum Nachweis eines eigenständigen ontologischen Trägers.
Für H1 müssen spezifische Systemvermögen, Organisationszerstörung bei weitgehend erhaltenen Komponenten, Wiederherstellung und robuste Gegenkontraste gezeigt werden.
Ein positiver H1-Befund entscheidet H2 nicht.
Nullbefunde begrenzen die getestete Operationalisierung, nicht jede denkbare Form organisationaler Individuation.

## Ausführungsstatus
Dieses Dokument ist ein Versuchsdesign. Es wurden hierfür keine neuen Simulationen ausgeführt und keine Live-Daten verändert.

## O5-Vorprüfung — Zugang als verschachtelte Manifestationsbedingung (2026-10-09)

Aktueller Code: `lib/game/population/access.ts` (`NOXIA-OMNI-0002`), `housing.ts`, `employment.ts`; bestehende Regeltests: `housingMarket.test.ts`. Nicht mit Live-Integration oder einem bereits ausgeführten Koloniekontrast verwechseln.

**Falsifizierbarer Kontrast:** Bei gleicher Person, gleichem Einkommen, gleichem Wohnungsbestand und gleicher Nachfrage nur die Zugangsentscheidung bzw. Eigentümer-/Arbeitgeberregel variieren. Vergleichen: (a) formale Angebote, (b) finanzierbare Angebote, (c) bewilligte Angebote, (d) real ausführbare Umzüge/Arbeitsaufnahmen, (e) Folgewirkung auf Spielraum. Ein abgelehnter Antrag belegt eine Zugangsentscheidung, nicht zwingend den Verlust einer realistischen Alternative.

**Kontrollen:** fehlende Kapazität, unzureichendes Einkommen, fehlende Qualifikation und eigener Verzicht sind von fremder Verweigerung zu unterscheiden; Backfill- und provided-Datensätze dürfen nicht als Machtausübung zählen. Prüfen, ob der stärkste Gatekeeper nur deshalb häufig entscheidet, weil er viele Objekte besitzt. Gleiche Entscheidungshäufigkeit bedeutet nicht gleiche Gegenmacht oder gleiche Folgen.

**Messproblem:** `accessibleShare` misst bewilligte Anträge, nicht den Anteil aller objektiv verfügbaren Möglichkeiten; `topGatekeeperShare` misst Entscheidungskonzentration, nicht bereits kausale Macht; `shutOut` ist ein Antragsindikator, kein vollständiger Ausschluss vom Wohnen/Arbeiten. Eine O5-Interpretation muss zusätzlich alternative Optionen und tatsächliche Manifestation nachweisen.

**Durchführungsgate:** Zuerst reinen, deterministischen Kontrasttest mit vorhandenen Funktionen schreiben und ausführen; erst nach separater Prüfung die Regeln in die isolierte Kolonie-Runtime einbinden. Keine Änderung von Live-Markt, Steuern oder NPC-Vermögen im Zuge dieser Forschung.

**Status:** Design ergänzt, kein neuer Kontrastlauf ausgeführt. H1/H2 von IND-001 bleiben offen.

## O5 — Erkenntnisregister nach deterministischen Zugangs-Kontrasten (2026-10-09)

**Evidenzstatus:** Die isolierten Regeltests auf PR #468 (Branch `research/omni-o5-access-contrast-20261009`) sind im dedizierten GitHub-Actions-Workflow erfolgreich gelaufen, einschließlich Alternativen und Eigentumskonzentration. Die PR ist zum Zeitpunkt der Erfassung nicht in `main` integriert. Keine Langzeitkoloniesimulation und kein Realweltbeleg.

- **O5-E1 — Vier Stufen:** Ressourcenexistenz, individuelle Eignung/Finanzierbarkeit, fremd- bzw. institutionell bewilligter Zugang und tatsächliche Realisierung getrennt messen. Eine bewilligte Option ist noch keine ausgeführte Handlung.
- **O5-E2 — Kontrafaktische Machtwirkung:** Bei konstanten Personen/Ressourcen die Entscheidung oder Kontrollstruktur eines Akteurs variieren und die Veränderung zugänglicher Alternativen bestimmen. `M(A→B;C) = Δ|P_B(C)|` ist nur eine kontextgebundene *Kardinalitätsheuristik*, kein universeller Machtbegriff: Möglichkeiten sind nicht gleichwertig, können voneinander abhängen und verschiedene Zeitwirkungen besitzen.
- **O5-E3 — Konzentration vs. Wirkung:** `topGatekeeperShare` zählt Entscheidungen; kausale Ausschlusswirkung erfordert zusätzlich den Vergleich der tatsächlich erreichbaren Alternativen. Viele Entscheidungen allein belegen keinen starken Eingriff.
- **O5-E4 — Substituierbarkeit als Moderator:** Unter gleichen Beständen und Antragstellereigenschaften kann die Verteilung der Kontrolle auf unabhängige Gatekeeper eine verweigerte Option durch andere Optionen kompensierbar machen. Im Modell sind zwei getrennte Eigentümer mit einer Bewilligung nicht gleich einem Eigentümer, der beide Wohnungen verweigert.
- **O5-H1 — Langzeitabhängigkeit (offen):** Wiederholter, nicht substituierbarer Zugangsentzug könnte Einkommen, Ortswechsel, Beziehungen und künftigen Spielraum kumulativ beeinflussen. Noch nicht getestet; Gegenhypothesen: Anpassung, öffentliche Versorgung, neue Angebote, Mobilität und Exit.

**Methodische Sicherungen:** Zähler nur über wohldefinierte, für dieselbe Person relevante Optionen; keine bloße Addition ungleichwertiger Chancen. Zugangsablehnung, Nicht-Eignung, Kapazitätsmangel, eigener Verzicht und technische Nicht-Ausführung auseinanderhalten. Gleichbleibende Seeds, Personen, Ressourcen und Nachfrage; Änderung nur der zu prüfenden Kontrollvariable. Keine Ableitung starker ontologischer Irreduzibilität aus simulierten Regelwirkungen.

**Nächste Prüfung:** zeitlicher Verlauf mit Ersatzoptionen und Exit-Möglichkeiten, individuelle Verteilungsmetriken statt nur Aggregatmittelwerten; anschließend isolierte Kolonieintegration. Forschungsbranch erst nach Review und CI-Gesamtzustand integrieren.
