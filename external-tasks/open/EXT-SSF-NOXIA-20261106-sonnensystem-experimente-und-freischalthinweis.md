---
id: EXT-SSF-NOXIA-20261106-sonnensystem-experimente-und-freischalthinweis
title: Sonnensystem-Modul im Raumhafen – Experimente darstellen und Freischaltung vor der Prüfung nennen
status: open
source: SSF
target: NOXIA
created: 2026-11-06
requested_by: T.P.K.
priority: high
affects: [NOXIA, SSF]
supersedes: []
related: [EXT-SSF-NOXIA-20261102-learning-prerequisites-delivered]
---

# EXT-SSF-NOXIA-20261106 – Sonnensystem: Experimente und Freischalthinweis

Befund (T.P.K., „Lernen im Raumhafen: Das Sonnensystem“, Modul `LRN:SSF:AST-L1-000001`):

1. Im Text werden Experimente erwähnt, es gibt aber keine – NOXIA zeigte nur Titel und Beschreibung.
2. Es fehlt ein Hinweis, was man mit dem Modul freischaltet. `SsfModuleRenderer` zeigt die Freischaltung erst **nach** bestandener Prüfung.

## Was SSF jetzt liefert (SSF `main` `cadbf3c`)

`GET /api/noxia/modules/LRN:SSF:AST-L1-000001` enthält zwei Abschnitte `type: 'interactive'` mit dem neuen Feld `kind`. SSF rechnet alle Werte; NOXIA muss **keine Physik** nachbauen, nur darstellen.

### `interactiveId: 'transferbahn-vergleich'`, `kind: 'transfer-comparison'` (Einheit 1)

```ts
params: {
  from: { id, label, orbitAu }, to: { id, label, orbitAu },   // Erde → Mars
  straightLineKm: number,                                     // 78 Mio. km
  hohmannIndex: number,                                       // 0
  samples: Array<{
    dv1KmS, days, sweepDeg, eccentricity, dvArrivalKmS, dvTotalKmS,
    path: [x, y][]   // 25 Bahnpunkte in AE, Sonne im Ursprung, Start bei (r₁, 0)
  }>,                                                          // 55 Stützstellen, Δv₁ 2,95 … 30 km/s
  constants: { GM_SUN, AU_M },
}
```

Darstellung: ein Schieberegler über die Stützstellen, Bahn als Linie (`path`), dazu Reisezeit, Bogenwinkel, Bremsbedarf am Ziel, Δv gesamt. Hohmann-Bogen gestrichelt als Vergleich.

### `interactiveId: 'hohmann-rechner'`, `kind: 'hohmann-calculator'` (Einheit 2)

```ts
params: {
  bodies: Array<{ id, label, orbitAu, periodDays, color }>,  // Merkur bis Jupiter
  pairs: Array<{ fromId, toId, transferSemiMajorAu, dv1KmS, dv2KmS, dvTotalKmS,
                 transferDays, windowEveryDays, phaseAngleDeg }>,  // alle 20 Paare
  defaultFromId: 'erde', defaultToId: 'mars',
  constants: { GM_SUN, AU_M },
}
```

Darstellung: Start/Ziel wählen, halbe Ellipse zeichnen (große Halbachse `transferSemiMajorAu`, Sonne im Brennpunkt), Werte daneben. Erde → Mars: 2,95 + 2,65 = 5,6 km/s, 259 Tage, Fenster alle 780 Tage, Mars 44° voraus.

Referenz-Darstellung auf SSF-Seite: `components/learning/TransferComparisonExperiment.tsx` und `HohmannExperiment.tsx` im SSF-Repo.

`gravitationsbrunnen` trägt jetzt `kind: 'gravity-well'`, sonst unverändert. Unbekannte `kind`-Werte bitte weiterhin mit `fallback` zeigen – `fallback` ist bei beiden neuen Experimenten ein vollständiger Lesetext mit Zahlen.

## Aktion für NOXIA

1. `lib/ssfKnowledge.ts`: `SsfModuleSection` um `kind` und die beiden `params`-Formen erweitern.
2. `app/academy/learn/SsfModuleRenderer.tsx`: nach `kind` verzweigen (`transfer-comparison`, `hohmann-calculator`, `gravity-well`) statt nur nach `interactiveId === 'gravitationsbrunnen'`.
3. **Freischalthinweis vor der Prüfung**: oben im Modul (unter Dauer/Schwierigkeit) „Schaltet frei: …“ mit Label und Spielwirkung (`UnlockDefinition.grants` bzw. Lernverzeichnis) – nicht erst nach Bestehen. Für dieses Modul sinngemäß:
   - Orbitale Navigation (`UNL:NOX:NAV:ORBITAL`) – Navigationsfähigkeit +0,35
   - Scout-Frame kaufen (`UNL:NOX:SHIP:SCOUT`) – fehlt bisher in Unlock-Registry und Lernverzeichnis und wird deshalb von `isGameRequirementUnlock` herausgefiltert
   - Teil der Flugausbildung: zusammen mit Gravitation (`PHY-ENERGIE-ARBEIT-0001`) entfällt das Pilotenhonorar. Dafür muss `PILOT_TRAINING_MODULES` noch auf `['PHY-ENERGIE-ARBEIT-0001', 'AST-L1-000001']` umgestellt werden (siehe EXT-SSF-NOXIA-20261102).
   - Prämie in Credits, falls vorab bekannt.
4. Der Hinweis gilt für alle Module, nicht nur für dieses.

`NAV:ORBITAL` und `AST:HOHMANN-TRANSFER` in `unlocks[]` sind SSF-interne Kennungen und brauchen in NOXIA keine Anzeige.
