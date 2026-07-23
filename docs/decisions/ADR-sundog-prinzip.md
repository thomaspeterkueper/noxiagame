# ADR: SunDog-Prinzip — Persönliche Entsprechung jeder strategischen Ebene

**Datum:** 20.07.2026
**Status:** Accepted — Implementation schrittweise
**Referenz:** SunDog: Frozen Legacy (FTL Software, 1984, Atari ST)

---

## Kernprinzip

> Jede strategische Ebene besitzt grundsätzlich eine persönliche Entsprechung.

NOXIA bleibt eine Wirtschaftssimulation. Aber der Spieler hat eine Figur
die er jederzeit in die von ihm geschaffene Welt hinuntersteigen lassen kann.

**Nicht:** NOXIA wird ein RPG.
**Sondern:** Die Makrosimulation bekommt eine menschliche Maßstabsebene.

---

## Maßstab-Hierarchie (5 Ebenen)

```
Ebene 1 — SONNENSYSTEM
  Orbital-Karte, Reisezeiten, Himmelskörper
  Persönliche Entsprechung: Cockpit-Ansicht beim Fliegen

Ebene 2 — HIMMELSKÖRPER / ORBIT
  Planetenkarte, Stationsgürtel, Umlaufbahnen
  Persönliche Entsprechung: Schiffsbrücke, Außenkamera

Ebene 3 — KOLONIE / STATION
  32×24-Grid (strategisch), Bevölkerung, Ressourcen
  Persönliche Entsprechung: Kolonieansicht (Top-Down, begehbar)
  Figur bewegt sich durch Straßen, sieht Gebäude die sie selbst gebaut hat

Ebene 4 — GEBÄUDE / RAUM
  Tile auf dem Grid (strategisch: Mine, Habitat, Bank...)
  Persönliche Entsprechung: Innenraum-Ansicht
  Händler, Werft-Terminal, NPC-Interaktion

Ebene 5 — SCHIFF
  Schiff-Inventar, Module (strategisch)
  Persönliche Entsprechung: Schiffsgrundtriss (Top-Down wie SunDog)
  Module physisch sichtbar, anklickbar, upgradebar
```

---

## Was das für den Spieler bedeutet

### Heute (Strategie-Only):
> Du baust Habitat +1.
> population_max += 100

### Mit SunDog-Prinzip:
> Du baust Habitat +1.
> Später läufst du durch das Viertel. Das Habitat steht dort.
> Du siehst Menschen die dort wohnen.
> Wenn du es verkaufst, sind diese Menschen obdachlos.

### Heute:
> HeliosCorp kauft Metall. Preis steigt.

### Mit SunDog-Prinzip:
> Du läufst durch den Raumhafen.
> Ein HeliosCorp-Frachter lädt gerade Metallcontainer.
> Du verstehst warum der Preis gestiegen ist.

---

## NPC-Darstellung

**Nicht:** 500 zufällig herumwandernde Sprites (Performance-Desaster)

**Sondern:** Deterministische Projektion des Weltzustands:

```
Mira Chen — Ingenieurin, Werft Mond/Shackleton
  Wohnort: Habitat-Block 17 (tile 8,14)
  Arbeit:  Werft-Terminal (tile 3,2)
  Routine: Aus Weltzustand berechnet (Schicht-System)

  07:40  verlässt Habitat → Transit
  07:51  betritt Werft-Terminal
  12:10  Kantine
  17:05  Heimweg
```

Nur sichtbare NPCs werden konkret dargestellt.
Außerhalb der Sichtweite: aggregiert im Weltzustand (Bevölkerungszahl).

**Konsequenz:** Wenn die Werft insolvent wird, ist Mira arbeitslos.
Der Spieler kennt Mira. Die abstrakte Wirtschaftsentscheidung
trifft jetzt jemanden den er gesehen hat.

---

## Technische Umsetzung (Top-Down, kein 3D)

### Referenz: SunDog Atari ST
- Top-Down-Ansicht, scrollbare 2D-Karte
- Figur als kleines Sprite, bewegt sich durch Räume
- Gebäude = klickbare Zonen → Innenraum öffnet sich
- Schiff = Grundriss, Module physisch anklickbar
- Kein 3D, keine Perspektive, keine Physik-Engine

### NOXIA-Umsetzung:
- **Canvas oder SVG** — kein Three.js, kein WebGL
- **Tile-basiert** — selbe Logik wie ColonyGrid, kleinere Tiles (z.B. 16px)
- **Figur:** 16×16px Sprite oder einfaches SVG-Icon
- **NPCs:** Deterministische Routinen aus Weltzustand berechnet
- **Gebäude-Innenräume:** Vordefinierte Layouts (Mine hat 3 Räume, Habitat hat Wohnbereiche...)

---

## Implementierungsplan

**Phase A — Schiff (Ebene 5):**
Schiffsgrundtiss Top-Down. Module als Zonen.
Klick auf Modul → Upgrade-Panel. Figur bewegt sich im Schiff.
→ Sofort wertvoll, kleines Scope.

**Phase B — Kolonie-Ansicht (Ebene 3):**
Figur betritt Kolonie-Ebene. Straßen, Gebäude begehbar.
Deterministische NPCs aus Bevölkerungszahl projiziert.
→ Das SunDog-Kernfeature für NOXIA.

**Phase C — Gebäude-Innenräume (Ebene 4):**
Werft, Bank, Markt — begehbare Innenräume.
NPC-Interaktion (Händler, Missionen, Lore).
→ Gibt Wirtschaftsentscheidungen menschliche Konsequenz.

**Phase D — Cockpit (Ebene 1):**
Flug-Sequenz mit Cockpit-View.
Instrumente live (Reisezeit, Energie, Cargo).
Sternenhintergrund animiert.
→ Atmosphäre ohne Engine-Aufwand.

---

## Was NOXIA-Core NICHT wird

- Kein First-Person-3D
- Kein Echtzeit-Kampfsystem
- Keine Quest-Ketten die den Wirtschaftsloop unterbrechen
- Keine Zufalls-NPC-Dialoge (KI-generiert erlaubt, aber optional)

Die **Simulation ist der Kern** — die persönliche Ebene ist
eine Linse durch die man sie betrachten kann, nicht ein zweites Spiel.

---

## Verwandte ADRs

- `ADR-npcs-sind-spieler.md` — NPCs im selben Kausalmodell
- `ADR-weltarchitektur-sonnensystem.md` — 5 Maßstab-Ebenen (Daten)
- `ADR-terrain-vs-entity.md` — Was ist Terrain, was ist Entity

---

## Warum SunDog 1984 das richtig gemacht hat

SunDog hatte neutrale Personen in Städten und Gebäuden.
Gespräche waren technisch primitiv.
Aber die Orte waren keine Menüs mehr.

Das ist der Trick: **Nicht die Komplexität der Interaktion,
sondern die physische Präsenz des Ortes.**

Du kaufst nicht 12t Fracht aus einem Menü.
Du landest. Du verlässt dein Schiff.
Du gehst durch die Stadt. Du betrittst den Händler.
Dort kaufst du die Fracht.
Dann musst du mit ihr zurück.

Der wirtschaftliche Vorgang bekommt einen Ort.
