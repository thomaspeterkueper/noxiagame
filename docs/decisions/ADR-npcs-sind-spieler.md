# ADR: NPCs sind Spieler mit Algorithmus

**Datum:** 20.07.2026
**Status:** Accepted
**Gilt für:** noxiagame, alle zukünftigen NOXIA-Features

## Entscheidung

NPCs sind keine Sonderfälle. Sie sind vollwertige Wirtschaftsakteure
im selben Kausalmodell wie menschliche Spieler.

## Implementierung

| Aspekt | Mensch | NPC |
|--------|--------|-----|
| `tile_entities.owner_class` | `PLAYER` | `CORPORATION` |
| `tile_entities.profile_id` | UUID des Users | `null` |
| `tile_entities.actor_id` | `null` | UUID des Actors |
| Darstellung im Grid | 🔴 Roter Rahmen | 🔴 Roter Rahmen |
| Name im Tooltip | `👤 McKnight` | `👤 Goibniu Co.` |
| Kaufen-Button | ✅ wenn asking_price | ❌ NPCs verkaufen nicht direkt |
| Entscheidungslogik | Menschlich | `decision_weights` in `actors.decision_weights` |
| Wirtschaftliche Wirkung | Identisch | Identisch |

## Warum

**Kausalität sichtbar, nie erklärt.** Spieler sehen dass "Goibniu Co."
immer mehr Minen baut wenn Metallpreise steigen. Sie können das Muster
erkennen — aber niemand erklärt ihnen dass das ein Algorithmus ist.

HeliosCorp kauft Metall auf Vorrat → Preis steigt → Spieler liefert mehr
→ HeliosCorp kauft weniger → Preis sinkt. Das ist dieselbe Kausalität
wie zwischen zwei menschlichen Spielern.

## Konsequenzen

- NPCs erscheinen in der Welt wie Spieler
- `npcBrain.ts` → `runNpcTick()` → gleiche DB-Writes wie Spieler-Actions
- Kein "NPC-Tab", kein "NPC-Overlay" — NPCs sind einfach da
- KI/Flavor-Text für NPC-Dialoge ist möglich aber optional
- `actors.bio_short` kann Lore enthalten — nicht als Mechanik-Erklärung

## Aktive NPCs (Alpha)

| Name | Rolle | Standort |
|------|-------|---------|
| HeliosCorp | Akkumulator (kauft Metall + Energie) | Alle |
| Goibniu Co. | Produzent (Metall) | Mond |
| Belenus AG | Produzent (Energie) | Mars |

## Verwandte ADRs

- `ADR-terrain-vs-entity.md` — Terrain vs. Entity
- `ADR-progressive-disclosure.md` — Features sichtbar aber gesperrt
