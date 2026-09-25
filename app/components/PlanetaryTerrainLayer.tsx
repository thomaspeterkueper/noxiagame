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
  contourStroke: string
  steepSlopeStroke: string
}

const THEMES: Record<string, PlanetaryTerrainTheme> = {
  // Lunar terrain needs materially stronger local contrast than Earth/Mars.
  // The low solar angle is used only as relief shading; it is not a claim about
  // instantaneous real illumination at the selected site.
  moon: { baseLightness: 39, reliefRange: 38, saturation: 2, hue: 42, shadeStrength: 40, unresolvedFill: '#363936', contourStroke: '#ded9ca', steepSlopeStroke: '#d6b36b' },
  mars: { baseLightness: 42, reliefRange: 27, saturation: 30, hue: 18, shadeStrength: 23, unresolvedFill: '#6a4e43', contourStroke: '#ddc0ad', steepSlopeStroke: '#e3b168' },
  earth: { baseLightness: 47, reliefRange: 21, saturation: 14, hue: 75, shadeStrength: 18, unresolvedFill: '#566057', contourStroke: '#dce1d7', steepSlopeStroke: '#c8ad68' },
}

export type PlanetaryTerrainLayerProps = {
  body?: string
  grid: LocalElevationGrid | null | undefined
  project: (point: { xM: number; yM: number }) => { x: number; y: number }
  pixelsPerMeter: number
  zoom: number
  theme?: Partial<PlanetaryTerrainTheme>
  upsampleFactor?: number
  showContours?: boolean
  showSlope?: boolean
}

function contourInterval(spanM: number) {
  if (spanM <= 10) return 1
  if (spanM <= 30) return 2
  if (spanM <= 80) return 5
  if (spanM <= 180) return 10
  if (spanM <= 400) return 20
  return 50
}

export default function PlanetaryTerrainLayer({
  body = 'moon',
  grid,
  project,
  pixelsPerMeter,
  zoom,
  theme,
  upsampleFactor = 4,
  showContours = true,
  showSlope = true,
}: PlanetaryTerrainLayerProps) {
  const surface = useMemo(() => grid ? reconstructLocalTerrain(grid, {
    upsampleFactor,
    maxHoleRadiusCells: 1,
    minNeighbourCount: 3,
    sunAzimuthDeg: 315,
    sunAltitudeDeg: body === 'moon' ? 11 : 24,
  }) : null, [grid, upsampleFactor, body])

  const resolvedTheme = { ...(THEMES[body] ?? THEMES.moon), ...theme }
  if (!surface) return null

  const cellPx = Math.max(0.5 / Math.max(zoom, 0.01), surface.stepM * pixelsPerMeter)
  const halfExtentM = (surface.size - 1) * surface.stepM / 2
  const topLeft = project({ xM: -halfExtentM - surface.stepM / 2, yM: halfExtentM + surface.stepM / 2 })
  const fullSizePx = (surface.size * surface.stepM) * pixelsPerMeter
  const interval = contourInterval(surface.maxElevationM - surface.minElevationM)

  return <g className="planetary-terrain-layer" pointerEvents="none">
    <rect x={topLeft.x} y={topLeft.y} width={fullSizePx} height={fullSizePx} fill={resolvedTheme.unresolvedFill}/>

    {surface.cells.map((cell, index) => {
      if (!cell) return null
      const center = project(cell)
      const heightTerm = (cell.normalizedHeight01 - .5) * resolvedTheme.reliefRange
      const shadeTerm = (cell.hillshade01 - .5) * resolvedTheme.shadeStrength * 2
      const slopeDarkening = showSlope ? Math.min(body === 'moon' ? 19 : 12, cell.slopeDeg * (body === 'moon' ? .7 : .45)) : 0
      const lightness = Math.max(body === 'moon' ? 5 : 9, Math.min(body === 'moon' ? 91 : 86, resolvedTheme.baseLightness + heightTerm + shadeTerm - slopeDarkening))
      const opacity = Math.max(.58, Math.min(1, .68 + cell.confidence * .32))
      return <rect
        key={`terrain-${index}`}
        x={center.x - cellPx / 2}
        y={center.y - cellPx / 2}
        width={cellPx + 1.1}
        height={cellPx + 1.1}
        fill={`hsl(${resolvedTheme.hue} ${resolvedTheme.saturation}% ${lightness}%)`}
        opacity={opacity}
      />
    })}

    {showContours && surface.cells.map((cell, index) => {
      if (!cell) return null
      const band = Math.floor((cell.elevationM - surface.minElevationM) / interval)
      const east = cell.col + 1 < surface.size ? surface.cells[cell.row * surface.size + cell.col + 1] : null
      const south = cell.row + 1 < surface.size ? surface.cells[(cell.row + 1) * surface.size + cell.col] : null
      const center = project(cell)
      const x0 = center.x - cellPx / 2, y0 = center.y - cellPx / 2
      const segments: React.ReactNode[] = []
      if (east && Math.floor((east.elevationM - surface.minElevationM) / interval) !== band) segments.push(<line key="e" x1={x0 + cellPx} y1={y0} x2={x0 + cellPx} y2={y0 + cellPx}/>)
      if (south && Math.floor((south.elevationM - surface.minElevationM) / interval) !== band) segments.push(<line key="s" x1={x0} y1={y0 + cellPx} x2={x0 + cellPx} y2={y0 + cellPx}/>)
      if (!segments.length) return null
      return <g key={`contour-${index}`} stroke={resolvedTheme.contourStroke} strokeWidth={Math.max(.35 / zoom, body === 'moon' ? .58 : .45)} opacity={body === 'moon' ? .52 : .3}>{segments}</g>
    })}

    {showSlope && surface.cells.map((cell, index) => {
      if (!cell || cell.slopeDeg < (body === 'moon' ? 8 : 10)) return null
      const center = project(cell)
      const severity = Math.min(1, (cell.slopeDeg - (body === 'moon' ? 8 : 10)) / 18)
      return <rect
        key={`slope-${index}`}
        x={center.x - cellPx / 2}
        y={center.y - cellPx / 2}
        width={cellPx + .6}
        height={cellPx + .6}
        fill={body === 'moon' ? `rgba(8,9,8,${.05 + severity * .17})` : 'none'}
        stroke={resolvedTheme.steepSlopeStroke}
        strokeWidth={Math.max(.25 / zoom, body === 'moon' ? .42 : .35)}
        opacity={body === 'moon' ? .18 + severity * .32 : .10 + severity * .22}
      />
    })}
  </g>
}
