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
        :root {
          --noxia-topbar-h: 44px;
          --noxia-cockpit-clearance: 0px;
        }

        /* The dashboard is a game viewport, not a scrolling document. */
        .noxia-dashboard-shell {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          background: #07111b;
          isolation: isolate;
        }
        body.noxia-dashboard-active footer {
          display: none !important;
        }
        .noxia-dashboard-shell > div:first-of-type {
          width: 100% !important;
          height: 100dvh !important;
          min-height: 0 !important;
          max-height: 100dvh !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          background: #07111b !important;
        }

        /* Compact orientation bar. Large operations live in the cockpit/menu. */
        .noxia-dashboard-shell > div:first-of-type > header {
          position: relative !important;
          top: auto !important;
          z-index: 2200 !important;
          width: 100% !important;
          height: var(--noxia-topbar-h) !important;
          min-height: var(--noxia-topbar-h) !important;
          flex: 0 0 var(--noxia-topbar-h) !important;
          box-sizing: border-box !important;
          padding: 0 .75rem !important;
          border-bottom: 1px solid rgba(77,119,145,.36) !important;
          background: rgba(7,17,27,.97) !important;
          box-shadow: 0 6px 22px rgba(0,0,0,.22) !important;
          backdrop-filter: blur(14px);
        }
        .noxia-dashboard-shell > div:first-of-type > header h1 {
          color: #d8e8ef !important;
          font-size: 1.05rem !important;
        }
        .noxia-dashboard-shell > div:first-of-type > header h1 span {
          color: #c9a961 !important;
        }
        .noxia-dashboard-shell > div:first-of-type > header > div:last-child {
          gap: .65rem !important;
        }
        .noxia-dashboard-shell > div:first-of-type > header > div:last-child > div > div:first-child {
          color: #6e8795 !important;
        }
        .noxia-dashboard-shell > div:first-of-type > header > div:last-child > div > div:last-child {
          color: #d4e5ed !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
        }

        /* World host owns every remaining pixel below the top bar. */
        .noxia-dashboard-shell > div:first-of-type > header + div {
          position: relative !important;
          flex: 1 1 auto !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
          overflow: hidden !important;
        }
        .noxia-dashboard-shell > div:first-of-type > header + div > div:first-child {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
          display: block !important;
          overflow: hidden !important;
        }

        /* Legacy right rail becomes only a content source for cockpit drawers. */
        .noxia-dashboard-shell > div:first-of-type > header + div > div:last-child {
          position: absolute !important;
          inset: 0 auto auto 0 !important;
          width: 0 !important;
          height: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          overflow: visible !important;
          pointer-events: none !important;
        }
        .noxia-dashboard-shell > div:first-of-type > header + div > div:last-child > div:nth-child(2) {
          display: none !important;
        }

        /* Redundant document-era blocks stay out of the world viewport. */
        .noxia-dashboard-shell > div:first-of-type > footer {
          display: none !important;
        }
        .noxia-dashboard-shell > div:first-of-type > header + div > div:first-child > div:has(> div:last-child[style*="grid-template-columns"]) {
          display: none !important;
        }
        .noxia-dashboard-shell > div:first-of-type > header + div > div:first-child > div:not(:has(.grid-pan-container)):has(button[title="Diesen Tipp nicht mehr anzeigen"]) {
          display: none !important;
        }

        /* Dashboard embedding contract for the current Earth surface.
           Keep the document-style title hidden, but expose the actual Earth
           build selector as a compact cockpit control. */
        .noxia-dashboard-shell .earth-shell {
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #07111b !important;
        }
        .noxia-dashboard-shell .earth-foot {
          display: none !important;
        }
        .noxia-dashboard-shell .earth-head {
          display: flex !important;
          position: absolute !important;
          z-index: 14 !important;
          left: 50% !important;
          bottom: 74px !important;
          transform: translateX(-50%) !important;
          width: auto !important;
          max-width: calc(100% - 24px) !important;
          margin: 0 !important;
          align-items: center !important;
          pointer-events: none !important;
        }
        .noxia-dashboard-shell .earth-head > div:first-child,
        .noxia-dashboard-shell .earth-head .earth-stats,
        .noxia-dashboard-shell .earth-head .earth-actions > button:first-child {
          display: none !important;
        }
        .noxia-dashboard-shell .earth-head .earth-actions {
          display: flex !important;
          align-items: center !important;
          flex-wrap: nowrap !important;
          gap: 6px !important;
          pointer-events: auto !important;
          padding: 6px !important;
          border: 1px solid rgba(65,116,137,.72) !important;
          border-radius: 9px !important;
          background: rgba(7,24,35,.92) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,.32) !important;
          backdrop-filter: blur(10px) !important;
        }
        .noxia-dashboard-shell .earth-head .earth-actions select,
        .noxia-dashboard-shell .earth-head .earth-actions button {
          min-height: 32px !important;
          border: 1px solid rgba(73,139,166,.72) !important;
          border-radius: 6px !important;
          background: #0b2635 !important;
          color: #e2edf0 !important;
          font-size: 11px !important;
          font-weight: 750 !important;
          padding: 6px 10px !important;
        }
        .noxia-dashboard-shell .earth-head .earth-actions select {
          min-width: 230px !important;
          max-width: min(420px, 62vw) !important;
        }
        .noxia-dashboard-shell .earth-head .earth-actions button {
          cursor: pointer !important;
          color: #e2c56d !important;
        }
        .noxia-dashboard-shell .earth-map {
          width: 100% !important;
          max-width: none !important;
          height: 100% !important;
          min-height: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        /* Transitional planning grids also fill their host instead of creating
           page-height content. The renderer itself remains untouched. */
        .noxia-dashboard-shell .grid-pan-container {
          width: 100% !important;
          max-width: none !important;
          height: 100% !important;
          min-height: 0 !important;
          max-height: none !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          border-bottom: 0 !important;
        }

        /* Primary colony surface follows the compact top bar; the cockpit floats
           over its lower edge and therefore does not reduce map size. */
        .noxia-dashboard-shell .noxia-primary-colony {
          top: var(--noxia-topbar-h) !important;
          bottom: 0 !important;
        }
        .noxia-dashboard-shell .noxia-primary-hudrail {
          top: 0 !important;
          height: 48px !important;
        }
        .noxia-dashboard-shell .noxia-open-isometric {
          display: none !important;
        }

        /* Location navigation is now invoked by the cockpit instead of staying
           permanently over the map. Existing card behavior is preserved. */
        .noxia-dashboard-shell .noxia-location-dock-managed {
          pointer-events: auto;
        }
        .noxia-dashboard-shell .noxia-location-card-with-image {
          position: relative !important;
          overflow: hidden !important;
          isolation: isolate;
        }
        .noxia-dashboard-shell .noxia-location-thumb {
          position: absolute;
          z-index: -1;
          inset: 0 auto 0 0;
          width: 50px;
          overflow: hidden;
          border-right: 1px solid rgba(255,255,255,.72);
          background: #e8e4dc;
        }
        .noxia-dashboard-shell .noxia-location-thumb img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block;
        }

        @media (max-width: 760px) {
          :root { --noxia-topbar-h: 42px; }
          .noxia-dashboard-shell > div:first-of-type > header {
            padding-left: .45rem !important;
            padding-right: .45rem !important;
          }
          .noxia-dashboard-shell > div:first-of-type > header h1 span {
            display: none !important;
          }
          .noxia-dashboard-shell .earth-head {
            bottom: 68px !important;
            max-width: calc(100% - 12px) !important;
          }
          .noxia-dashboard-shell .earth-head .earth-actions select {
            min-width: 180px !important;
            max-width: 66vw !important;
          }
        }
      `}</style>
    </div>
  )
}
