# EXT-KG-NOX-20260831 — Contracomology: KG clearance for NOXIA evaluation

Source: `SYS:KUEPER:knowledge-graph`  
Target: `SYS:KUEPER:noxia`  
Status: open  
Priority: high  
Created: 2026-08-31

## Anlass

Der bisherige KG-Blocker aus `KG.KON-000003` ist auf Knowledge-Graph-Seite aufgehoben. Die Contracomology-Kernidentitäten sind kuratiert und für Consumer freigegeben.

Kanonische Quelle:
- `thomaspeterkueper/kueper-knowledge-graph/docs/KG-0017-CONTRACOMOLOGY-CANON.md`
- `thomaspeterkueper/kueper-knowledge-graph/exports/contracomology-0.1.json`

## Freigegebene Referenzen

- Domain: `KD:KON:N1`
- `CON:L1:zeitform`
- `CON:L1:avi-punkt`
- `CON:L1:oem`
- `CON:L1:paradigma-1`
- `CON:L1:paradigma-2`
- `CON:L1:paradigma-3`

Zusätzlich existieren die Identitätsanker `CON:L1:ma-u` und `CON:L1:ma-ta-u`; deren Detaildefinition ist noch offen. Sie sind für die hier angefragte NOXIA-Evaluation nicht erforderlich.

## Auftrag an NOXIA

Den bisherigen Contracomology-Request (`KG.KON-000003` / PR #11) nicht länger wegen KG-Kuration blockieren.

NOXIA darf jetzt prüfen und entscheiden, ob und wie `KD:KON:N1` bzw. daraus abgeleitete Lernabschlüsse als Crew-Kompetenz für Langzeitmissionen, Transferreisen, Kommunikationsstille und kulturelle Orientierung verwendet werden.

Wichtig:
- KG autorisiert nur die Wissensreferenzen.
- Stabilitätsboni, Konflikterkennung, Kommunikations-/Kulturmechaniken, Schwellenwerte und Balancing sind ausschließlich NOXIA Source of Truth.
- Der endgültige didaktische Kurs-/Path-Identifier kommt von SSF. Bis diese Rückmeldung vorliegt, bitte `KD:KON:N1` als stabile KG-Referenz verwenden und keine lokale dauerhafte SSF-Modul-ID erfinden.

## Abhängigkeit, die noch bleibt

Nur der konkrete SSF-Academy-/Learning-Path-Identifier ist noch ausstehend. Dazu wurde zeitgleich `EXT-KG-SSF-20260831-contracomology-clearance.md` an SSF gestellt.

Die fachliche KG-Kuration selbst ist abgeschlossen.
