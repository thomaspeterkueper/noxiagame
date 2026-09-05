import { createServiceClient } from '@/lib/supabase/service'
import DashboardGate from './DashboardGate'
import DashboardPrimaryColony from './DashboardPrimaryColony'

export const revalidate = 30

async function getGameData() {
  const supabase = createServiceClient()
  const [{ data: locations }, { data: prices }, { data: orders }] = await Promise.all([
    supabase.from('locations').select('*, location_resources(resource, stock, consumption, production), has_shipyard').order('slug'),
    supabase.from('market_prices').select('*, locations(slug, name)').order('locations(slug)'),
    supabase.from('trade_orders').select('*, locations(slug, name)').eq('status', 'open').order('reward', { ascending: false }).limit(3),
  ])
  return { locations: locations ?? [], prices: prices ?? [], orders: orders ?? [] }
}

export default async function Dashboard() {
  const { locations, prices, orders } = await getGameData()
  return (
    <div className="noxia-dashboard-shell">
      <DashboardGate locations={locations} prices={prices} orders={orders} />
      <DashboardPrimaryColony />
      <style>{`
        /*
         * Map-first dashboard v3
         *
         * Die Weltkarte ist die primäre Arbeitsfläche. Dashboard-Informationen
         * reservieren keine dauerhaften Spalten mehr, sondern schweben als HUD
         * über der Karte. Terrain/Grid/Renderer bleiben bewusst außerhalb
         * dieser Schicht und können unabhängig ersetzt werden.
         */

        /* ── Globale Leiste ─────────────────────────────────────────────── */
        .noxia-dashboard-shell > div > header {
          height: 54px !important;
          padding-left: .9rem !important;
          padding-right: .9rem !important;
          background: rgba(250,249,246,.94) !important;
          backdrop-filter: blur(12px);
          box-shadow: 0 1px 10px rgba(27,39,51,.08) !important;
        }
        .noxia-dashboard-shell > div > header > div:first-child {
          gap: .65rem !important;
        }
        .noxia-dashboard-shell > div > header > div:last-child {
          gap: .8rem !important;
        }
        /* Globale Summenbevölkerung ist kein lokaler Kartenstatus. */
        .noxia-dashboard-shell > div > header > div:last-child > div:nth-child(4) {
          display: none !important;
        }

        /* Persönliche Kompetenzwerte können kompakt im Header ergänzt werden. */
        .noxia-profile-stats-compact {
          height: 32px;
          display: inline-flex;
          align-items: center;
          gap: .5rem;
          padding: 0 .55rem;
          border: 1px solid #dedbd4;
          border-radius: 8px;
          background: rgba(255,255,255,.82);
          color: #2a4e7a;
          cursor: pointer;
          font: 700 .67rem/1 system-ui, sans-serif;
          white-space: nowrap;
          backdrop-filter: blur(8px);
        }
        .noxia-profile-stats-compact:hover {
          border-color: #c9a961;
          background: #fff;
        }
        .noxia-profile-stats-compact span {
          display: inline-flex;
          align-items: center;
          gap: .2rem;
        }
        .noxia-profile-stats-compact b {
          font-size: .72rem;
          font-weight: 400;
        }

        /* ── Weltfläche ────────────────────────────────────────────────── */
        .noxia-dashboard-shell > div > header + div {
          display: block !important;
          position: relative !important;
          width: 100% !important;
          max-width: none !important;
          height: calc(100vh - 54px) !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child {
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          min-width: 0 !important;
          gap: 0 !important;
          overflow: hidden !important;
        }

        /* Das Legacy-/Planungsgrid nutzt ebenfalls den gesamten freien Raum.
           Die zukünftige Karte kann diese Fläche übernehmen, ohne das HUD zu
           verändern. */
        .noxia-dashboard-shell .grid-pan-container {
          width: 100% !important;
          max-height: calc(100vh - 54px) !important;
          min-height: calc(100vh - 54px) !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          border-bottom: 0 !important;
        }

        /* Kontexttipps nicht als breite Banner über die zentrale Karte legen.
           Einweisung und Feed bleiben die Informationskanäle. */
        .noxia-dashboard-shell > div > header + div > div:first-child > div:not(:has(.grid-pan-container)):has(button[title="Diesen Tipp nicht mehr anzeigen"]) {
          display: none !important;
        }

        /* Die alte ColonyGrid-Innenleiste wird zu einem kleinen Overlay. */
        .noxia-dashboard-shell div:has(> div > .grid-pan-container) {
          position: relative !important;
        }
        .noxia-dashboard-shell div:has(> .grid-pan-container) + div {
          position: absolute !important;
          z-index: 12 !important;
          top: 58px !important;
          right: 12px !important;
          width: 164px !important;
          max-height: none !important;
          overflow: visible !important;
          gap: 0 !important;
          pointer-events: none;
        }
        .noxia-dashboard-shell div:has(> .grid-pan-container) + div > div:first-child {
          display: block !important;
          padding: .5rem .6rem !important;
          background: rgba(250,249,246,.90) !important;
          border: 1px solid rgba(210,207,198,.82) !important;
          box-shadow: 0 8px 24px rgba(27,39,51,.13) !important;
          backdrop-filter: blur(10px);
        }
        .noxia-dashboard-shell div:has(> .grid-pan-container) + div > div:not(:first-child) {
          display: none !important;
        }

        /* ── Standort-Dock ─────────────────────────────────────────────── */
        /* Der Ortsblock ist der direkte linke Spalten-Block, dessen Kartenreihe
           flex-wrap verwendet. Dadurch funktioniert das Dock auch ohne Schiffe. */
        .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) {
          position: fixed !important;
          z-index: 1110 !important;
          left: 16px !important;
          bottom: 16px !important;
          width: min(720px, calc(100vw - 332px)) !important;
          margin: 0 !important;
          padding: .45rem .5rem .5rem !important;
          border: 1px solid rgba(218,214,204,.88);
          border-radius: 11px;
          background: rgba(250,249,246,.88);
          box-shadow: 0 10px 30px rgba(27,39,51,.15);
          backdrop-filter: blur(12px);
          pointer-events: auto;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) > div:first-child {
          margin: 0 0 .28rem .15rem !important;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) > div:last-child {
          display: flex !important;
          flex-wrap: nowrap !important;
          overflow-x: auto !important;
          gap: .35rem !important;
          scrollbar-width: none;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) > div:last-child::-webkit-scrollbar {
          display: none;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) > div:last-child > div {
          min-width: 112px !important;
          min-height: 44px !important;
          padding: .3rem .5rem .3rem 56px !important;
          border-radius: 7px !important;
          background: rgba(255,255,255,.84) !important;
        }
        .noxia-location-card-with-image {
          position: relative !important;
          overflow: hidden !important;
          isolation: isolate;
        }
        .noxia-location-thumb {
          position: absolute;
          z-index: -1;
          inset: 0 auto 0 0;
          width: 50px;
          overflow: hidden;
          border-right: 1px solid rgba(255,255,255,.72);
          background: #e8e4dc;
        }
        .noxia-location-thumb::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 55%, rgba(255,255,255,.34));
          pointer-events: none;
        }
        .noxia-location-thumb img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block;
        }

        /* Schiffsliste unter der Weltansicht ist redundant; aktives Schiff und
           Laderaum sind rechts als HUD-Fenster erreichbar. */
        .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="grid-template-columns"]) {
          display: none !important;
        }

        /* ── Rechte schwebende HUD-Fenster ─────────────────────────────── */
        .noxia-dashboard-shell > div > header + div > div:last-child {
          position: fixed !important;
          z-index: 1120 !important;
          top: 106px !important;
          right: 14px !important;
          width: 286px !important;
          height: auto !important;
          max-height: calc(100vh - 126px) !important;
          display: flex !important;
          flex-direction: column !important;
          gap: .5rem !important;
          pointer-events: none;
        }
        .noxia-dashboard-shell > div > header + div > div:last-child > div {
          pointer-events: auto;
          border-radius: 10px !important;
          background: rgba(250,249,246,.91) !important;
          border-color: rgba(214,211,202,.90) !important;
          box-shadow: 0 10px 28px rgba(27,39,51,.14) !important;
          backdrop-filter: blur(12px);
        }
        /* Profil bleibt als kleiner Spielerstatus sichtbar. */
        .noxia-dashboard-shell > div > header + div > div:last-child > div:first-child {
          display: block !important;
        }
        /* Dauerhafte SSF-Werbekarte entfällt; Akademie/Unlocks bleiben Kontext. */
        .noxia-dashboard-shell > div > header + div > div:last-child > div:nth-child(2) {
          display: none !important;
        }
        /* Laderaum bleibt kompakt, Feed erhält den flexiblen Rest. */
        .noxia-dashboard-shell > div > header + div > div:last-child > div:nth-child(3) {
          flex-shrink: 0 !important;
        }
        .noxia-dashboard-shell > div > header + div > div:last-child > div:last-child {
          flex: 1 1 auto !important;
          min-height: 96px !important;
          max-height: 240px !important;
          overflow-y: auto !important;
        }

        /* Im Root-Layout existiert bereits der rechtliche Footer. */
        .noxia-dashboard-shell > div > footer {
          display: none !important;
        }

        @media (max-width: 1450px) {
          .noxia-dashboard-shell > div > header > div:last-child {
            gap: .55rem !important;
          }
          .noxia-profile-stats-compact {
            gap: .3rem;
            padding: 0 .4rem;
          }
          .noxia-dashboard-shell > div > header + div > div:last-child {
            width: 260px !important;
          }
          .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) {
            width: min(650px, calc(100vw - 302px)) !important;
          }
        }

        @media (max-width: 1180px) {
          .noxia-dashboard-shell > div > header > div:last-child {
            gap: .4rem !important;
          }
          .noxia-profile-stats-compact span b {
            display: none;
          }
          .noxia-dashboard-shell > div > header + div > div:last-child {
            width: 232px !important;
          }
          .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) {
            width: min(590px, calc(100vw - 270px)) !important;
          }
        }

        @media (max-width: 980px) {
          .noxia-profile-stats-compact {
            display: none;
          }
          .noxia-dashboard-shell > div > header + div > div:last-child {
            top: 102px !important;
            right: 8px !important;
            width: 210px !important;
          }
          /* Auf kleinen Screens bleiben nur der unmittelbar spielrelevante
             Schiffsstatus als rechtes Fenster und das Standort-Dock unten. */
          .noxia-dashboard-shell > div > header + div > div:last-child > div:first-child,
          .noxia-dashboard-shell > div > header + div > div:last-child > div:last-child {
            display: none !important;
          }
          .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) {
            left: 8px !important;
            right: 8px !important;
            bottom: 8px !important;
            width: auto !important;
          }
          .noxia-dashboard-shell > div > header + div > div:first-child > div:has(> div:last-child[style*="flex-wrap"]) > div:last-child > div {
            min-width: 104px !important;
          }
        }

        @media (max-width: 760px) {
          .noxia-dashboard-shell > div > header {
            padding-left: .55rem !important;
            padding-right: .55rem !important;
          }
          .noxia-dashboard-shell > div > header > div:last-child > div:nth-child(2),
          .noxia-dashboard-shell > div > header > div:last-child > button:last-child {
            display: none !important;
          }
          .noxia-dashboard-shell > div > header + div > div:last-child {
            display: none !important;
          }
          .noxia-dashboard-shell .grid-pan-container {
            max-height: calc(100vh - 54px) !important;
            min-height: calc(100vh - 54px) !important;
          }
        }
      `}</style>
    </div>
  )
}
