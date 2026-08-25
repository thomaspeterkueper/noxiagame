// next.config.ts
// Aktualisiert: 24.08.2026 — productionBrowserSourceMaps: true (temporär,
// Diagnose): der Stacktrace der GlobalErrorBoundary zeigt bisher nur
// einzelne minifizierte Funktionsbuchstaben (rn, nU, ...) statt echter
// Datei-/Zeilenangaben. Mit Source Maps zeigt Chrome/Edge DevTools den
// echten Ursprung direkt an, ohne weiteres Rätselraten im Quellcode.
// Nach Fund der Fehlerquelle wieder auf false zurücksetzen (Source Maps
// vergrößern den Build und legen Quellcode offen).
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
};

export default nextConfig;
