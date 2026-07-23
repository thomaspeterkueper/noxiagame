# ADR: Walkable Colony — Architektur-Invarianten

**Datum:** 20.07.2026
**Status:** Accepted — gilt für alle Phase-B-Implementierungen
**Referenz:** docs/design/walkable-colony.md

---

## Invariante 1: Projektion, kein zweiter Weltzustand

> Die Mikroebene erfindet keinen zweiten Weltzustand.
> Sie projiziert den bestehenden Weltzustand in menschlichen Maßstab.

**Konkret:**
- Ein Frachter erscheint am Pad nur wenn `ships.location_id = pad.location_id`
- Ein Pad bleibt geschlossen wenn kein Landing Pad in `tile_entities`
- Eine Raumhafenerweiterung erscheint erst nach `tile_entities` INSERT
- Ein NPC steht in der Werft weil `npc_ledger` eine Werft-Aktivität zeigt
- Niemals: Mikroebene spawnt Objekte/Personen ohne Weltzustand-Referenz

**Verletzung dieser Invariante** = Dekorations-Trap.
Zwei Simulationen unterhalb der ersten.

---

## Invariante 2: Makro-Topologie ≠ Mikro-Geometrie

```
Makro-Tile (64×64px strategisch)
  ↓  referenziert, nicht kopiert
Mikro-Szene (eigene lokale Geometrie)
  ├─ Wege (aus Makro-Straßen abgeleitet, nicht identisch)
  ├─ Türen (Übergangs-Punkte)
  ├─ Personen (projiziert aus Weltzustand)
  ├─ Objekte (projiziert aus tile_entities)
  └─ Interaktionspunkte
```

Das 32×24-Grid ist die Topologie-Referenz:
- Welche Gebäude existieren wo
- Welche Tiles grenzen aneinander
- Welche Straßen verbinden welche Bereiche

Die Mikro-Szene hat eigene lokale Koordinaten.
400×400px = Render-Auflösung, keine Weltinvariante.

---

## Invariante 3: Vertical Slice zuerst

Phase B baut einen einzigen Pfad:

```
Habitat → Straße → Raumhafen-Gelände → Terminal → Landing Pad
```

**Fünf Prüfpunkte:**
1. Bewegung fühlt sich gut an
2. Makro-Geometrie bleibt wiedererkennbar
3. Gebäude haben plausiblen menschlichen Maßstab
4. Übergänge zwischen außen/innen funktionieren
5. Nur Dinge sichtbar die der Weltzustand hergibt

**Eine Frage:**
> Fühlt sich NOXIA anders an, sobald ich meine eigene Kolonie betreten kann?

Wenn Ja → Ausbau. Wenn Nein → Diagnose vor weiterem Ausbau.

---

## Was Phase B explizit NICHT ist

- Kein allgemeines Personenbewegungssystem
- Keine NPC-Tagesabläufe (kommt nach Slice-Validierung)
- Keine Innenraum-Simulation (Phase C)
- Keine Fahrzeuge
- Keine Dialoge (noch)
- Kein zweites Wirtschaftssystem

---

## Datenfluss

```
Supabase (Weltzustand)
  tile_entities     → welche Gebäude stehen wo
  ships             → welche Schiffe wo geparkt
  location_resources→ Lagerbestände
  actors            → NPC-Firmen + Aktivitäten
  npc_ledger        → was NPCs gerade tun
        ↓
  WalkableColonyRenderer (client-seitig)
        ↓
  Projektion: Makro-Tiles → Mikro-Szenen
        ↓
  Canvas/SVG: Figur, Gebäude, NPCs, Objekte
```

Keine eigene DB-Tabelle für Mikro-Zustand.
Kein Mikro-State-Store.
Alles read-only aus bestehendem Weltzustand.

---

## Stilprinzip

Wenn ein Objekt in der Mikro-Szene erscheint
und der Entwickler nicht sofort sagen kann
**welche Zeile in welcher Tabelle** es erzeugt hat —
ist es Dekoration und gehört nicht in Phase B.
