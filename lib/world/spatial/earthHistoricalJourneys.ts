/**
 * Canonical literary journey graph for Bayt al-Mîrâ.
 *
 * This is narrative chronology, not a modern routing graph. It must not be used
 * to infer present-day roads, sailing routes, travel times or transport availability.
 */
export type EarthHistoricalJourneyStop = {
  id: string
  landmarkId: string
  label: string
  phase: 'prolog' | 'station'
  station?: number
  years: string
  theme: string
}

export type EarthHistoricalJourneyLeg = {
  from: string
  to: string
  relation: 'narrative-sequence'
}

export type EarthHistoricalJourney = {
  id: string
  name: string
  sourceProject: string
  stops: readonly EarthHistoricalJourneyStop[]
  legs: readonly EarthHistoricalJourneyLeg[]
}

export const BAYT_AL_MIRA_JOURNEY: EarthHistoricalJourney = {
  id: 'earth-historical-journey-bayt-al-mira',
  name: 'Bayt al-Mîrâ · Vermessungsreisen 1074–1110',
  sourceProject: 'Bayt al-Mîrâ / al-Qiyās wa-l-Ṣabr',
  stops: [
    { id: 'prolog-alexandria', landmarkId: 'earth-eg-alexandria', label: 'Alexandria', phase: 'prolog', years: '1074', theme: 'Die Anomalie' },
    { id: 'station-1-cyrene', landmarkId: 'earth-ly-cyrene', label: 'Kyrene', phase: 'station', station: 1, years: '1075–1076', theme: 'Methode · erster Konflikt' },
    { id: 'station-2-carthage-tunis', landmarkId: 'earth-tn-carthage-tunis', label: 'Karthago / Tunis', phase: 'station', station: 2, years: '1078–1080', theme: 'Übersetzung · Safias Geburt' },
    { id: 'station-3-palermo', landmarkId: 'earth-it-palermo', label: 'Palermo / Sizilien', phase: 'station', station: 3, years: '1082–1084', theme: 'Systematische Abweichung' },
    { id: 'station-4-malta', landmarkId: 'earth-mt-hal-saflieni', label: 'Malta', phase: 'station', station: 4, years: '1086–1087', theme: 'Ruhepunkt · Vorahnung' },
    { id: 'station-5-crete', landmarkId: 'earth-gr-phaistos', label: 'Kreta', phase: 'station', station: 5, years: '1090–1092', theme: 'Dimitra · Benennung · Wendepunkt' },
    { id: 'station-6-cyprus', landmarkId: 'earth-cy-cyprus', label: 'Zypern', phase: 'station', station: 6, years: '1094–1096', theme: 'al-Qiyās ṣabr · Kreuzzug' },
    { id: 'station-7-rhodes', landmarkId: 'earth-gr-rhodes', label: 'Rhodos', phase: 'station', station: 7, years: '1099–1101', theme: 'Jerusalem · Khalid · al-mafqūd al-qadīm' },
    { id: 'station-8-alexandria', landmarkId: 'earth-eg-alexandria', label: 'Alexandria', phase: 'station', station: 8, years: '1103–1106', theme: 'Rückkehr · Maryam · Komposition' },
    { id: 'station-9-tripolitania', landmarkId: 'earth-ly-tripolitania', label: 'Tripolitanien', phase: 'station', station: 9, years: '1108–1110', theme: 'Letzte Reise · Tod' },
  ],
  legs: [
    ['prolog-alexandria', 'station-1-cyrene'],
    ['station-1-cyrene', 'station-2-carthage-tunis'],
    ['station-2-carthage-tunis', 'station-3-palermo'],
    ['station-3-palermo', 'station-4-malta'],
    ['station-4-malta', 'station-5-crete'],
    ['station-5-crete', 'station-6-cyprus'],
    ['station-6-cyprus', 'station-7-rhodes'],
    ['station-7-rhodes', 'station-8-alexandria'],
    ['station-8-alexandria', 'station-9-tripolitania'],
  ].map(([from, to]) => ({ from, to, relation: 'narrative-sequence' as const })),
}
