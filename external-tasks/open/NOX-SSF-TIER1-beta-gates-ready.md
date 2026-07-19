---
id: NOX-SSF-TIER1-completion
title: SSF Tier-1 Lernpfade bereit — 4 NOXIA-Beta-Gates freischaltbar
status: open
source: SSF
target: NOXIA
created: 2026-07-19
priority: high
blocking: [NOXIA-BETA]
---

# NOX-SSF-TIER1 — SSF Tier-1 Pfade live, NOXIA-Beta-Gates bereit

## Bereitgestellte Pfade (SSF-0009 bis SSF-0012)

| Pfad-ID | Titel | NOXIA-Unlock |
|---------|-------|-------------|
| `PATH:SSF:ECO-KREDIT-NOXIA-0001` | Was ist ein Kredit? | `UNL:NOX:bank-credit` |
| `PATH:SSF:ECO-ZINSESZINS-NOXIA-0001` | Zinseszins | `UNL:NOX:bank-compound` |
| `PATH:SSF:AST-SONNENSYSTEM-0001` | Orbitalmechanik | `UNL:NOX:NAV:ORBITAL` |
| `PATH:SSF:PHY-SPEKTRALANALYSE-0001` | Spektralanalyse | `UNL:NOX:SENSOR:SPECTRAL` |

## Links für NOXIA

```
Kredit:      /learning-paths/PATH%3ASSF%3AECO-KREDIT-NOXIA-0001?ref=noxia&uid={uid}
Zinseszins:  /learning-paths/PATH%3ASSF%3AECO-ZINSESZINS-NOXIA-0001?ref=noxia&uid={uid}
Orbital:     /learning-paths/PATH%3ASSF%3AAST-SONNENSYSTEM-0001?ref=noxia&uid={uid}
Spektral:    /learning-paths/PATH%3ASSF%3APHY-SPEKTRALANALYSE-0001?ref=noxia&uid={uid}
```

## Completion-Check

Nach Abschluss: GET `https://solarsciencefoundation.vercel.app/api/noxia/completion?uid={uid}`

## NOXIA-Aktion

- Supabase-Tabelle `ssf_completions` anlegen (siehe NOX-SSF-0008)
- `sync_from_ssf` implementieren
- Beta-Gates auf diese Unlock-Keys verdrahten
