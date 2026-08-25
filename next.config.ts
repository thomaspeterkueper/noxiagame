// next.config.ts
// Aktualisiert: 24.08.2026 — productionBrowserSourceMaps wieder deaktiviert.
// War nur temporär zur Diagnose von React error #31 aktiv (SSF-unlocks-
// Objekt-Bug, gefunden und in SchoolOverlay.tsx/lib/ssfKnowledge.ts
// behoben). Source Maps vergrößern den Build und legen Quellcode offen —
// nicht dauerhaft nötig.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
