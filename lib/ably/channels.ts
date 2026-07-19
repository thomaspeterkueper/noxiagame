// lib/ably/channels.ts
// Erstellt:     19.07.2026
// Aktualisiert: 19.07.2026 — Kanonische Ably Channel-Namen für NOXIA
// Version:      1.1.0
//
// Alle Ably-Channels zentral definiert.
// Server published → Client subscribed.
//
// Channels:
//   noxia:prices          — Marktpreise aktualisiert (nach prices-Cron)
//   noxia:transactions    — Neue Transaktion (nach Kauf/Verkauf)
//   noxia:builds:{userId} — Bau/Verkauf fertig (user-spezifisch)
//   noxia:world           — Weltdaten (Bevölkerung, News)

export const ABLY_CHANNELS = {
  prices:       'noxia:prices',
  transactions: 'noxia:transactions',
  world:        'noxia:world',
  builds:       (userId: string) => `noxia:builds:${userId}`,
  dm:           (userId: string) => `noxia:dm:${userId}`,
} as const

export const ABLY_EVENTS = {
  prices:      { updated: 'prices.updated' },
  transaction: { new: 'transaction.new' },
  build:       { completed: 'build.completed', sold: 'build.sold' },
  world:       { updated: 'world.updated' },
  dm:          { message: 'dm.message' },
  chat:        { read: 'chat.read' },
} as const
