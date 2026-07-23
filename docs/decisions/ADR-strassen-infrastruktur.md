# ADR: Straßen sind Infrastruktur, nicht Terrain

**Datum:** 20.07.2026
**Status:** Accepted
**Gate:** Keine Erweiterung der Walkable Colony über Vertical Slice hinaus
          bevor Straßen persistenter Weltzustand sind.

---

## Aktueller Stand (provisorisch)

Straßen werden in `generateGrid()` deterministisch aus `population >= 200`
berechnet — rein visuell, keine DB-Existenz.

**Das ist falsch. Straßen sind Infrastruktur.**

Aber: Für den Vertical Slice wird dieser Zustand toleriert.

---

## Adapter-Invariante (Phase B)

```typescript
// Die einzige erlaubte Schnittstelle zur Straßen-Abfrage:
getStreetTiles(locationSlug: string): StreetTile[]
```

**Heute:** Intern ruft das `generateGrid()` auf.
**Nach A':** Intern liest das `tile_entities WHERE entity_id = 'road'`.

Die Walkable Colony kennt nur:
> Welche Straßen existieren an diesem Ort?

Nicht:
> Wie werden Straßen technisch erzeugt?

Keine direkte Abhängigkeit von `generateGrid()` in der Mikro-Ebene.
Keine eigene Straßengenerierung.
Keine zweite Wahrheit.

---

## Konzeptionelle Neudefinition (sofort wirksam)

Ab sofort gilt:

> Straßen sind Infrastruktur deren Persistenzmodell noch nicht migriert wurde.

Nicht mehr:
> Straßen sind Terrain.

---

## Migration A' (nach erfolgreichem Vertical Slice)

**Nicht** Option A (Cron legt Straßen bei population >= 200 an).

**Option A':**
```
Bedarf entsteht (Bevölkerungsdichte, Gebäude-Cluster)
    ↓
Akteur entscheidet (STATE automatisch, später Spieler/NPC)
    ↓
Straßenbau wird ausgelöst (Bauzeit + Kosten)
    ↓
tile_entity 'road' entsteht
```

Der Akteur ist anfangs `owner_class = STATE`, handelt automatisiert.
Aber die Straße entsteht aus einer **Bauentscheidung**, nicht direkt
aus einer Bevölkerungsschwelle.

---

## Warum A' wichtig ist

Nur mit persistenten Straßen entstehen emergente Situationen:

- **Stadt die zu schnell wächst:** Infrastruktur hinkt hinterher
- **Unterfinanzierte Infrastruktur:** Straßen nicht gebaut weil kein Budget
- **Private Straßen:** HeliosCorp baut Zufahrt zur eigenen Mine
- **Kapazitätsengpässe:** Zu viel Verkehr auf zu wenig Straße
- **Wartung:** Straßen altern (built_at bereits erfasst)
- **Grundstückswert:** Nähe zu Straße = höherer Wert

---

## Gate

> Keine Erweiterung der Walkable Colony über den Vertical Slice hinaus,
> bevor Straßen persistenter Weltzustand sind.

Sobald NPCs Wege benutzen, Grundstücke an Straßen Wert gewinnen
oder Verkehrskapazität relevant wird, ist `generateGrid()` als
Quelle nicht mehr tragfähig.
