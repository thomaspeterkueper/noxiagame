# Patch: Pilot-Kompetenz aus `profile.flight_count` lesen

Serverseitig ist umgesetzt:

- Migration: `profiles.flight_count integer not null default 0`
- Erfolgreicher `travel` erhöht `profiles.flight_count`
- `/api/game/profile` liefert `flight_count`

## DashboardClient ändern

In `app/dashboard/DashboardClient.tsx` aktuell:

```ts
const trades = td.trades ?? []
setPlayerStats({
  trades: trades.length,
  flights: trades.filter((t: any) => t.from_location !== t.to_location).length,
  knowledge: kd.knowledge_points ?? 0,
})
```

ersetzen durch:

```ts
const trades = td.trades ?? []
setPlayerStats({
  trades: trades.length,
  flights: pd.profile?.flight_count ?? 0,
  knowledge: kd.knowledge_points ?? 0,
})
```

## Grund

Flüge sind keine Handelsereignisse. Das Dashboard soll nur einen fertigen Wert anzeigen und keine Pilot-Kompetenz aus `trade_transactions` ableiten.
