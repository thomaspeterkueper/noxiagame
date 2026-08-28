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
        /* Desktop-Dashboard: wichtige Navigation bleibt oberhalb des Grids sichtbar. */
        .noxia-dashboard-shell > div > header {
          height: 56px !important;
          padding-left: 1.25rem !important;
          padding-right: 1.25rem !important;
        }
        .noxia-dashboard-shell > div > header > div:last-child {
          gap: 1.15rem !important;
        }
        /* Der bisherige vierte Kennwert war eine globale Summenbevölkerung und
           wurde als Bevölkerung des aktuellen Standorts gelesen. Lokale Werte
           stehen direkt am Grid; bis der Header explizit lokal verdrahtet ist,
           wird der irreführende Aggregatwert nicht angezeigt. */
        .noxia-dashboard-shell > div > header > div:last-child > div:nth-child(4) {
          display: none !important;
        }
        .noxia-dashboard-shell > div > header + div {
          padding: .75rem 1rem 0 !important;
          grid-template-columns: minmax(0, 1fr) 310px !important;
          gap: 1rem !important;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child {
          gap: .55rem !important;
        }
        /* "Deine Orte" und "Deine Schiffe" stehen im DOM am Ende der linken
           Spalte. Flex-order zieht beide vor Grid und Hinweise, ohne Logik zu duplizieren. */
        .noxia-dashboard-shell > div > header + div > div:first-child > div:nth-last-child(2),
        .noxia-dashboard-shell > div > header + div > div:first-child > div:last-child {
          order: -10 !important;
        }
        .noxia-dashboard-shell > div > header + div > div:first-child > div:nth-last-child(2) > div:last-child,
        .noxia-dashboard-shell > div > header + div > div:first-child > div:last-child > div:last-child {
          flex-wrap: nowrap !important;
          overflow-x: auto !important;
          scrollbar-width: thin;
        }
        .noxia-dashboard-shell .grid-pan-container {
          max-height: calc(100vh - 360px) !important;
          min-height: 420px;
        }
        .noxia-dashboard-shell > div > header + div > div:last-child {
          top: 68px !important;
          height: calc(100vh - 78px) !important;
          gap: .65rem !important;
        }
        /* Im Root-Layout existiert bereits der rechtliche Footer; der zweite
           Dashboard-Footer erzeugte nur zusätzliche Scrollhöhe. */
        .noxia-dashboard-shell > div > footer {
          display: none !important;
        }
        @media (max-width: 1180px) {
          .noxia-dashboard-shell > div > header + div {
            grid-template-columns: minmax(0, 1fr) 280px !important;
          }
          .noxia-dashboard-shell > div > header > div:last-child {
            gap: .65rem !important;
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
          .noxia-dashboard-shell .grid-pan-container {
            max-height: 58vh !important;
            min-height: 360px;
          }
        }
      `}</style>
    </div>
  )
}
