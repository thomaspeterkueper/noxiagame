'use client'

import { useGameStore } from '@/lib/store/gameStore'
import ShackletonSurfaceMap from '@/app/moon/ShackletonSurfaceMap'

export default function DashboardMoonSurface() {
  const location = useGameStore(state => state.location)

  if (location !== 'moon') return null

  return (
    <section className="noxia-dashboard-moon-surface" aria-label="Mondoberfläche Shackleton">
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
          background: #070b0f;
          overscroll-behavior: contain;
        }
        .noxia-dashboard-moon-surface :global(.moon-shell) {
          min-height: 100%;
          box-sizing: border-box;
          padding-bottom: calc(var(--noxia-cockpit-clearance, 76px) + 24px);
        }
      `}</style>
    </section>
  )
}
