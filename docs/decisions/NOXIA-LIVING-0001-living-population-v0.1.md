# NOXIA-LIVING-0001 — Living Population v0.1

**Status:** Accepted  
**Version:** 1.0.0  
**Created:** 2026-08-24  
**Scope:** NOXIA population simulation

## Entscheidung

NOXIA simuliert NPCs zunächst als **persistente Personen, nicht als Dialogfiguren**. Sprache und generative Dialoge sind eine spätere Darstellungsschicht. Der Kern ist ein nachvollziehbares Personenmodell, das mit Orten, Gebäuden, Arbeit, Bedürfnissen, Beziehungen, Wissen und Ereignissen verbunden ist.

Der erste vertikale Durchstich umfasst etwa **20–50 persistente Personen pro Testsiedlung**. Jede Person besitzt einen stabilen Zustand und kann sich über Simulations-Ticks verändern.

## Leitprinzipien

1. NPCs sind Weltobjekte mit stabiler Identität.
2. NPCs handeln aufgrund ihres Zustands und ihrer wahrgenommenen Umwelt, nicht aufgrund frei generierter Geschichten.
3. Wissen ist personengebunden: Ein NPC kann nur auf Ereignisse, Zustände oder Erkenntnisse reagieren, die er wahrgenommen oder gelernt hat.
4. Beziehungen sind persistente Relationen und verändern sich durch Ereignisse.
5. Entscheidungen müssen für Debugging und Balancing erklärbar bleiben.
6. Generative KI ist für v0.1 weder Voraussetzung noch Entscheidungsinstanz.
7. NPCs dürfen später Betriebe gründen, Arbeitgeber wechseln, umziehen, forschen und Wissen weitergeben; v0.1 reserviert diese Erweiterung, simuliert sie aber noch nicht vollständig.

## Domänenmodell

```text
Person
├── Identity
├── Residence -> Location / Building
├── Occupation -> Role / Workplace
├── Needs
├── Skills / Experience
├── Relationships -> Person
├── Knowledge -> perceived facts/events
└── Current State
        ↓
Decision
        ↓
Action
        ↓
Event
        ↓
State / Relationship / Knowledge change
```

### Person

Eine persistente natürliche Person der NOXIA-Welt. Mindestdaten:

- stabile ID
- Name
- Geburts-/Altersinformation in spielgeeigneter Form
- aktueller Standort
- Wohnort
- Arbeitsplatz/Rolle, falls vorhanden
- Aktivitätszustand
- wenige aggregierte Bedürfnisse
- Kompetenzen/Erfahrung

### Role / Occupation

Rollen beschreiben, was eine Person in der Simulation tut. Phase 1 benötigt nur wenige Rollenfamilien, z. B.:

- technician
- scientist
- geologist
- operator
- trader
- administrator
- service
- unemployed / resident

Rolle und Arbeitgeber sind getrennt. Dadurch kann später ein Techniker den Betrieb wechseln, ohne seine Kompetenz zu verlieren.

### Needs

v0.1 verwendet bewusst wenige aggregierte Bedürfnisse:

- sustenance — Grundversorgung
- rest — Erholung
- safety — Sicherheit/Versorgungsstabilität
- social — soziale Einbindung
- purpose — Arbeit/Sinn/Wirksamkeit

Werte werden als normierte Zustände geführt. Sie sollen Verhalten beeinflussen, aber nicht jeden Tick Mikromanagement erzwingen.

### Skills / Experience

Kompetenzen wachsen durch Tätigkeit und Ereignisse. v0.1 benötigt noch keinen vollständigen Skilltree. Ein flexibles `skill_code + level + experience`-Modell reicht.

Beispiele:

- maintenance
- geology
- materials
- logistics
- research
- administration

### Relationships

Eine Relation zwischen zwei Personen. v0.1 speichert mindestens:

- relationship type
- familiarity
- trust
- affinity
- last interaction

Die Werte sind Simulationseigenschaften, keine psychologische Diagnose. Beziehungen können durch gemeinsame Arbeit, Hilfe, Konflikte und wiederholte Begegnungen verändert werden.

### Knowledge / Experience

NPC-Wissen ist explizit von globalem Spielwissen getrennt. Eine Person kann z. B. wissen:

- eine Anlage fällt wiederholt aus
- eine Kachel weist ungewöhnliche Messwerte auf
- eine Person besitzt eine bestimmte Kompetenz
- ein Betrieb sucht Material
- ein Ereignis hat stattgefunden

Ein Knowledge-Eintrag benötigt mindestens `subject`, `knowledge_type`, `confidence`, `learned_at` und optional einen Event-/Objektbezug.

Dies ermöglicht später Beobachtung, Gerüchte, Forschung und Wissensweitergabe, ohne dass jeder NPC allwissend ist.

### Event

Zustandsänderungen werden als Events nachvollziehbar gemacht. Beispiele:

