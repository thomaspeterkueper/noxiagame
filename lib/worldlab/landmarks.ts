// lib/worldlab/landmarks.ts
// Namen der Wahrzeichen-Arten und Steckbrief für die Weltkarte.
// Gleiche Bezeichnungen wie in der begehbaren Erdszene (dort nicht exportiert).

const LANDMARK_LABEL: Record<string, string> = {
  library: 'Bibliothek', place_of_worship: 'Gotteshaus', museum: 'Museum', gallery: 'Galerie', attraction: 'Sehenswürdigkeit',
  viewpoint: 'Aussichtspunkt', castle: 'Burg / Schloss', fort: 'Festung', city_gate: 'Stadttor', ruins: 'Ruine',
  archaeological_site: 'Ausgrabungsstätte', monument: 'Denkmal', memorial: 'Gedenkstätte', university: 'Universität',
  townhall: 'Rathaus', theatre: 'Theater', arts_centre: 'Kulturzentrum', hospital: 'Krankenhaus', station: 'Bahnhof',
  tower: 'Turm', lighthouse: 'Leuchtturm', observatory: 'Sternwarte',
  community_centre: 'Gemeindezentrum', artlounge: 'Kultur · ArtLounge',
  resonance_place: 'Omnizedenz-Begegnungsstätte',
}

// Läden und Lokale (feature_type 'poi')
const SHOP_LABEL: Record<string, string> = {
  bakery: 'Bäckerei', butcher: 'Metzgerei', supermarket: 'Supermarkt', convenience: 'Kiosk', kiosk: 'Kiosk', clothes: 'Bekleidung', shoes: 'Schuhe',
  hairdresser: 'Friseur', florist: 'Blumen', optician: 'Optiker', chemist: 'Drogerie', books: 'Buchhandlung', car: 'Autohaus', car_repair: 'Werkstatt',
  hardware: 'Baumarkt', doityourself: 'Baumarkt', furniture: 'Möbel', electronics: 'Elektronik', beverages: 'Getränke', jewelry: 'Schmuck', beauty: 'Kosmetik',
  bicycle: 'Fahrräder', gift: 'Geschenke', pet: 'Tierbedarf', toys: 'Spielwaren', funeral_directors: 'Bestatter', travel_agency: 'Reisebüro', tobacco: 'Tabak',
}
const POI_LABEL: Record<string, string> = {
  cafe: 'Café', restaurant: 'Restaurant', bar: 'Bar', pub: 'Kneipe', biergarten: 'Biergarten', fast_food: 'Imbiss', ice_cream: 'Eiscafé', bank: 'Bank',
  pharmacy: 'Apotheke', post_office: 'Post', doctors: 'Arztpraxis', dentist: 'Zahnarzt', fuel: 'Tankstelle', cinema: 'Kino', kindergarten: 'Kindergarten',
  school: 'Schule', hotel: 'Hotel', guest_house: 'Pension', craft: 'Handwerk', office: 'Büro', shop: 'Laden',
}

export function landmarkLabel(kind: string, tags?: Record<string, string>) {
  if (kind === 'shop') return SHOP_LABEL[tags?.shop ?? ''] ?? 'Laden'
  if (POI_LABEL[kind]) return POI_LABEL[kind]
  if (kind === 'place_of_worship') {
    const religion = tags?.religion ?? ''
    return religion === 'christian' ? 'Kirche' : religion === 'muslim' ? 'Moschee' : religion === 'jewish' ? 'Synagoge' : religion === 'buddhist' || religion === 'hindu' ? 'Tempel' : 'Gotteshaus'
  }
  return LANDMARK_LABEL[kind] ?? 'Wahrzeichen'
}

/** Steckbrief aus den Kartendaten: nur, was bekannt ist. */
export function landmarkFacts(tags: Record<string, string>) {
  return ([
    ['Adresse', [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')],
    ['Geöffnet', tags.opening_hours],
    ['Küche', tags.cuisine?.replace(/_/g, ' ').replace(/;/g, ', ')],
    ['Konfession', tags.denomination],
    ['Erbaut', tags.start_date],
    ['Träger', tags.operator],
  ] as Array<[string, string | undefined]>).flatMap(([label, value]) => value ? [{ label, value }] : [])
}
