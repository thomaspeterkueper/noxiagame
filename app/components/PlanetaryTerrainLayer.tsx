'use client'

import { useMemo } from 'react'
import { reconstructLocalTerrain, type LocalElevationGrid } from '@/lib/game/spatial/terrainReconstruction'

export type PlanetaryTerrainTheme = {
  baseLightness: number
  reliefRange: number
  saturation: number
  hue: number
  shadeStrength: number
  unresolvedFill: string
}

const THEMES: Record<string, PlanetaryTerrainTheme> = {
  moon: { baseLightness: 46, reliefRange: 22, saturation: 3, hue: 40, shadeStrength: 18, unresolvedFill: '#555754' },
  mars: { baseLightness: 43, reliefRange: 24, saturation: 28, hue: 18, shadeStrength: 17, unresolvedFill: '#705448' },
  earth: { baseLightness: 48, reliefRange: 19, saturation: 12, hue: 75, shadeStrength: 14, unresolvedFill: '#59625a' },
}

export type PlanetaryTerrainLayerProps = {
  body?: string
  grid: LocalElevationGrid | null | undefined
  project: (point: { xM: number; yM: number }) => { x: number; y: number }
  pixelsPerMeter: number
  zoom: number
  theme?: Partial<PlanetaryTerrainTheme>
  upsampleFactor?: number
}

export default function PlanetaryTerrainLayer({
  body = 'moon',
  grid,
  project,
  pixelsPerMeter,
  zoom,
  theme,
  upsampleFactor = 4,
}: PlanetaryTerrainLayerProps) {
  const surface = useMemo(() => grid ? reconstructLocalTerrain(grid, {
    upsampleFactor,
    maxHoleRadiusCells: 1,
    minNeighbourCount: 3,
    sunAzimuthDeg: 315,
    sunAltitudeDeg: 24,
  }) : null, [grid, upsampleFactor])

  const resolvedTheme = { ...(THEMES[body] ?? THEMES.moon), ...theme }
  if (!surface) return null

  const cellPx = Math.max(0.5 / Math.max(zoom, 0.01), surface.stepM * pixelsPerMeter)
  const halfExtentM = (surface.size - 1) * surface.stepM / 2
  const topLeft = project({ xM: -halfExtentM - surface.stepM / 2, yM: halfExtentM + surface.stepM / 2 })
  const fullSizePx = (surface.size * surface.stepM) * pixelsPerMeter

  return <g className="planetary-terrain-layer" pointerEvents="none">
    <rect
      x={topLeft.x}
      y={topLeft.y}
      width={fullSizePx}
      height={fullSizePx}
      fill={resolvedTheme.unresolvedFill}
    />
    {surface.cells.map((cell, index) => {
      if (!cell) return null
      const center = project(cell)
      const heightTerm = (cell.normalizedHeight01 - .5) * resolvedTheme.reliefRange
      const shadeTerm = (cell.hillshade01 - .5) * resolvedTheme.shadeStrength * 2
      const lightness = Math.max(12, Math.min(82, resolvedTheme.baseLightness + heightTerm + shadeTerm))
      const opacity = Math.max(.52, Math.min(1, .62 + cell.confidence * .38))
      return <rect
        key={`terrain-${index}`}
        x={center.x - cellPx / 2}
        y={center.y - cellPx / 2}
        width={cellPx + .75}
        height={cellPx + .75}
        fill={`hsl(${resolvedTheme.hue} ${resolvedTheme.saturation}% ${lightness}%)`}
        opacity={opacity}
      />
    })}
  </g>
}
