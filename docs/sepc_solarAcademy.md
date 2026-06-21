# Spec: Solar Academy / Solar Science Foundation

Stand: 21.06.2026 · Status: Konzept, Implementierung Alpha 0.3
Vorgänger: Wissens-System (Migration 017-020), SchoolOverlay v3.x

---

## Vision

Die Solar Science Foundation ist die Wissensorganisation hinter Noxia.
Sie erstellt Trainingsdokumente — strukturierte Lerneinheiten über das
Sonnensystem, Physik, Handel und Kolonisierung. Spieler lesen diese in
der Akademie, werden geprüft und erwerben Wissenspunkte die ihre
Kolonien stärken.

Langfristig: Wissen als Fortschrittsmechanik. Wer lernt, schaltet
Technologien frei. Wer eine Akademie baut und Wissen akkumuliert,
hat einen messbaren Vorteil gegenüber Learning-by-Doing-Spielern —
aber beide Wege führen zum Ziel.

---

## Ablauf (Zielzustand)

```
Foundation-Autor schreibt Dokument (Supabase / Admin-Interface)
  ↓
Dokument erscheint in Akademie-Bibliothek
  ↓
Spieler liest Dokument (Lesestatus wird erfasst)
  ↓
Claude generiert Prüfungsfragen AUS dem Dokument
  + berücksichtigt Vorwissen (knowledge_points, gelöste Themen)
  + verschiedene Schwierigkeiten je Level
  ↓
Richtige Antworten → knowledge_points
  ↓
Stationsbonus + Technologie-Freischaltungen
```

---

## Dokument-Struktur

Jedes Foundation-Dokument hat:
- **Erklärung** — Kernkonzept in 2-5 Absätzen, Noxia-Ton
- **Beispiele** — konkrete Zahlen aus dem Spiel (Preise, Distanzen, Ressourcen)
- **Übungen** — 2-3 Aufgaben zum Selbstüben (ohne Bewertung)
- **Prüfungsthemen** — Stichworte die Claude für Prüfungsfragen nutzt

Themen-Kategorien (initial):
1. **Sonnensystem** — Planeten, Monde, Orbits, Schwerkraft
2. **Physik** — Escape Velocity, Orbital-Mechanik, Energieverbrauch
3. **Ressourcen** — Wasserkreislauf, Energiegewinnung, Metallförderung
4. **Handel** — Preisbildung, Arbitrage, Angebot/Nachfrage
5. **Navigation** — Reisezeiten, Treibstoffkosten, Reichweite
6. **Kolonisierung** — Bevölkerungswachstum, Versorgung, Infrastruktur

---

## Datenbankschema (Alpha 0.3)

```sql
-- Trainingsdokumente der Foundation
CREATE TABLE foundation_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  topic        text NOT NULL,  -- Kategorie-Slug
  difficulty   int  NOT NULL DEFAULT 1,  -- 1-6 (entspricht knowledge_levels)
  content      text NOT NULL,  -- Markdown
  exam_topics  text[],         -- Stichworte für Prüfungsfragen
  published    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Lesestatus pro Spieler
CREATE TABLE student_progress (
  profile_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  document_id  uuid REFERENCES foundation_documents(id) ON DELETE CASCADE,
  read_at      timestamptz,
  exam_passed  boolean NOT NULL DEFAULT false,
  best_score   int,
  PRIMARY KEY (profile_id, document_id)
);

-- Prüfungs-Log (welche Fragen wurden aus welchem Dokument gestellt)
CREATE TABLE exam_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  document_id  uuid REFERENCES foundation_documents(id),
  topic        text,
  kind         text,  -- 'calc' | 'quiz'
  correct      boolean,
  points       int,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

---

## school_route.ts — Erweiterung

Wenn ein Dokument mitgegeben wird, fließt sein Inhalt als gecachter
Kontext in den Prompt (Prompt Caching zahlt sich hier doppelt aus —
große Dokumente gecacht, nur die Frage variiert):

```typescript
// Dokument-Kontext im System-Prompt (gecacht)
system: [
  { type: 'text', text: STATIC_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: documentContent,       cache_control: { type: 'ephemeral' } },
]

