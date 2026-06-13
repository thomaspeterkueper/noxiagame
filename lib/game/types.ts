// lib/game/types.ts
// Erstellt: 08.06.2026
// API-Vertrag: Response-Shapes aller Game-Routen an EINER Stelle.
// Server- und Client-Arbeit einigen sich auf dieses File und arbeiten
// danach unabhängig. Abgeleitet aus den echten Routen (Stand 08.06.).
//
// Konvention: Shapes sind das, was die Route per NextResponse.json zurückgibt.
// Fehlerantworten sind überall { error: string } mit passendem Status.

// ─── Gemeinsame Grundtypen ────────────────────────────────────────────────
export type ResourceType = 'water' | 'energy' | 'metal'
export type LocationSlug  = 'moon' | 'mars' | 'phobos'

export type EntityType = 'building' | 'vehicle' | 'specialist' | 'ship'
export type BuildableId = 'mine' | 'solar' | 'habitat'

export interface ApiError { error: string }

// ─── /api/game/world (GET, öffentlich) ──────────────────────────────────────
export interface LocationResource {
  resource:    ResourceType
  stock:       number
  production:  number
  consumption: number
}

export interface WorldLocation {
  id:                 string
  slug:               LocationSlug
  name:               string
  population:         number
  population_max:     number
  is_supplied:        boolean
  has_shipyard?:      boolean
  description?:       string
  location_resources: LocationResource[]
}

export interface WorldTransaction {
  profile_id:    string
  resource:      ResourceType
  amount:        number
  profit:        number
  from_location: string
  to_location:   string
  traded_at:     string
  profiles?:     { username: string } | null
  _count?:       number   // Anzahl zusammengefasster 1t-Buchungen
}

export interface WorldNews {
  type: 'danger' | 'warning' | 'success' | 'info'
  text: string
  icon: string
}

export interface WorldStats {
  totalPopulation:  number
  suppliedColonies: number
  totalColonies:    number
  tickNumber:       number
}

export interface WorldResponse {
  news:         WorldNews[]
  locations:    WorldLocation[]
  transactions: WorldTransaction[]
  stats:        WorldStats
}

// ─── /api/game/trade (GET, Bearer) ──────────────────────────────────────────
// (kein action) – Spielstand
export interface TradeStateResponse {
  credits:    number
  location:   LocationSlug
  cargoMax:   number
  cargo:      Record<ResourceType, number>
  shipId?:    string
  shipTypeId: string
}

// action=getTrades
export interface Trade {
  id:            string
  from_location: string
  to_location:   string
  resource:      ResourceType
  amount:        number
  profit:        number
  traded_at:     string
}
export interface GetTradesResponse { trades: Trade[] }

// action=buy | sell
export interface TradeResponse {
  ok:              true
  bookedAmount:    number          // tatsächlich gebucht (Teilbuchung)
  requestedAmount: number          // gewünscht
  unitPrice:       number          // Server-Preis, zu dem gebucht wurde
  taxCharged:      number          // erhobene Transaktionssteuer (Cr)
  taxRate:         number          // angewandter Satz 0.00–1.00
  priceUpdate:     { resource: ResourceType; buyPrice: number; sellPrice: number } | null
  credits:         number
  location:        LocationSlug
  cargoMax:        number
  cargo:           Record<ResourceType, number>
  shipId?:         string
  shipTypeId:      string
}

// action=travel
export interface TravelResponse { ok: true; location: LocationSlug }

// ─── /api/game/orders (GET, Bearer) ─────────────────────────────────────────
export interface TradeOrder {
  id:             string
  location_id:    string
  resource:       ResourceType
  amount:         number
  reward:         number           // Cr pro Tonne
  status:         'open' | 'fulfilled' | 'expired'
  expires_at:     string | null
  for_profile_id: string | null    // null = öffentlich, sonst persönlich
  fulfilled_by?:  string | null
  locations?:     { slug: LocationSlug; name: string }
}
export interface OrdersResponse { orders: TradeOrder[] }

// action=fulfill
export interface FulfillResponse {
  ok:         true
  reward:     number               // wirklich gebuchter Betrag
  baseReward: number               // Basiswert ohne Bonus
  newCredits: number
  newCargo:   Record<string, number>
}

// ─── /api/game/ships (GET, Bearer) ──────────────────────────────────────────
export interface ShipType {
  id:            string
  name?:         string
  cost_credits:  number
  cargo_max:     number
  speed_mult:    number
  available_at:  LocationSlug
}
export interface ShipsResponse {
  shipTypes:         ShipType[]
  currentShipTypeId: string
  currentLocation:   LocationSlug
}
export interface BuyShipResponse {
  ok:         true
  newCredits: number
  shipTypeId: string
  cargoMax:   number
  speedMult:  number
}

// ─── /api/game/build (GET, Bearer) ──────────────────────────────────────────
export interface TileEntity {
  id:          string
  profile_id:  string
  location_id: string
  tile_level:  number             // 0 | -1 | -2 | -3
  tile_row:    number
  tile_col:    number
  entity_type: EntityType
  entity_id:   string
  built_at:    string
  locations?:  { slug: LocationSlug; name: string }
}

export interface PlayerBuild {
  id:           string
  profile_id:   string
  buildable_id: BuildableId
  location_id:  string
  tile_level:   number
  tile_row:     number
  tile_col:     number
  status:       'building' | 'complete' | 'cancelled' | 'selling' | 'sold'
  completes_at: string
  sale_payout?: number | null
  locations?:   { slug: LocationSlug; name: string }
}

// (kein action) – laufende Vorgänge + eigener Bestand
export interface BuildStateResponse {
  builds:   PlayerBuild[]
  entities: TileEntity[]
}

// action=start
export interface BuildStartResponse {
  ok: true; newCredits: number; buildable: string; completesAt: string
}
// action=cancel
export interface BuildCancelResponse { ok: true; refund: number }

// action=sellQuote
export interface SaleQuote {
  ertragswert:     number
  rueckbau:        number
  umsiedlung:      number
  verdraengte:     number
  valueNormal:     number
  valueInstant:    number
  isStrandedAsset: boolean
}
export interface SellQuoteResponse { quote: SaleQuote; durationTicks: number }

// action=sell
export interface SellResponse {
  ok: true
  selling?:     boolean           // mode=normal: läuft N Ticks
  sold?:        boolean           // mode=instant: sofort
  payout:       number
  completesAt?: string
  mode:         'normal' | 'instant'
}

// ─── /api/game/profile (GET, Bearer) ────────────────────────────────────────
export interface Profile {
  id:        string
  username:  string | null
  avatar:    string | null
  onboarded: boolean
  credits:   number
}
export interface ProfileResponse { profile: Profile | null }
export interface ProfileSetupResponse { ok: true; username: string; avatar: string }
