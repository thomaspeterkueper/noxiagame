// lib/game/business/establishments.ts
// Aktualisiert: 26.10.2026 — Betriebe im Spiel aus realen Gewerbe-Orten: Funktion aus OSM-Tags, erfundener Name, Leistungen
// Version:      1.0.0
//
// Entscheidung (Thomas, 26.10.2026): Reale Gebäude bleiben reale Orte, aber die
// Firma darin ist im Spiel (um 2086) eine erfundene Nachfolgerin mit passender
// Funktion. Der reale Name bleibt nur als Kartenbeschriftung („heute laut OSM“),
// er wird nie zum Wirtschaftsakteur. Namen realer Personen (Praxen, Kanzleien)
// bekommen keinen Betrieb.

export type EstablishmentKind =
  | 'autohaus' | 'werkstatt' | 'tankstelle' | 'tierbedarf' | 'tierarzt'
  | 'baeckerei' | 'metzgerei' | 'supermarkt' | 'apotheke' | 'bank' | 'post'
  | 'baumarkt' | 'elektro' | 'moebel' | 'kleidung' | 'buchladen' | 'blumen' | 'fahrrad'
  | 'handwerk' | 'industrie' | 'buero' | 'hotel' | 'laden'

export type EstablishmentService = { id: string; label: string; note: string; available: boolean }

export type Establishment = {
  kind: EstablishmentKind
  /** Funktionsbezeichnung („Autowerkstatt“). */
  function: string
  /** Erfundener Name des Betriebs im Spiel. */
  name: string
  /** Realer Name aus OSM – nur zur Kartenbeschriftung. */
  realName: string
  /** Raumart für den Innenraum. */
  room: 'shop' | 'workshop'
  staffRole: string
  services: EstablishmentService[]
}

type Tags = Record<string, unknown>
const t = (tags: Tags, key: string) => String(tags[key] ?? '').toLowerCase()

/** Praxen, Kanzleien und Ähnliches tragen meist Namen realer Personen – kein Betrieb. */
export function isPersonalPractice(tags: Tags) {
  const amenity = t(tags, 'amenity'), healthcare = t(tags, 'healthcare'), office = t(tags, 'office')
  if (/^(doctors|dentist|clinic|veterinary)$/.test(amenity) && amenity !== 'veterinary') return true
  if (healthcare && healthcare !== 'pharmacy') return true
  if (/^(lawyer|notary|tax_advisor|accountant|physician|therapist|architect)$/.test(office)) return true
  return /\b(dr\.|praxis|kanzlei|notar|rechtsanwalt|rechtsanwälte|steuerberat)\b/i.test(String(tags.name ?? ''))
}

export function establishmentKind(tags: Tags): EstablishmentKind | null {
  if (isPersonalPractice(tags)) return null
  const shop = t(tags, 'shop'), amenity = t(tags, 'amenity'), craft = t(tags, 'craft'), office = t(tags, 'office')
  const building = t(tags, 'building'), tourism = t(tags, 'tourism')
  if (shop === 'car' || shop === 'motorcycle') return 'autohaus'
  if (shop === 'car_repair' || shop === 'tyres' || shop === 'car_parts' || /^(car|auto|motorcycle_repair)/.test(craft)) return 'werkstatt'
  if (amenity === 'fuel' || amenity === 'car_wash') return 'tankstelle'
  if (shop === 'pet' || shop === 'pet_grooming') return 'tierbedarf'
  if (amenity === 'veterinary') return 'tierarzt'
  if (shop === 'bakery' || shop === 'pastry' || shop === 'confectionery') return 'baeckerei'
  if (shop === 'butcher' || shop === 'seafood') return 'metzgerei'
  if (shop === 'supermarket' || shop === 'convenience' || shop === 'greengrocer' || shop === 'beverages' || shop === 'deli') return 'supermarkt'
  if (amenity === 'pharmacy' || shop === 'chemist') return 'apotheke'
  if (amenity === 'bank' || amenity === 'atm') return 'bank'
  if (amenity === 'post_office' || shop === 'copyshop') return 'post'
  if (shop === 'doityourself' || shop === 'hardware' || shop === 'garden_centre' || shop === 'paint') return 'baumarkt'
  if (shop === 'electronics' || shop === 'computer' || shop === 'mobile_phone' || shop === 'hifi') return 'elektro'
  if (shop === 'furniture' || shop === 'interior_decoration' || shop === 'kitchen' || shop === 'bed') return 'moebel'
  if (shop === 'clothes' || shop === 'shoes' || shop === 'boutique' || shop === 'fabric') return 'kleidung'
  if (shop === 'books' || shop === 'stationery' || shop === 'newsagent') return 'buchladen'
  if (shop === 'florist' || shop === 'garden_furniture') return 'blumen'
  if (shop === 'bicycle') return 'fahrrad'
  if (craft) return 'handwerk'
  if (tags.industrial || /^(industrial|manufacture|warehouse|factory)$/.test(building) || t(tags, 'landuse') === 'industrial') return 'industrie'
  if (office) return 'buero'
  if (tourism === 'hotel' || tourism === 'guest_house') return 'hotel'
  if (shop) return 'laden'
  return null
}

