# Patch: StationTravelDock in DashboardClient einbinden

Der neue Component liegt bereits unter:

```ts
app/dashboard/StationTravelDock.tsx
```

## 1. Import ergänzen

In `app/dashboard/DashboardClient.tsx` nach `StationOverlay` ergänzen:

```ts
import StationTravelDock from './StationTravelDock'
```

## 2. Stations-Branch ersetzen

Aktuellen Block:

```tsx
{currentLocationData?.location_type === 'station' || location === 'prometheus' ? (
  <StationOverlay
    slug={location} name={currentLocationData?.name ?? 'Station'}
    population={currentLocationData?.population ?? 0} populationMax={currentLocationData?.population_max ?? 1}
    userId={userId} locationId={currentLocationData?.id ?? ''}
    locationResources={currentLocationData?.location_resources ?? []}
    credits={credits} entities={tileEntities.filter((e: any) => e.locations?.slug === location)}
    onChanged={async () => { await loadFromServer(); invalidate('builds') }}
    onOpenWarehouse={() => setWarehouseOpen(true)}
  />
) : (
```

ersetzen durch:

```tsx
{currentLocationData?.location_type === 'station' || location === 'prometheus' ? (
  <>
    <StationTravelDock
      currentLocation={location}
      locations={locations.filter((l: any) => l.slug !== location)}
      cargo={cargo as unknown as Record<string, number>}
      shipRange={shipRange}
      currentTick={stats?.tickNumber ?? 0}
      inTransit={inTransit}
      onTravel={handleTravel}
    />
    <StationOverlay
      slug={location} name={currentLocationData?.name ?? 'Station'}
      population={currentLocationData?.population ?? 0} populationMax={currentLocationData?.population_max ?? 1}
      userId={userId} locationId={currentLocationData?.id ?? ''}
      locationResources={currentLocationData?.location_resources ?? []}
      credits={credits} entities={tileEntities.filter((e: any) => e.locations?.slug === location)}
      onChanged={async () => { await loadFromServer(); invalidate('builds') }}
      onOpenWarehouse={() => setWarehouseOpen(true)}
    />
  </>
) : (
```

## Wirkung

- Auf Stationsansichten wie Prometheus erscheint oberhalb der Station ein Raumhafen-/Abflugblock.
- Ziele werden aus `locations` gezogen, nicht aus Besitz.
- Energiebedarf, Flugzeit und Reichweite werden angezeigt.
- Flugstart nutzt den bestehenden `handleTravel`/`travel`-Flow.

## Danach

Nächster Schritt: `ships?action=activate&shipId=...` ergänzen, damit mehrere Schiffe sauber ausgewählt werden können.
