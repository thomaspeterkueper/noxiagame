import {
  MAX_PLACE_FACTS,
  MAX_PLACE_FACT_CHARS,
  compassDirection,
  placeKnowledgeFacts,
  roughDistance,
  splitPlaceLabel,
  type PlaceFeatureInput,
} from './placeKnowledge'

let failures = 0
const check = (ok: boolean, label: string) => { if (!ok) { failures++; console.error('FAIL: ' + label) } }

// Ausschnitt der importierten Kartendaten um das Café in Sundern (Stand 12.10.2026).
const f = (featureType: string, name: string, distanceM: number, placeKind: string | null = null): PlaceFeatureInput => ({ featureType, name, distanceM, placeKind })
const sundern: PlaceFeatureInput[] = [
  f('road', 'Hauptstraße', 93), f('road', 'Grünewaldstraße', 97), f('road', 'Schimmerlingshof', 118), f('road', 'Franz-Josef-Tigges-Platz', 130),
  f('building', 'St. Johannes', 322), f('waterway', 'Linnepe', 384), f('building', 'Hubertushalle', 389),
  f('industrial', 'Papierwerk Sundern GmbH', 408), f('building', 'Museum in der Kornbrennerei', 436),
  f('settlement', 'Sundern', 513, 'town'), f('building', 'Bahnhof Sundern (Sauerland)', 607),
  f('settlement', 'Selschede', 1628, 'hamlet'), f('settlement', 'Recklinghausen (Sauerland)', 2133, 'village'),
  f('farmland', 'Segelfluggelände Sundern-Seidfeld', 2785), f('forest', 'Papenloh', 2837), f('settlement', 'Bainghausen', 2989, 'village'),
  f('industrial', 'Wellpappen Tillmann', 3080), f('farmland', 'Wellpappen Tillmann', 3241), f('water', 'Sorpestalsperre', 3390),
  f('settlement', 'Selmecke · NOXIA-Referenzstandort', 2173, 'noxia_reference_site'),
]
const facts = placeKnowledgeFacts({
  placeLabel: 'Sundern, Hochsauerlandkreis, Nordrhein-Westfalen, 59846, Deutschland',
  features: sundern,
  buildings: [
    { typeId: 'school', name: 'Akademie', distanceM: 410, bearingDeg: 2 },
    { typeId: 'school', name: 'Akademie', distanceM: 2400, bearingDeg: 180 },
    { typeId: 'admin', name: 'Verwaltung', distanceM: 1240, bearingDeg: 95 },
    { typeId: 'road', name: 'Straße', distanceM: 20, bearingDeg: 0 },
    { typeId: 'bank', name: 'Bank', distanceM: 40, bearingDeg: 270 },
  ],
  landmarks: [{ name: 'Solar Science Foundation · Hauptsitz', locality: 'Sundern (Sauerland)', noxiaRole: 'Einzigartiger, nicht duplizierbarer Gründungs- und Hauptsitz der Solar Science Foundation auf der Erde.', distanceM: 280 }],
})

check(facts[0] === 'Dieser Ort gehört zu Sundern (Hochsauerlandkreis, Nordrhein-Westfalen, Deutschland)', 'place fact names town and region without postcode')
check(facts.includes('Selmecke ist ein NOXIA-Referenzstandort, ca. 2,2 km von hier'), 'reference site is NOXIA knowledge')
check(facts.includes('NOXIA am Ort: Bank (gleich nebenan), Akademie (ca. 400 m nördlich), Verwaltung (ca. 1,2 km östlich)'), 'NOXIA buildings: nearest of each kind with distance and direction, roads left out')
check(facts.some(x => x.startsWith('Solar Science Foundation · Hauptsitz (Sundern (Sauerland)): Einzigartiger')), 'canonical landmark with its NOXIA role')
check(facts.includes('Orte in der Umgebung: Selschede, Recklinghausen (Sauerland), Bainghausen'), 'surrounding places exclude the town itself and the reference site')
check(facts.includes('Gewässer in der Gegend: Linnepe, Sorpestalsperre'), 'waters nearest first')
check(facts.includes('Wald und Landschaft: Papenloh'), 'named forest')
check(facts.some(x => x.startsWith('Bekannte Plätze und Betriebe: St. Johannes, Hubertushalle, Papierwerk Sundern GmbH, Museum in der Kornbrennerei')), 'known places nearest first')
check(facts.filter(x => x.includes('Wellpappen Tillmann')).join('').split('Wellpappen Tillmann').length <= 2, 'a name is listed once')
check(facts.some(x => x.startsWith('Straßen in der Nähe: Hauptstraße, Grünewaldstraße')), 'streets nearest first')
check(facts.length <= MAX_PLACE_FACTS && facts.every(x => x.length > 0 && x.length <= MAX_PLACE_FACT_CHARS), 'place facts fit the pipeline limits')

check(placeKnowledgeFacts({ features: [], buildings: [], landmarks: [] }).length === 0, 'no data, no knowledge – nothing is invented')
check(placeKnowledgeFacts({ placeLabel: 'Lokaldetail 51.33745, 7.97975', features: [], buildings: [], landmarks: [] }).length === 0, 'a technical label is not a place name')
check(placeKnowledgeFacts({ features: [f('settlement', 'Gobabis', 300, 'town')], buildings: [], landmarks: [] })[0] === 'Dieser Ort gehört zu Gobabis', 'without a label the nearest town names the place')
const crowded = placeKnowledgeFacts({ placeLabel: 'A, B', features: Array.from({ length: 80 }, (_, i) => f('building', 'Ein ziemlich langer Gebäudename Nummer ' + i, i)), buildings: Array.from({ length: 30 }, (_, i) => ({ typeId: 't' + i, name: 'Einrichtung ' + i, distanceM: 100 * i + 100, bearingDeg: i * 30 })), landmarks: [] })
check(crowded.every(x => x.length <= MAX_PLACE_FACT_CHARS) && crowded.length <= MAX_PLACE_FACTS, 'crowded places are shortened, never cut mid-name')
check(crowded.every(x => !x.endsWith(',') && !x.endsWith('…')), 'lists end on a whole name')

check(splitPlaceLabel('Tingo María, Rupa-Rupa, Huánuco, 10131, Peru')?.within === 'Rupa-Rupa, Huánuco, Peru', 'postcode is dropped anywhere in the label')
check(compassDirection(0) === 'nördlich' && compassDirection(95) === 'östlich' && compassDirection(359) === 'nördlich' && compassDirection(-90) === 'westlich' && compassDirection(225) === 'südwestlich', 'compass directions')
check(roughDistance(40) === 'gleich nebenan' && roughDistance(410) === 'ca. 400 m' && roughDistance(1240) === 'ca. 1,2 km', 'distances are rough, not falsely exact')

if (failures > 0) throw new Error(`place knowledge: ${failures} checks failed`)
console.log('place knowledge checks passed\n' + facts.map(x => '  ' + x).join('\n'))