const FUNCTION: Record<EstablishmentKind, { label: string; room: 'shop' | 'workshop'; staff: string }> = {
  autohaus: { label: 'Autohaus', room: 'workshop', staff: 'Verkäufer(in)' },
  werkstatt: { label: 'Autowerkstatt', room: 'workshop', staff: 'Meister(in)' },
  tankstelle: { label: 'Tankstelle', room: 'shop', staff: 'Tankwart(in)' },
  tierbedarf: { label: 'Tierbedarf', room: 'shop', staff: 'Tierpfleger(in)' },
  tierarzt: { label: 'Tierarztpraxis', room: 'shop', staff: 'Tierarzt/-ärztin' },
  baeckerei: { label: 'Bäckerei', room: 'shop', staff: 'Bäcker(in)' },
  metzgerei: { label: 'Metzgerei', room: 'shop', staff: 'Metzger(in)' },
  supermarkt: { label: 'Markt', room: 'shop', staff: 'Marktleiter(in)' },
  apotheke: { label: 'Apotheke', room: 'shop', staff: 'Apotheker(in)' },
  bank: { label: 'Bankfiliale', room: 'shop', staff: 'Berater(in)' },
  post: { label: 'Poststelle', room: 'shop', staff: 'Schalterkraft' },
  baumarkt: { label: 'Baumarkt', room: 'shop', staff: 'Fachberater(in)' },
  elektro: { label: 'Elektrofachgeschäft', room: 'shop', staff: 'Techniker(in)' },
  moebel: { label: 'Möbelhaus', room: 'shop', staff: 'Einrichter(in)' },
  kleidung: { label: 'Bekleidung', room: 'shop', staff: 'Verkäufer(in)' },
  buchladen: { label: 'Buchhandlung', room: 'shop', staff: 'Buchhändler(in)' },
  blumen: { label: 'Blumenladen', room: 'shop', staff: 'Florist(in)' },
  fahrrad: { label: 'Fahrradladen', room: 'workshop', staff: 'Mechaniker(in)' },
  handwerk: { label: 'Handwerksbetrieb', room: 'workshop', staff: 'Meister(in)' },
  industrie: { label: 'Werk', room: 'workshop', staff: 'Schichtleiter(in)' },
  buero: { label: 'Büro', room: 'shop', staff: 'Sachbearbeiter(in)' },
  hotel: { label: 'Hotel', room: 'shop', staff: 'Rezeption' },
  laden: { label: 'Laden', room: 'shop', staff: 'Verkäufer(in)' },
}

/** Was man dort tun kann. `available: false` ist ehrlich: die Mechanik fehlt noch, die Person weiß das. */
export function establishmentServices(kind: EstablishmentKind): EstablishmentService[] {
  switch (kind) {
    case 'autohaus': return [{ id: 'car-buy', label: 'Fahrzeug kaufen', note: 'Kauf und Zulassung – Mechanik folgt', available: false }, { id: 'car-view', label: 'Fahrzeuge ansehen', note: 'Ausstellung', available: true }]
    case 'werkstatt': return [{ id: 'car-repair', label: 'Fahrzeug reparieren lassen', note: 'Reparatur und Wartung – Mechanik folgt', available: false }, { id: 'advice', label: 'Beratung', note: 'Was kaputt ist und was es kostet', available: true }]
    case 'tankstelle': return [{ id: 'fuel', label: 'Tanken', note: 'Mechanik folgt', available: false }, { id: 'snack', label: 'Kleinigkeit kaufen', note: 'Mechanik folgt', available: false }]
    case 'tierbedarf': return [{ id: 'pet-adopt', label: 'Haustier aussuchen', note: 'Vermittlung – Mechanik folgt', available: false }, { id: 'pet-supplies', label: 'Futter und Zubehör', note: 'Mechanik folgt', available: false }]
    case 'tierarzt': return [{ id: 'pet-care', label: 'Haustier behandeln lassen', note: 'braucht zuerst ein Haustier', available: false }]
    case 'baeckerei': case 'metzgerei': case 'supermarkt': return [{ id: 'food', label: 'Lebensmittel kaufen', note: 'Mechanik folgt – heute isst man im Lokal', available: false }]
    case 'apotheke': return [{ id: 'meds', label: 'Medikamente kaufen', note: 'Mechanik folgt', available: false }]
    case 'bank': return [{ id: 'bank', label: 'Konto und Kredit', note: 'über die NOXIA-Bank', available: true }]
    case 'post': return [{ id: 'parcel', label: 'Paket aufgeben', note: 'Mechanik folgt', available: false }]
    case 'fahrrad': return [{ id: 'bike', label: 'Fahrrad kaufen oder reparieren', note: 'Mechanik folgt', available: false }]
    case 'handwerk': case 'industrie': return [{ id: 'order', label: 'Auftrag vergeben', note: 'Mechanik folgt', available: false }, { id: 'tour', label: 'Betrieb ansehen', note: 'Führung', available: true }]
    case 'hotel': return [{ id: 'room', label: 'Zimmer nehmen', note: 'Mechanik folgt', available: false }]
    default: return [{ id: 'browse', label: 'Umsehen', note: 'Auslage', available: true }]
  }
}

