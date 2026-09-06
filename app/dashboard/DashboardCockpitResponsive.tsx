'use client'

/**
 * Responsive behavior for the fullscreen cockpit shell.
 *
 * This layer only adapts cockpit chrome. It deliberately does not touch map,
 * terrain, camera, world-coordinate or placement state. The dashboard remains
 * a non-scrolling game viewport; when horizontal room gets tight, only the
 * cockpit rail itself becomes scrollable.
 */
export default function DashboardCockpitResponsive() {
  return <style>{`
    html.noxia-dashboard-active,
    body.noxia-dashboard-active {
      width: 100vw !important;
      max-width: 100vw !important;
      overflow: hidden !important;
      overscroll-behavior: none !important;
    }

    .noxia-dashboard-active .noxia-dashboard-shell {
      width: 100vw !important;
      max-width: 100vw !important;
      overflow: hidden !important;
    }

    .noxia-cockpit > button {
      flex: 0 0 auto;
    }

    /* Medium desktop / narrow laptop: remove non-essential branding first and
       tighten controls while keeping the primary context labels readable. */
    @media (max-width: 1180px) {
      .noxia-cockpit-brand {
        display: none !important;
      }

      .noxia-cockpit {
        gap: 2px !important;
        padding-left: 4px !important;
        padding-right: 4px !important;
      }

      .noxia-cockpit > button {
        min-width: 54px !important;
        padding-left: 6px !important;
        padding-right: 6px !important;
      }
    }

    /* At this width the semantic context controls still keep their labels.
       Secondary map/utilities collapse to icon-only controls and remain fully
       described through their existing title/aria attributes. */
    @media (max-width: 980px) {
      .noxia-cockpit {
        height: 52px !important;
        bottom: 8px !important;
      }

      .noxia-cockpit > button {
        min-width: 48px !important;
        height: 42px !important;
        padding-left: 5px !important;
        padding-right: 5px !important;
      }

      .noxia-cockpit > button[title^="Feed"] small,
      .noxia-cockpit > button[title*="Kartenstandorte"] small,
      .noxia-cockpit > button[title="Ansicht wechseln"] small,
      .noxia-cockpit > button[title*="Einweisung"] small,
      .noxia-cockpit > button[title*="Musik und Lautstärke"] small,
      .noxia-cockpit > button[title*="Informationen, Rechtliches"] small {
        display: none !important;
      }

      .noxia-cockpit-panel.noxia-cockpit-panel-active,
      .noxia-cockpit-utility {
        bottom: 68px !important;
      }
    }

    /* Tablet / very narrow window: the document must never start scrolling.
       The cockpit rail becomes the single horizontal scroll owner. */
    @media (max-width: 760px) {
      .noxia-cockpit {
        left: 6px !important;
        right: 6px !important;
        bottom: 6px !important;
        width: auto !important;
        max-width: none !important;
        transform: none !important;
        justify-content: flex-start !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        overscroll-behavior-x: contain !important;
        overscroll-behavior-y: none !important;
        touch-action: pan-x !important;
        scrollbar-width: none !important;
        -webkit-overflow-scrolling: touch;
        scroll-snap-type: x proximity;
      }

      .noxia-cockpit::-webkit-scrollbar {
        display: none !important;
      }

      .noxia-cockpit > button {
        flex: 0 0 46px !important;
        min-width: 46px !important;
        max-width: 46px !important;
        scroll-snap-align: center;
        scroll-margin-inline: 8px;
      }

      .noxia-cockpit > button:focus-visible {
        outline: 1px solid rgba(93, 207, 240, .85) !important;
        outline-offset: -2px !important;
      }

      .noxia-cockpit-panel.noxia-cockpit-panel-active,
      .noxia-cockpit-utility {
        left: 6px !important;
        right: 6px !important;
        bottom: 66px !important;
        width: auto !important;
        max-width: none !important;
        transform: none !important;
        max-height: min(54vh, calc(100dvh - 126px)) !important;
        overscroll-behavior: contain !important;
      }

      .noxia-location-dock-managed.noxia-cockpit-panel-active {
        width: auto !important;
        max-width: none !important;
      }

      .noxia-location-dock-cards {
        overscroll-behavior-x: contain !important;
        scrollbar-width: thin;
      }
    }

    /* Phone-sized viewport: context is communicated by the icon and active
       state; tooltips/aria retain the complete text. This keeps every cockpit
       command reachable without making the document wider than the viewport. */
    @media (max-width: 560px) {
      .noxia-cockpit {
        height: 50px !important;
        padding: 4px !important;
      }

      .noxia-cockpit > button {
        flex-basis: 44px !important;
        min-width: 44px !important;
        max-width: 44px !important;
        height: 40px !important;
        padding: 3px !important;
      }

      .noxia-cockpit > button small {
        display: none !important;
      }

      .noxia-cockpit .ico {
        font-size: 18px !important;
        line-height: 18px !important;
      }

      .noxia-cockpit-badge {
        top: 1px !important;
        right: 2px !important;
      }

      .noxia-cockpit-panel.noxia-cockpit-panel-active,
      .noxia-cockpit-utility {
        bottom: 62px !important;
      }
    }

    /* Landscape phones and low browser windows need vertical room for the
       world. Open cockpit panels therefore use the remaining viewport height
       rather than a fixed percentage. */
    @media (max-width: 760px) and (max-height: 560px) {
      .noxia-cockpit-panel.noxia-cockpit-panel-active,
      .noxia-cockpit-utility {
        bottom: 62px !important;
        max-height: calc(100dvh - 112px) !important;
      }

      .noxia-feed-overlay.noxia-feed-overlay-active {
        top: 48px !important;
        max-height: calc(100dvh - 118px) !important;
      }
    }
  `}</style>
}
