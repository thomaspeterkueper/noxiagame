# NOXIA-BUILD-0001 — Erweiterbare Gebäude als Weltzustand

**Datum:** 01.09.2026  
**Status:** Accepted  
**Scope:** NOXIA Gameplay / Gebäude / persönliche Ebene  
**Referenzen:** `docs/design/walkable-colony.md`, `docs/decisions/ADR-walkable-colony-architektur.md`, `docs/Spec-gebaeude-katalog.md`, `docs/Spec:_InfrastrukturProgression.md`

## Entscheidung

NOXIA-Gebäude sind langfristig keine starren Einzelobjekte mit bloßen Level-Zahlen. Ein Gebäude kann durch **reale, persistierte Erweiterungen** wachsen. Eine Erweiterung ist Weltzustand und muss auf Makro- und Mikroebene dieselbe Sache darstellen.

Beispiel Raumhafen:

```text
Landing Pad 1
+ Landing Pad 2
+ Frachtlager
+ Terminal
```

Auf der strategischen Ebene existieren diese Teile als gebaute Infrastruktur. In der persönlichen Ebene erscheinen genau die tatsächlich vorhandenen Teile. `Pad 2` darf nicht allein deshalb gerendert werden, weil eine Innenraumdefinition zwei Pads vorsieht.

## Invarianten

1. **Erweiterung statt Level-Magie.** Kapazität wächst bevorzugt durch nachvollziehbare Module/Anbauten. Ein unsichtbares `buildingLevel += 1` darf keine neue physische Infrastruktur vortäuschen.
2. **Persistenz vor Darstellung.** Eine Erweiterung erscheint erst, wenn der bestehende NOXIA-Weltzustand sie enthält.
3. **Eine Simulation, mehrere Sichten.** Makrogrid, Overlay und persönliche Ansicht projizieren denselben Zustand. Es gibt keinen separaten Interior-/Walkable-Ausbauzustand.
4. **Technische Wahrheit bleibt extern.** NOXIA definiert Kosten, Slots, Gameplay-Wirkung, Bauzeit und Progression. OTA/KG liefern technische Identität und Beziehungen, sobald entsprechende Mappings vorliegen. NOXIA erfindet dafür keine OTA-IDs.
5. **Keine leeren Erweiterungen.** Wie bei Gebäuden gilt: Ein Modul wird erst baubar, wenn es eine echte NOXIA-Funktion oder eine belastbare Weltzustandsfunktion besitzt.
6. **Topologie ist nicht Geometrie.** Strategische Tiles/Relationen bestimmen Existenz und Nachbarschaft; Innenraum-/Walkable-Geometrie darf daraus eine menschenlesbare lokale Szene ableiten.

## Modell

Die Gameplay-Definition eines Gebäudetyps darf künftig deklarieren, welche Erweiterungstypen grundsätzlich unterstützt werden. Die konkrete gebaute Erweiterung gehört jedoch in den Runtime-Weltzustand.

Minimaler Definitionstyp:

```ts
interface BuildingExpansionDef {
  id: string
  name: string
  description: string
  cost?: number
  buildTimeTicks?: number
  parentBuildingIds: string[]
  planned: boolean
  planHint?: string
}
```

Eine persistierte Instanz benötigt mindestens:

```ts
interface BuildingExpansionInstance {
  id: string
  parentEntityId: string
  expansionId: string
  profileId: string | null
  status: 'building' | 'active'
  slot?: number | null
}
```

## Persistenzentscheidung

Die Prüfung des bestehenden Schemas hat ergeben, dass **keine neue Expansion-Tabelle nötig ist**.

`public.tile_entities` besitzt bereits:

- `parent_id uuid references tile_entities(id) on delete cascade`
- `slot smallint`
- `condition`
- `status`

Damit kann eine gebaute Erweiterung als normale adressierbare `tile_entities`-Instanz persistiert werden, deren `parent_id` auf das Basisgebäude zeigt. `slot` kann die logische Ausbauposition innerhalb des Elterngebäudes tragen.

Der bestehende Bau-Lifecycle besitzt dieselbe Relation bereits in `public.player_builds`:

- `parent_id`
- `slot`
- `entity_ref`
- `status`

Damit ergibt sich ohne zweiten State-Store:

```text
player_builds
  parent_id + slot
       ↓ Fertigstellung
 tile_entities
  parent_id + slot
       ↓
 Makro-/Overlay-/Mikroprojektion
```

Eine neue Datenbankmigration wird **nicht** allein für das Erweiterungsmodell eingeführt. Falls später zusätzliche Constraints benötigt werden, erfolgt das als kleine Vorwärtsmigration auf der bestehenden Relation.

## Projektion in die persönliche Ebene

Innenräume erhalten keine erfundenen Ausbauzustände. Sichtbare Räume, Türen, Pads, Lagerbereiche und technische Komponenten werden aus dem vorhandenen Gebäude-/Erweiterungszustand abgeleitet.

```text
Weltzustand
  Gebäudeinstanz
  + tile_entities-Kinder über parent_id
  + Ressourcen
  + Schiffe
  + Population/Aktivität
        ↓
Building/Walkable Projection
        ↓
Räume, sichtbare Module, Personen, Engpässe, Interaktionspunkte
```

Der Renderer darf Layoutregeln besitzen. Er darf nicht entscheiden, dass eine Erweiterung existiert.

## Erste Kandidaten

- **Raumhafen:** zusätzliche Landing Pads, Terminal, Frachtlager.
- **Habitat:** zusätzliche Wohnmodule/Gemeinschaftsbereiche, sofern Gameplay-Kapazität real erweitert wird.
- **Mine:** Förder-/Lager-/Verarbeitungsanbauten nur wenn entsprechende Gameplay-Funktion implementiert ist.
- **Akademie:** Lern-/Forschungsbereiche nur wenn sie an reale Academy-/SSF-Funktionen gekoppelt sind.
- **Werft:** zusätzliche Montage-/Dockkapazität nur aus persistiertem Ausbauzustand.

Diese Liste definiert keine technischen OTA-Objekte und keine sofort baubaren Module.

## Konsequenz für bestehende Innenräume

`BuildingInterior.tsx` ist derzeit teilweise eine statische Raumprojektion. Aussagen oder sichtbare Komponenten ohne Weltzustandsgrundlage sind als Präsentationsplatzhalter zu behandeln und dürfen nicht als kanonischer Ausbau interpretiert werden.

Die schrittweise Umstellung erfolgt nach dem Scanner-Muster:

```text
Weltzustand → Projektion → Darstellung
```

Zuerst werden vorhandene echte Zustände verwendet. Erweiterungen werden erst sichtbar, sobald ihr persistierter Zustand implementiert ist.

## Code-Vertrag

`lib/game/buildingExpansions.ts` bildet die persistierten `tile_entities`-Kinder in einen storage-neutralen Gebäude-Projektionszustand ab. Der Katalog ist absichtlich leer, solange noch keine Erweiterung eine freigegebene Gameplay-Funktion besitzt.

## Abnahme für zukünftige Erweiterungen

Eine neue Gebäudeerweiterung ist fertig, wenn:

- sie eine reale Gameplay-Funktion besitzt,
- ihr Besitz/Bauzustand über den bestehenden NOXIA-State persistent ist,
- Makro- und Mikroansicht denselben Zustand verwenden,
- wiederholtes Laden keine Erweiterungen erzeugt oder verliert,
- ihre technische Provenienz nicht von NOXIA erfunden wird,
- Build/CI grün bleibt.