- npc_started_work
- npc_finished_shift
- npc_moved
- npc_met_person
- npc_helped_person
- npc_observed_failure
- npc_gained_experience
- npc_reported_problem
- npc_changed_job

v0.1 muss nicht jedes triviale Tick-Detail dauerhaft speichern. Persistiert werden relevante Zustandsänderungen und Ereignisse, die Beziehungen, Wissen oder Gameplay beeinflussen.

## Entscheidungsmodell v0.1

Keine generative Agentenschleife. Pro NPC wird aus wenigen zulässigen Aktionen eine nachvollziehbare Priorität berechnet.

Beispiel:

```text
available actions
  work
  rest
  satisfy_basic_need
  travel_home
  travel_work
  social_interaction
  inspect_problem
  report_problem

score(action) =
  need pressure
+ role obligation
+ local opportunity
+ known problem relevance
+ relationship modifier
- travel / effort cost
```

Die gewählte Aktion speichert optional ihre wichtigsten `decision_factors`, damit Entwickler und später auch die UI erklären können: **Warum tut diese Person das?**

## Verbindung mit WORLD-0002

Living Population ersetzt keine Weltobjekte. Personen referenzieren bestehende NOXIA-Orte und Gebäude:

```text
Location
  -> Tile
      -> Building
          -> Workplace / Residence
              -> Person
```

Ein NPC besitzt keinen eigenen parallelen Ortsbegriff. Standort-, Reise- und Gebäudezustände bleiben Source of Truth der Welt-/Gebäudesysteme.

## Beispiel: emergente Wartungskette

```text
Wasseranlage verliert wiederholt Leistung
        ↓
Technikerin arbeitet dort und nimmt Störung wahr
        ↓
Knowledge: recurring_failure, confidence steigt
        ↓
maintenance experience steigt
        ↓
NPC priorisiert inspect_problem
        ↓
Problem wird gemeldet
        ↓
Spieler/Betrieb reagiert oder ignoriert
        ↓
Anlagenzustand + Beziehungen + Erfahrung entwickeln sich weiter
```

Das Ereignis ist keine vorgefertigte Quest. Eine Aufgabe oder Meldung kann als UI-Darstellung **aus der Simulation entstehen**.

## Phase 1 — bewusst nicht enthalten

- freie/generative Dialoge
- LLM-Aufruf pro NPC
- komplexe Persönlichkeitsmodelle
- Partnerschaft/Familien-/Fortpflanzungssimulation
- vollständige Lebensläufe
- Politik/Religion
- Kriminalität
- detaillierte Gesundheitssimulation
- autonome Firmengründung
- vollständiger Arbeitsmarkt
- Massenpopulationen mit tausenden voll simulierten Individuen

Diese Systeme dürfen später auf dem Personen-/Relation-/Event-Modell aufbauen.

## Skalierung

v0.1 optimiert zunächst auf 20–50 aktive Personen. Das Datenmodell muss später Simulationsebenen erlauben:

- active — volle lokale Simulation
- background — reduzierte Tickfrequenz
- aggregate — statistische Population ohne individuelle Tickentscheidung

Damit müssen spätere große Städte nicht jede Person in jedem Tick vollständig simulieren.

## Source of Truth

- Personen, Bedürfnisse, Rollen, Beziehungen und NPC-Ereignisse: NOXIA
- Orte, Tiles, Gebäude und Umweltzustände: NOXIA / WORLD-0002
- wissenschaftliche Inhalte und Lernmodule: SSF
- Claims/semantische Wissensstruktur: Knowledge Graph

Ein NPC kann SSF-/KG-Wissen referenzieren oder daraus lernen; SSF/KG bestimmen jedoch nicht den individuellen Zustand einer NOXIA-Person.

## Implementierungsreihenfolge

1. bestehende DB-/Location-/Building-Struktur gegen dieses Modell abgleichen
2. kleines TypeScript-Domänenmodell `lib/game/population/`
3. DB-Migration für Person, Role, Need, Skill, Relationship, Knowledge und Event
4. deterministischer Population-Tick für 20–50 Personen
5. Seed/Testpopulation an genau einem Standort
6. internes Population-Debug-Panel: Person -> Zustand -> letzte Entscheidung -> Begründung
7. erst danach sichtbare Gespräche, Meldungen und aus Simulation entstehende Aufgaben

## Abnahmekriterium v0.1

Eine Testsiedlung mit 20–50 Personen kann mehrere Simulationszyklen durchlaufen. Personen wohnen und arbeiten an existierenden Orten, Bedürfnisse verändern ihre Entscheidungen, Erfahrung kann wachsen, Begegnungen können Beziehungen verändern und relevante Beobachtungen werden als persönliches Wissen gespeichert. Für jede relevante NPC-Aktion lässt sich nachvollziehen, wodurch sie ausgelöst wurde.
