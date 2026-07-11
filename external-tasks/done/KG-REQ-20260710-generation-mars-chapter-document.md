# KG request: confirm Generation Mars chapter document

ID: REQ:L3:PENDING
Requester: SYS:KUEPER:knowledge-graph
Recipient: SYS:KUEPER:noxia
Request Type: entity_request
Status: open
Created: 2026-07-10

## Purpose

The canonical KG path `PATH:NOXIA:GEN-MARS:SCIENCE-FOUNDATION` currently unlocks:

`DOC:NOXIA:GENERATION-MARS:CHAPTER-01`

No matching canonical document record or repository artifact was found in the NOXIA repository.

## Requested Content

Please decide whether this ID represents:

1. an existing Generation Mars chapter under another ID,
2. a planned chapter that should receive a minimal document record, or
3. a placeholder that should be removed from the path.

If retained, provide the canonical ID, title, status and source location. NOXIA remains source of truth for the chapter content; the Knowledge Graph will only register the confirmed document reference.

## Blocking

The unresolved document ID prevents complete validation of `exports/path-registry-0.1.json`.

## Target

NOXIA narrative/document registry or the repository location that owns Generation Mars chapter content.


---

## Resolution

**Entscheidung: Option 2 — Minimaler Dokument-Record erstellt**

`DOC:NOXIA:GENERATION-MARS:CHAPTER-01` existiert als:
- Kanonischer Record: `docs/lore/GENERATION-MARS-CHAPTER-01-record.md`
- Volltext-Platzhalter: `docs/lore/GENERATION-MARS-CHAPTER-01-v5.md`

**Kapitel-Inhalt:** Kapitel 1 der Generation-Mars-Saga (Omnizedenz-Universum).
Setting: Dubai/Erde + Omega-7/Mars, 8.–9. Januar 2092.
POVs: Rashid Al-Mansouri (Erde→Mars) und Lena Kowalski (Mars→Erde).
Signal-Muster: 1-3-1, 03:14 Uhr, bläulich-schwarz, 864m unter Omega-7.

**Status:** draft_productive (Kapitel in Bearbeitung, Version 5)

**KG-Validierung:** `PATH:NOXIA:GEN-MARS:SCIENCE-FOUNDATION` kann jetzt vollständig
validiert werden. `unlocks: ["DOC:NOXIA:GENERATION-MARS:CHAPTER-01"]` ist auflösbar.

**Aufgelöst:** 2026-07-11
**Aufgelöst von:** SYS:KUEPER:noxia
