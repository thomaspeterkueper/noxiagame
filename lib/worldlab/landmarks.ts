// lib/worldlab/landmarks.ts
// Namen der Wahrzeichen-Arten und Steckbrief für die Weltkarte.
// Gleiche Bezeichnungen wie in der begehbaren Erdszene (dort nicht exportiert).

const LANDMARK_LABEL: Record<string, string> = {
  library: 'Bibliothek', place_of_worship: 'Gotteshaus', museum: 'Museum', gallery: 'Galerie', attraction: 'Sehenswürdigkeit',
  viewpoint: 'Aussichtspunkt', castle: 'Burg / Schloss', fort: 'Festung', city_gate: 'Stadttor', ruins: 'Ruine',
  archaeological_site: 'Ausgrabungsstätte', monument: 'Denkmal', memorial: 'Gedenkstätte', university: 'Universität',
  townhall: 'Rathaus', theatre: 'Theater', arts_centre: 'Kulturzentrum', hospital: 'Krankenhaus', station: 'Bahnhof',
  tower: 'Turm', lighthouse: 'Leuchtturm', observatory: 'Sternwarte',
}

export function landmarkLabel(kind: string, tags?: Record<string, string>) {
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
    ['Konfession', tags.denomination],
    ['Erbaut', tags.start_date],
    ['Träger', tags.operator],
  ] as Array<[string, string | undefined]>).flatMap(([label, value]) => value ? [{ label, value }] : [])
}
