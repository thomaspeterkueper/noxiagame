'use client'

import React, { useState } from 'react'
import { getBuildingVisualAsset, type BuildingView } from './catalog'

interface Props {
  entityId: string
  world: string
  view?: BuildingView
  className?: string
  style?: React.CSSProperties
  fallback: React.ReactNode
}

/**
 * Renders a registered raster asset when it exists. Missing files fail closed
 * to the supplied canonical fallback, so the visual pipeline can be populated
 * incrementally without breaking the game.
 */
export default function BuildingVisual({ entityId, world, view = 'exterior-isometric', className, style, fallback }: Props) {
  const asset = getBuildingVisualAsset(entityId, world, view)
  const [failed, setFailed] = useState(false)

  if (!asset || failed) return <>{fallback}</>

  return (
    <img
      src={asset.src}
      alt=""
      draggable={false}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none', ...style }}
      onError={() => setFailed(true)}
    />
  )
}