function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const pick = <T,>(list: readonly T[], seed: number) => list[seed % list.length]

const REGION_WORDS = ['Röhrtal', 'Sorpe', 'Sauerland', 'Hochsauerland', 'Bergland', 'Talgrund', 'Waldrand']
const NAME_PARTS: Record<EstablishmentKind, readonly string[]> = {
  autohaus: ['Autohaus {R}', '{R} Mobil', 'Fahrzeughof {R}', '{S}-Garagen'],
  werkstatt: ['Werkstatt {R}', '{R} Kfz-Technik', 'Schrauberei {S}', '{R} Fahrzeugservice'],
  tankstelle: ['{R} Energiestation', 'Ladehof {S}', 'Station {R}'],
  tierbedarf: ['Tierhof {R}', '{R} Tier und Futter', 'Pfote und Feder {S}', 'Tierwelt {R}'],
  tierarzt: ['Tierklinik {R}', 'Tierpraxis am {S}'],
  baeckerei: ['Backhaus {R}', '{R} Brot', 'Ofenhaus {S}', 'Bäckerei am {S}'],
  metzgerei: ['Fleischerei {R}', '{R} Fleischwerk', 'Schlachterei am {S}'],
  supermarkt: ['{R} Markt', 'Nahkauf {S}', 'Vorratshaus {R}', 'Markthalle {R}'],
  apotheke: ['{R}-Apotheke', 'Apotheke am {S}', 'Sonnen-Apotheke {R}'],
  bank: ['{R} Kreditbank', 'Bankhaus {S}', 'Sparkontor {R}'],
  post: ['Poststelle {S}', '{R} Kurier', 'Paketpunkt {S}'],
  baumarkt: ['Bauhof {R}', '{R} Werkzeug und Holz', 'Baustoffe {S}'],
  elektro: ['{R} Elektronik', 'Stromwerk {S}', 'Elektro am {S}'],
  moebel: ['Möbelhaus {R}', '{R} Wohnen', 'Einrichtung {S}'],
  kleidung: ['Kleiderkammer {R}', '{R} Textil', 'Mode am {S}'],
  buchladen: ['Bücherstube {R}', '{R} Papier und Buch', 'Lesewerk {S}'],
  blumen: ['Blumenhaus {R}', '{R} Gärtnerei', 'Grün am {S}'],
  fahrrad: ['Radhaus {R}', '{R} Zweirad', 'Velo am {S}'],
  handwerk: ['{R} Handwerk', 'Werkhof {S}', '{R} Feinwerk', 'Manufaktur {S}'],
  industrie: ['{R} Feinwerk', '{R} Metallwerk', 'Werk {S}', '{R} Präzision', 'Fertigung {S}'],
  buero: ['Kontor {R}', '{R} Verwaltung', 'Büro am {S}'],
  hotel: ['Hotel {R}', 'Gasthof am {S}', '{R} Herberge'],
  laden: ['Laden am {S}', '{R} Warenhaus', 'Kaufhaus {R}'],
}

/** Erfundener Betriebsname, stabil je Ort und Quelle. {R}: Regionswort, {S}: Straßenwort aus addr:street. */
export function establishmentName(kind: EstablishmentKind, tags: Tags, sourceId: string) {
  const seed = hash(`${kind}:${sourceId}`)
  const street = String(tags['addr:street'] ?? '').replace(/(straße|strasse|weg|platz|gasse|ring|allee)$/i, '').trim()
  const streetWord = street.length >= 3 ? street : pick(['Markt', 'Hang', 'Bach', 'Tor'], seed >>> 3)
  const region = pick(REGION_WORDS, seed >>> 7)
  return pick(NAME_PARTS[kind], seed).replace('{R}', region).replace('{S}', streetWord)
}

export function establishmentFor(tags: Tags, sourceId: string): Establishment | null {
  const kind = establishmentKind(tags)
  if (!kind) return null
  const fn = FUNCTION[kind]
  return {
    kind,
    function: fn.label,
    name: establishmentName(kind, tags, sourceId),
    realName: String(tags.name ?? ''),
    room: fn.room,
    staffRole: fn.staff,
    services: establishmentServices(kind),
  }
}

/** Was die angestellte Person über ihren Betrieb weiß – für das Gespräch. */
export function establishmentKnowledge(e: Establishment, placeName: string) {
  const open = e.services.filter(service => service.available).map(service => service.label)
  const later = e.services.filter(service => !service.available).map(service => service.label)
  return [
    `Du arbeitest bei ${e.name}, ${e.function} in ${placeName}. Das Jahr ist 2086; der Betrieb ist eine Nachfolgerin dessen, was hier früher stand – über frühere Inhaber weißt du nichts und spekulierst nicht.`,
    open.length ? `Hier geht heute: ${open.join(', ')}.` : '',
    later.length ? `Noch nicht möglich (sag das ehrlich, wenn jemand danach fragt): ${later.join(', ')}.` : '',
  ].filter(Boolean)
}