// Variable Frage (nicht gecacht)
messages: [{ role: 'user', content: userPrompt }]
```

Prüfungsfragen entstehen dann AUS dem Dokument statt aus dem Nichts —
präziser, lehrreicher, überprüfbar.

---

## SchoolOverlay — neue Tabs (Alpha 0.3)

```
[ Aufgaben ] [ Bibliothek ] [ Fortschritt ]
```

**Bibliothek-Tab:**
- Liste aller publizierten Foundation-Dokumente
- Lesestatus (gelesen / ungelesen / bestanden)
- Klick → Dokument lesen → danach Prüfung starten

**Fortschritt-Tab:**
- Welche Themen abgedeckt
- Stärken/Schwächen (Trefferquote je Kategorie)
- Nächste empfohlene Dokumente

---

## Technologie-Freischaltungen (Alpha 0.3)

Gebäude werden durch Wissen freigeschaltet, nicht nur durch Credits:

| Gebäude | Voraussetzung |
|---------|--------------|
| Geothermie | 500 Punkte + Dokument "Geologie" gelesen |
| ISRU-Anlage | 2000 Punkte + Dokument "Ressourcengewinnung" |
| Fusionsreaktor | 5000 Punkte + Dokument "Kernfusion" |
| Relais-Turm | 1000 Punkte + Dokument "Kommunikation" |

Sichtbar im Bau-Dialog: ausgegraut mit Hinweis
"Benötigt: 500 Wissenspunkte (du hast 320) + Dokument gelesen"

---

## Erste Foundation-Dokumente (Inhalt, nicht Code)

Zu schreiben vor der Implementierung:

1. **Einführung: Das Sonnensystem** (Difficulty 1)
   - Sonne, Planeten, Monde
   - Warum Erde → Mond teurer als Mond → Erde?
   - Noxia-Stationen und ihre Positionen

2. **Wasserknappheit im Sonnensystem** (Difficulty 2)
   - Warum ist Wasser auf dem Mars knapp?
   - Shackleton-Krater: Eisvorkommen auf dem Mond
   - Atmosphärische Kondensation auf dem Mars

3. **Grundlagen des Weltraumhandels** (Difficulty 2)
   - Angebot und Nachfrage im Sonnensystem
   - Arbitrage: Wann lohnt sich eine Route?
   - Preisimpulse durch Handel

4. **Bevölkerung und Ressourcenverbrauch** (Difficulty 3)
   - Wachstumsraten und Versorgungssicherheit
   - Wie viel Wasser braucht eine Kolonie?
   - Habitatkapazität und Überbelegung

---

## Admin-Interface (später)

Einfaches Markdown-Editor-Overlay für Foundation-Autoren:
- Neues Dokument erstellen / bearbeiten
- Vorschau mit Noxia-Styling
- publish / unpublish

Vorerst: Dokumente direkt in Supabase SQL-Editor eintragen.

---

## Querverweise

- Wissens-System: Migration 017-020, `knowledge_route.ts`
- Akademie-Overlay: `SchoolOverlay.tsx` (aktuell v3.x)
- Gebäude-Katalog: `SPEC_gebaeude_katalog.md`
- Technologie-Freischaltungen: hängen an diesem Spec
- Prompt Caching: `app/api/game/school/route.ts` (Dokumente gecacht)

---

## Reihenfolge (Alpha 0.3)

1. Foundation-Dokumente schreiben (Inhalt, kein Code)
2. DB-Schema (foundation_documents, student_progress, exam_log)
3. school_route.ts — Dokument-Kontext einbauen
4. SchoolOverlay — Bibliothek-Tab + Dokument-Ansicht
5. Technologie-Freischaltungen in config.ts + build route
6. Fortschritt-Tab + Statistiken
