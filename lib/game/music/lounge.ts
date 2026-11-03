// lib/game/music/lounge.ts
// Lounge-Musik für Café und Bar (Thomas, 03.11.2026). Die Titel liegen in public/audio/lounge/;
// ein neuer Titel kommt hier mit Dateiname und Titel in die Liste, sonst nichts.
export type LoungeTrack = { file: string; title: string }

export const LOUNGE_TRACKS: readonly LoungeTrack[] = [
  // { file: 'lounge-01.mp3', title: 'Titel' },
]

export const loungeUrl = (track: LoungeTrack) => '/audio/lounge/' + track.file

/** Nächster Titel: nie derselbe zweimal hintereinander, sonst im Wechsel durch den Zufall. */
export function nextLoungeIndex(count: number, previous: number | null, random = Math.random): number {
  if (count <= 1) return 0
  let next = Math.floor(random() * count)
  if (next === previous) next = (next + 1) % count
  return next
}
