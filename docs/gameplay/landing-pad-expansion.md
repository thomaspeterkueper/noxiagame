# Landing Pad — erweiterbares Gebäude

**Status:** Design-/Domänenvorbereitung  
**Datum:** 01.09.2026  
**Scope:** NOXIA Gameplay und Runtime-State  
**Nicht Scope:** Gebäude-/Tile-Grafik, Sprites, Asset-Dateien, OTA-Kanon

## Ziel

Der Raumhafen dient als erster Kandidat für das erweiterbare Gebäudemodell. Der Basistyp `landing_pad` bleibt eine normale Gebäudeinstanz. Zusätzliche Infrastruktur wird als adressierbares Kind derselben Instanz modelliert und nicht als unsichtbares Gebäude-Level.

```text
landing_pad (Basisinstanz)
  ├─ optional: weiteres Landing Pad
  ├─ optional: Frachtlager
  └─ optional: Terminal
```

## Persistenzpfad

NOXIA besitzt bereits die benötigten Beziehungen:

```text
player_builds.parent_id + slot
        ↓ Bau abgeschlossen
 tile_entities.parent_id + slot
        ↓
 buildingExpansions-Domänenprojektion
        ↓
 strategische Ansicht / Overlay / persönliche Ansicht
```

Es wird dafür keine separate Expansion-Tabelle eingeführt.

## Identitätsregel

- Die Basisinstanz besitzt eine normale `tile_entities.id`.
- Eine Erweiterung besitzt eine eigene `tile_entities.id`.
- `parent_id` der Erweiterung zeigt auf die konkrete Basisinstanz, nicht nur auf den Gebäudetyp.
- `slot` erlaubt stabile adressierbare Ausbaupositionen, ist aber keine visuelle Koordinate.
- `entity_id` der Kindinstanz muss einem registrierten NOXIA-Expansionstyp entsprechen, bevor die Domänenprojektion sie als Erweiterung akzeptiert.

## Lifecycle

```text
geplant
→ Build-Auftrag in player_builds
→ status=building
→ Abschluss
→ child tile_entity mit parent_id
→ status=active
→ wirkt im Gameplay
→ wird in allen Sichten projiziert
```

Ein Renderer darf diesen Lifecycle nicht abkürzen und keine fehlenden Module ergänzen.

## Erste drei Kandidaten

### Zusätzliches Landing Pad

Zielwirkung: zusätzliche reale Dock-/Landing-Kapazität. Noch **nicht baubar**, solange die Kapazitätsprüfung im Reise-/Docking-Gameplay nicht ausgewertet wird.

### Frachtlager

Zielwirkung: reale Lager-/Umschlagfunktion des Raumhafens. Noch **nicht baubar**, solange die bestehende Waren-/Lagerlogik keine konkrete Wirkung dafür besitzt.

### Terminal

Zielwirkung: reale Verkehrs-/Crew-/Passagierfunktion. Noch **nicht baubar**, solange es lediglich eine sichtbare Innenraumkomponente wäre.

Damit gilt weiterhin die Gebäuderegel: keine leeren Hülsen.

## Projektion

Die persönliche Ansicht darf später beispielsweise ein zweites Pad anzeigen, wenn und nur wenn eine aktive Kindinstanz dafür im Weltzustand vorhanden ist. Die konkrete grafische Ausgestaltung ist bewusst nicht Teil dieser Spezifikation und bleibt dem Grafik-/Asset-Workflow vorbehalten.

## Nächster Aktivierungsschritt

Als erste echte Erweiterung sollte `zusätzliches Landing Pad` gewählt werden, sobald die Dock-/Landing-Kapazität im Gameplay serverseitig ausgewertet wird. Dann werden erst:

1. stabiler lokaler Expansion-Key,
2. Kosten und Bauzeit,
3. Kapazitätseffekt,
4. Build-Prerequisites,
5. persistenter Build-Lifecycle

in den baubaren Katalog übernommen.

Bis dahin bleiben alle drei Kandidaten Designwissen und werden nicht als aktive `BUILDING_EXPANSIONS` registriert.
