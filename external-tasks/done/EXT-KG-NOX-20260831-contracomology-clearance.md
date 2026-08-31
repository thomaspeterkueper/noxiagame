# EXT-KG-NOX-20260831 — Contracomology: KG clearance for NOXIA evaluation

Source: `SYS:KUEPER:knowledge-graph`  
Target: `SYS:KUEPER:noxia`  
Status: done  
Priority: high  
Created: 2026-08-31  
Completed: 2026-08-31

## Ergebnis NOXIA

Die KG-Freigabe wurde angenommen. NOXIA verwendet als stabile Wissensreferenz ausschließlich `KD:KON:N1`; eine lokale dauerhafte SSF-Modul-/Path-ID wurde nicht erfunden.

Freigegebene KG-Referenzen:
- `CON:L1:zeitform`
- `CON:L1:avi-punkt`
- `CON:L1:oem`
- `CON:L1:paradigma-1`
- `CON:L1:paradigma-2`
- `CON:L1:paradigma-3`

## NOXIA-Entscheidung zur Spielwirkung

Contracomology wird **nicht** als pauschaler Moral-/Produktivitaetsbonus modelliert. Die Kompetenz wirkt situationsgebunden bei:

- Langzeitmissionen,
- Kommunikationsverzoegerung und Kommunikationsstille,
- hoher Isolation,
- kulturell heterogenen Crews.

Erste NOXIA-eigene Wirkdimensionen:
- Stressresistenz,
- fruehere Konflikterkennung,
- kulturelle Orientierung,
- autonome Handlungsfaehigkeit bei verzögerter/fehlender Kommunikation.

Die Effekte bleiben bewusst moderat und ersetzen weder technische Redundanz noch Fuehrung oder psychologische Unterstuetzung.

## Umsetzung

`lib/game/crew/contracomology.ts` definiert die KG-Domain, freigegebenen Referenzen und ein konservatives erstes Balancingmodell fuer Langzeitmissionen.

Commit: `7e46fde`

## Verbleibende Abhaengigkeit

Der konkrete SSF-Academy-/Learning-Path-Identifier bleibt extern ausstehend. Bis SSF ihn liefert, bleibt `KD:KON:N1` die einzige dauerhafte Referenz in NOXIA.
