'use client'

// Temporary bridge while the dashboard still reuses the legacy Feed card as
// its data source. The passive cockpit Feed must render as telemetry only:
// no HUD title bar, no card header, no separators and no map input capture.
export default function DashboardFeedPolish() {
  return <style>{`
    .noxia-feed-overlay.noxia-feed-overlay-active {
      display: flex !important;
      flex-direction: column !important;
      top: 62px !important;
      right: 14px !important;
      width: min(360px, 32vw) !important;
      min-width: 250px !important;
      max-width: 360px !important;
      min-height: 0 !important;
      max-height: 40vh !important;
      padding: 8px 10px !important;
      overflow: hidden !important;
      border: 0 !important;
      border-radius: 4px !important;
      background: rgba(6, 16, 25, .34) !important;
      box-shadow: none !important;
      backdrop-filter: blur(9px) saturate(105%) !important;
      -webkit-backdrop-filter: blur(9px) saturate(105%) !important;
      pointer-events: none !important;
      color: rgba(233, 245, 249, .94) !important;
      text-shadow: 0 1px 2px rgba(0, 0, 0, .42);
    }

    /* The source card currently has: label, feed rows, then the injected
       DashboardHudManager window bar. Hide everything first and expose only
       the original feed-row container (the second direct div). */
    .noxia-feed-overlay.noxia-feed-overlay-active > * {
      display: none !important;
    }
    .noxia-feed-overlay.noxia-feed-overlay-active > div:nth-of-type(2) {
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
    }

    .noxia-feed-overlay.noxia-feed-overlay-active > div:nth-of-type(2) > div {
      display: flex !important;
      align-items: flex-start !important;
      gap: 7px !important;
      margin: 0 !important;
      padding: 2px 0 !important;
      border: 0 !important;
      border-bottom: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      color: rgba(233, 245, 249, .90) !important;
      font-size: .73rem !important;
      line-height: 1.38 !important;
    }
    .noxia-feed-overlay.noxia-feed-overlay-active > div:nth-of-type(2) > div > span:first-child {
      flex: 0 0 18px !important;
      width: 18px !important;
      margin: 0 !important;
      opacity: .82;
      text-align: center;
    }
    .noxia-feed-overlay.noxia-feed-overlay-active > div:nth-of-type(2) > div > span:last-child {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      color: inherit !important;
    }

    /* Belt-and-suspenders: legacy HUD control must never surface in telemetry. */
    .noxia-feed-overlay.noxia-feed-overlay-active > .noxia-hud-windowbar {
      display: none !important;
    }

    @media (max-width: 760px) {
      .noxia-feed-overlay.noxia-feed-overlay-active {
        top: 52px !important;
        right: 8px !important;
        width: min(320px, calc(100vw - 16px)) !important;
        min-width: 0 !important;
        padding: 7px 9px !important;
      }
    }
  `}</style>
}
