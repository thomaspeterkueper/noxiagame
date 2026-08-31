# Mars Vertical Slice — Asset Set v1

Der erste NOXIA-Asset-Slice konzentriert sich auf Mars / Tharsis Hub und nutzt ausschließlich bestehende kanonische Spielobjekte.

## Gebäude

- `habitat` — 2×2 Footprint, bewohnter Druckkörper mit zentralem Gemeinschaftsraum und modularen Seitensegmenten.
- `solar` — 2×2 Footprint, bodennahe Photovoltaikfelder mit lokalem Inverter/Steuergerät.
- `water_recycler` — 2×2 Footprint, technische Wassergewinnung/-aufbereitung mit Tanks, Turm, Leitungen und Wartungsbereich.

## Landschaft

Ein Mars-Terrain-Asset dient nur als visuelle Textur-/Hintergrundebene. Das kanonische 32×24-Raster und seine Koordinaten bleiben die Source of Truth.

## Animation

`water_recycler-machine` ist als 8-Frame-Sprite-Strip vorgesehen. Kurze Maschinenloops werden im Spiel per `steps()` abgespielt; GIF ist nicht erforderlich.

## Integrationsregel

Rasterassets werden über `lib/assets/catalog.ts` aufgelöst. Fehlt eine Rastergrafik, bleibt `BuildingSVG` der robuste Fallback. Dadurch können einzelne Gebäude schrittweise visuell ersetzt werden, ohne Simulation, Savegames oder Baukoordinaten zu verändern.
