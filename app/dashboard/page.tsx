import { createServiceClient } from '@/lib/supabase/service'
import DashboardGate from './DashboardGate'

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
      <style>{`
        /*
         * Desktop dashboard density v2
         * Das Grid ist die Arbeitsfläche. Navigation und Status dürfen es nicht
         * wie eigenständige Inhaltsblöcke verdrängen.
         */
        .noxia-dashboard-shell > div > header {
          height: 54px !important;
          padding-left: 1rem !important;
          padding-right: 1rem !important;
        }
        .noxia-dashboard-shell > div > header > div:last-child {
          gap: 1rem !important;
        }
        /* Der vierte Header-Wert ist die globale Summenbevölkerung und wird
           nicht als lokale Koloniebevölkerung gezeigt. */
        .noxia-dashboard-shell > div > header > div:last-child > div:nth-child(4) {
          display: none !important;
        }

        /* Hauptfläche: rechte Informationsleiste bewusst schmal. */
        .noxia-dashboard-shell > div > header + div {
          padding: .45rem .65rem 0 !important;
          grid-template-columns: minmax(0, 1fr) 270px !important;
          gap: .65rem !important;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child {
          gap: .4rem !important;
          min-width: 0 !important;
        }

        /* Orte bleiben als kompakte Standortnavigation über dem Grid. */
        .noxia-dashboard-shell > div > header + div > div:first-child > div:nth-last-child(2) {
          order: -20 !important;
          margin: 0 !important;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:nth-last-child(2) > div:first-child {
          margin-bottom: .2rem !important;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:nth-last-child(2) > div:last-child {
          flex-wrap: nowrap !important;
          overflow-x: auto !important;
          gap: .35rem !important;
          scrollbar-width: none;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:nth-last-child(2) > div:last-child::-webkit-scrollbar {
          display: none;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:nth-last-child(2) > div:last-child > div {
          min-width: 92px !important;
          padding: .36rem .6rem !important;
          border-radius: 7px !important;
        }

        /* "Deine Schiffe" ist im Dashboard redundant: aktives Schiff,
           Laderaum und Einstieg liegen bereits im Header/rechten Statusbereich.
           Nur verstecken, wenn das letzte Element tatsächlich der Grid-basierte
           Schiffskarten-Block ist; ohne Schiffe bleibt die Ortsnavigation sichtbar. */
        .noxia-dashboard-shell > div > header + div > div:first-child:has(> div:last-child > div:last-child[style*="grid-template-columns"]) > div:last-child {
          display: none !important;
        }

        /* Kontexttipps nicht als breite Dauerbanner über die Karte legen. Der
           Einstieg bleibt über "Einweisung" erhalten; kritische Zustände stehen
           im Feed. */
        .noxia-dashboard-shell > div > header + div > div:first-child > div:not(:has(.grid-pan-container)):has(button[title="Diesen Tipp nicht mehr anzeigen"]) {
          display: none !important;
        }

        /* ColonyGrid: die bisherige 190px-Innenleiste wird als schwebender
           Koloniestatus über die Karte gelegt. Minimap + Legende verschwinden
           aus der Daueransicht und können später als echte Layer zurückkommen. */
        .noxia-dashboard-shell div:has(> div > .grid-pan-container) {
          position: relative !important;
        }
        .noxia-dashboard-shell div:has(> .grid-pan-container) + div {
          position: absolute !important;
          z-index: 12 !important;
          top: 48px !important;
          right: 8px !important;
          width: 166px !important;
          max-height: none !important;
          overflow: visible !important;
          gap: 0 !important;
          pointer-events: none;
        }
        .noxia-dashboard-shell div:has(> .grid-pan-container) + div > div:first-child {
          display: block !important;
          padding: .55rem .65rem !important;
          background: rgba(255,255,255,.93) !important;
          box-shadow: 0 4px 16px rgba(27,39,51,.10) !important;
          backdrop-filter: blur(6px);
        }
        .noxia-dashboard-shell div:has(> .grid-pan-container) + div > div:not(:first-child) {
          display: none !important;
        }

        /* Mehr echte Kartenfläche: nahezu die gesamte verfügbare Viewport-Höhe. */
        .noxia-dashboard-shell .grid-pan-container {
          max-height: calc(100vh - 165px) !important;
          min-height: 650px !important;
          border-radius: 8px !important;
        }

        /* Rechte Leiste: Profilkarte ist redundant zum Avatar im Header. */
        .noxia-dashboard-shell > div > header + div > div:last-child {
          top: 62px !important;
          height: calc(100vh - 69px) !important;
          gap: .5rem !important;
        }
        .noxia-dashboard-shell > div > header + div > div:last-child > div:first-child {
          display: none !important;
        }
        .noxia-dashboard-shell > div > header + div > div:last-child > div {
          border-radius: 8px !important;
        }

        /* Im Root-Layout existiert bereits der rechtliche Footer. */
        .noxia-dashboard-shell > div > footer {
          display: none !important;
        }

        @media (max-width: 1250px) {
          .noxia-dashboard-shell > div > header + div {
            grid-template-columns: minmax(0, 1fr) 240px !important;
          }
          .noxia-dashboard-shell > div > header > div:last-child {
            gap: .55rem !important;
          }
        }
        @media (max-width: 900px) {
          .noxia-dashboard-shell > div > header + div {
            display: block !important;
          }
          .noxia-dashboard-shell > div > header + div > div:last-child {
            position: static !important;
            height: auto !important;
            margin-top: .75rem;
          }
          .noxia-dashboard-shell > div > header + div > div:last-child > div:first-child {
            display: block !important;
          }
          .noxia-dashboard-shell .grid-pan-container {
            max-height: 62vh !important;
            min-height: 380px !important;
          }
          .noxia-dashboard-shell div:has(> .grid-pan-container) + div {
            position: static !important;
            width: 150px !important;
            pointer-events: auto;
          }
        }
      `}</style>
    </div>
  )
}
