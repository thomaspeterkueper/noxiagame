'use client'

/**
 * Visual-only cockpit polish.
 * Keeps the existing panel content and behavior intact while bringing legacy
 * cards into the dark NOXIA HUD language. Map/terrain renderer code is not
 * touched here.
 */
export default function DashboardCockpitPolish() {
  return <style>{`
    .noxia-cockpit-panel.noxia-cockpit-panel-active {
      border: 1px solid rgba(76, 170, 207, .42) !important;
      background: rgba(6, 18, 28, .86) !important;
      box-shadow: 0 22px 64px rgba(0, 0, 0, .38), inset 0 1px rgba(174, 226, 244, .05) !important;
      backdrop-filter: blur(18px) saturate(112%) !important;
      -webkit-backdrop-filter: blur(18px) saturate(112%) !important;
      color: #d8e8ee !important;
    }

    /* Legacy cards still carry light-theme inline text colors. The cockpit
       surface owns readability while the underlying content model remains
       unchanged. */
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="color"] {
      color: #c7dbe4 !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-weight: 700"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-weight:700"] {
      color: #eef8fb !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size: 0.58rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size:0.58rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size: 0.6rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size:0.6rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size: 0.62rem"],
    .noxia-cockpit-panel.noxia-cockpit-panel-active [style*="font-size:0.62rem"] {
      color: #91afbd !important;
    }

    /* Profile: preserve avatar and progress colors, but remove the pale web
       card impression and make hierarchy readable at a glance. */
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] {
      padding: 14px 16px !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] > div:first-of-type {
      margin-bottom: 12px !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] > div:first-of-type > div:nth-child(2) > div:first-child {
      color: #f1f8fb !important;
      font-size: 1rem !important;
      letter-spacing: .01em;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] > div:first-of-type > div:nth-child(2) > div:nth-child(2) {
      color: #9fb9c5 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: .7rem !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] > div:nth-of-type(2) {
      gap: 8px !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] > div:nth-of-type(2) > div > div:nth-child(2) {
      background: rgba(153, 184, 197, .17) !important;
      height: 6px !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="profile"] > div:last-of-type {
      color: #7897a6 !important;
      margin-top: 10px !important;
    }

    /* Location cards and ship rows keep their semantics but share the same
       instrumentation surface. */
    .noxia-location-dock-managed.noxia-cockpit-panel-active {
      background: rgba(6, 18, 28, .86) !important;
      color: #d8e8ee !important;
    }
    .noxia-location-dock-managed.noxia-cockpit-panel-active [style*="background"] {
      background-color: rgba(12, 31, 44, .72) !important;
    }
    .noxia-cockpit-panel.noxia-cockpit-panel-active[data-hud-window="ship"] button {
      border-color: rgba(81, 177, 216, .36) !important;
      background: rgba(31, 99, 128, .14) !important;
      color: #ccebf6 !important;
    }

    /* Stronger selected state, inspired by strategy HUDs without turning the
       cockpit into a neon dashboard. */
    .noxia-cockpit > button.active,
    .noxia-cockpit > button.toggle.active {
      border-color: rgba(73, 207, 245, .72) !important;
      box-shadow: inset 0 -2px #4fd5f5, 0 0 14px rgba(58, 190, 229, .12) !important;
    }
    .noxia-cockpit > button.primary {
      border-color: rgba(222, 186, 89, .50) !important;
      box-shadow: inset 0 -2px rgba(226, 190, 83, .72) !important;
    }

    .noxia-cockpit-utility {
      background: rgba(6, 18, 28, .90) !important;
      border-color: rgba(76, 170, 207, .40) !important;
      backdrop-filter: blur(18px) saturate(112%) !important;
      -webkit-backdrop-filter: blur(18px) saturate(112%) !important;
    }
  `}</style>
}
