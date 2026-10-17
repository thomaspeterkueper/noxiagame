# NOXIA Forschungsdesign: NPC-Informationskanäle
Stand: 2026-10-17
Status: Entwurf; keine Live-Aktivierung

## Ziel
Untersuchen, wie Gedächtnisrekombination, Informationsaustausch und eine rein hypothetische zusätzliche Informationsquelle die Lern- und Entscheidungsleistung von NPCs beeinflussen. Die Quelle ist **nur eine simulierte Intervention**. Kein wissenschaftlicher Nachweis eines realen externen Speichers.

## Versuchsarme
- A: Kontroll-NPC, bestehende Erinnerung und reguläre Wahrnehmung, ohne Zusatzkanal.
- B: Rekombinations-NPC, gleiche Wahrnehmung und Erinnerungsmenge, aber veränderte Traum-Assoziation.
- C: Sozial-NPC, B plus Austausch mit anderen NPCs; Herkunft jedes Signals protokollieren.
- D: Signal-NPC, B plus künstlich erzeugter externer Hinweis auf ein verborgenes Ziel; Signalgenauigkeit frei einstellbar.
- E: Placebo-NPC, B plus gleich viele bedeutungslose Zusatzinformationen wie D.

## Randomisierung und Fairness
Stratifizierte Zuteilung nach Beruf, Alter, Region und vorhandener Gedächtnis-/Kompetenzbasis. Gleicher Seed für Umweltbedingungen; separate Zufallsströme für Zielgenerierung und Modellantwort. Keine genetischen oder demografischen Unterschiede als Proxy für Informationsfähigkeit. Identische Tick-Zeiten, Rechenbudgets, Zugang zu Ressourcen und Erfolgskriterien.

## Messwerte
Trefferquote bei verdeckten Aufgaben, Transfer auf neue Aufgaben, Kalibrierung von Konfidenz, Zahl nützlicher neuer Assoziationen, Fehlalarme, Sozialnetzwerkdichte und Kosten je NPC/Tick. Vertraute Aufgaben und wirklich unbekannte Zielinformationen strikt getrennt messen.

## Datenmodell (Vorschlag, nicht implementiert)
experiment_id, npc_id, assigned_group, environment_seed, cognition_seed, channel_mode, signal_quality, observation_source, provenance_kind, injected_target_ref, memory_episode_id, dream_episode_id, tick, outcome, model_version, consent_or_policy_flag.
Provenance_kind: sensed | remembered | inferred | social | simulated_external | unknown. Unbekannt ist kein Beweis für externen Ursprung.

## Simulation
1. Offline-Harness mit synthetischen NPCs und deterministischen Seeds.
2. Vorab definierte Testaufgaben und Blind-Auswertung; keine Einsicht der Kontrollmodelle in versteckte Targets.
3. Testreihen über unterschiedliche Gruppengrößen, Signalqualitäten, Speichergrößen, Rekombinationsraten und soziale Konnektivität.
4. Ablation: externer Kanal deaktiviert, durch Zufallsrauschen ersetzt oder zeitlich verschoben.
5. Berichte samt Negativbefunden und Konfidenzintervallen.

## Live-Spiel (später, nach Review)
Feature-Flag standardmäßig AUS; reine Beobachtung im Shadow-Modus vor einem opt-in Canary-Rollout. NPCs dürfen als zusätzliche Population auftreten, jedoch keine unkontrollierten Ressourcen, Credits, Immobilien oder Wirtschaftseffekte erzeugen. Identität und Biografie unabhängig von Experimentgruppe. Vermeiden, dass Spieler über eine vermeintlich echte Außerverbindung irregeführt werden. Belastungsbudget, Aufräumplan, Kill-Switch, Datenbank- und RLS-Prüfung vor Aktivierung.

## Technische Akzeptanzkriterien
Keine bestehenden NPCs umklassifizieren. Keine Breaking Changes in DreamEpisode oder persistierten Erinnerungen. Keine neuen Live-Cron-Jobs ohne Kostenmessung. Migrationen additiv und rückrollbar. Deterministische Tests, Reproduzierbarkeit, Baseline-Vergleich und Telemetrie zu Kosten/Fehlern. Keine direkten Schreibzugriffe auf produktive Simulationsdaten aus dem Offline-Test.

## Entscheidungstore
G0 Architektur- und Datenschutzreview; G1 Offline-Messwerte; G2 Staging/Shadow; G3 begrenzter Canary; G4 erst nach expliziter Freigabe allgemeine Populationserweiterung.

## Bezug
Methusalem-Forschungsnotiz zur Neuroplastizität und rekombinativem Gedächtnis. Primärquellen zu Psilocybin/Netzwerkdynamik sind Forschungsanlass, nicht Beleg für übergeordnete Informationskanäle.
