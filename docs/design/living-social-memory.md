# NOXIA Living Population — Social Memory v1

Stand: 15.09.2026

## Ziel

NPC-Personen sollen nicht nur auf den aktuellen Tick reagieren. Entscheidungen sollen eine nachvollziehbare persönliche Geschichte besitzen, ohne die deterministische und auditierbare Simulation aufzugeben.

Der minimale Kreislauf lautet:

`Person → Ereignis → Erinnerung → Beziehung/Ziel → Entscheidung → Ereignis`

## Grenzen

- `people` bleibt die kanonische Personenschicht.
- `actors` bleibt von Personen getrennt.
- Keine NPC-Dummy-Spielerprofile.
- `personBrain` bleibt deterministisch; ein LLM darf keine Simulationswahrheit direkt schreiben.
- Erinnerungen werden aus beobachtbaren/autoritativen Ereignissen abgeleitet.
- Beziehungen sind gerichtet: A kann B anders vertrauen als B A.
- Weltanschauungen und Bewegungen werden noch nicht in dieses Schema hart codiert.

## v1-Zustände

### Erinnerung
Eine Erinnerung referenziert die Person, optional eine zweite Person und einen Ort. `salience` beschreibt ihre Bedeutung, `valence` die positive/negative Erfahrung und `trust_delta` die Auswirkung auf interpersonales Vertrauen.

### Beziehung
Die Projektion hält nur gameplay-relevante Aggregate: Bekanntheit, Vertrauen, Unterstützungsbilanz und letzte Interaktion. Die Ereignis-/Erinnerungshistorie bleibt die Begründung dafür.

### Langfristiges Ziel
Ziele ergänzen akute Needs und Colony Pressures. Sie besitzen Priorität, Fortschritt und Status. Ein späterer Planner darf sie gewichten, aber nicht beliebig neue kanonische Fakten erfinden.

## Warum vor Omnizedenz

Omnizedenz soll kein Sonderbonus und keine fest verdrahtete Religion sein. Zuerst braucht NOXIA soziale Tatsachen: Wer hilft wem? Wer vertraut wem? Welche Erfahrungen prägen eine Person? Welche Ziele verfolgt sie?

Erst darauf kann ein generisches Bewegungs-/Weltanschauungsmodell aufsetzen. Eine Person kann dann durch reale Erfahrungen für eine Bewegung empfänglich werden, sie ablehnen oder anders interpretieren. Dasselbe System muss auch andere philosophische, religiöse, politische und lokale Bewegungen tragen können.

## Nächste Integrationsstufe

1. autoritative `population_events` in begrenzte `person_memories` projizieren;
2. daraus `person_relationships` deterministisch aktualisieren;
3. aktive `person_goals` in den `PersonDecisionContext` einspeisen;
4. zunächst nur wenige überprüfbare soziale Entscheidungen hinzufügen, z. B. Hilfe bei einer Krise oder Kontakt zu einer vertrauten Person;
5. Tests für Replay/Idempotenz und identische Entscheidungen bei identischem Zustand;
6. erst danach generische Bewegungen/Weltanschauungen modellieren.
