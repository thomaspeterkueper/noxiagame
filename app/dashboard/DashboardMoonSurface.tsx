'use client'

import { useGameStore } from '@/lib/store/gameStore'
import ShackletonSurfaceMap from '@/app/moon/ShackletonSurfaceMap'

const NASA_LOLA_SHACKLETON = 'https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004289/lro_south_pole_print.jpg'

export default function DashboardMoonSurface() {
  const location = useGameStore(state => state.location)

  if (location !== 'moon') return null

  return (
    <section className="noxia-dashboard-moon-surface" aria-label="Mondoberfläche Shackleton">
      <div className="moon-context-label">
        <strong>LRO / LOLA · Shackleton</strong>
        <span>NASA-Terrainkontext · lokales ENU-Netz bleibt metrisch separat</span>
      </div>
      <ShackletonSurfaceMap />
      <style jsx>{`
        .noxia-dashboard-moon-surface {
          position: fixed;
          top: var(--noxia-topbar-h, 44px);
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 1000;
          overflow: auto;
          background: #070b0f url('${NASA_LOLA_SHACKLETON}') center 32% / cover fixed no-repeat;
          overscroll-behavior: contain;
        }
        .noxia-dashboard-moon-surface::before {
          content: '';
          position: fixed;
          inset: var(--noxia-topbar-h, 44px) 0 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(5,9,13,.42), rgba(5,9,13,.74) 78%, rgba(5,9,13,.9));
          z-index: 0;
        }
        .moon-context-label {
          position: fixed;
          z-index: 2;
          left: 18px;
          bottom: calc(var(--noxia-cockpit-clearance, 76px) + 10px);
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 7px 10px;
          border: 1px solid rgba(189,213,225,.2);
          border-radius: 8px;
          background: rgba(5,12,18,.72);
          backdrop-filter: blur(8px);
          color: #d7e3e8;
          font: 10px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          pointer-events: none;
        }
        .moon-context-label strong { color: #d7b96e; letter-spacing: .08em; }
        .moon-context-label span { color: #8ea2ad; }
        .noxia-dashboard-moon-surface :global(.moon-shell) {
          position: relative;
          z-index: 1;
          min-height: 100%;
          box-sizing: border-box;
          padding-bottom: calc(var(--noxia-cockpit-clearance, 76px) + 24px);
          background: transparent !important;
        }
        .noxia-dashboard-moon-surface :global(.hero),
        .noxia-dashboard-moon-surface :global(.map-card),
        .noxia-dashboard-moon-surface :global(.jobs-card),
        .noxia-dashboard-moon-surface :global(.chain-card) {
          backdrop-filter: blur(7px);
        }
        .noxia-dashboard-moon-surface :global(.map-card),
        .noxia-dashboard-moon-surface :global(.jobs-card),
        .noxia-dashboard-moon-surface :global(.chain-card) {
          background: rgba(10,19,25,.8) !important;
        }
        .noxia-dashboard-moon-surface :global(.map-card svg) {
          background: linear-gradient(rgba(5,10,14,.28), rgba(5,10,14,.5)), url('${NASA_LOLA_SHACKLETON}') center 58% / cover no-repeat;
        }
        .noxia-dashboard-moon-surface :global(.map-card svg > rect:first-of-type) {
          fill: rgba(8,15,20,.34) !important;
        }
        .noxia-dashboard-moon-surface :global(.map-card svg > rect:nth-of-type(2)) {
          opacity: .45 !important;
        }
      `}</style>
    </section>
  )
}
