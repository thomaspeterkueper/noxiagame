'use client'

import DashboardPrimaryColony from './DashboardPrimaryColony'

/**
 * Dashboard composition boundary for the primary colony surface.
 *
 * Historical versions of this component queried the rendered DashboardClient DOM,
 * watched it with MutationObserver and injected profile/location chrome through
 * portals. That made composition depend on incidental element order and CSS
 * selectors. Dashboard chrome now belongs to the components that render it;
 * this boundary only mounts the primary colony game surface.
 *
 * Scanner discovery focusing is intentionally no longer implemented here. Grid
 * navigation belongs to ColonyGrid (the owner of grid coordinates and scrolling),
 * not to a dashboard-wide DOM bridge.
 */
export default function DashboardQuickChrome() {
  return <DashboardPrimaryColony />
}
