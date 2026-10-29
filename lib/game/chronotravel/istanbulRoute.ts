/**
 * ChronoTravel Istanbul — research itinerary (not playable 3D locations).
 * Geolocation anchors are approximate visitor orientation points, not excavation measurements.
 * Sources describe the historical sites, not precise geometry or every proposed visit year.
 */
export const ISTANBUL_RESEARCH_SOURCES = [
  'https://whc.unesco.org/en/list/356/',
  'https://istanbul.ktb.gov.tr/EN-284696/historical-peninsula.html',
]

export const ISTANBUL_STOPS = [
  { id:'hippodrome', name:'Hippodrom / Atmeydanı', placeId:'earth-istanbul-hippodrome', eras:[550,1200,1700], status:'prototype', sceneIds:['hippodrome-550','hippodrome-1200','hippodrome-1700'] },
  { id:'hagia-sophia', name:'Hagia Sophia', placeId:'earth-istanbul-hagia-sophia', eras:[550,1200,1700], status:'research', sceneIds:[] },
  { id:'basilica-cistern', name:'Basilika-Zisterne', placeId:'earth-istanbul-basilica-cistern', eras:[550,1200,1700], status:'research', sceneIds:[] },
  { id:'topkapi', name:'Topkapı-Palast', placeId:'earth-istanbul-topkapi', eras:[1700], status:'research', sceneIds:[] },
  { id:'suleymaniye', name:'Süleymaniye', placeId:'earth-istanbul-suleymaniye', eras:[1700], status:'research', sceneIds:[] },
  { id:'theodosian-walls', name:'Theodosianische Landmauer', placeId:'earth-istanbul-theodosian-walls', eras:[550,1200,1700], status:'research', sceneIds:[] },
] as const

export function availableIstanbulScenes() {
  return ISTANBUL_STOPS.flatMap(stop => stop.sceneIds)
}
